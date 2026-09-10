import { askAIJson, type AIContent } from '@/lib/ai'
import { reviewPrompt } from '@/prompts/document-review'
import type { SupabaseClient } from '@supabase/supabase-js'
import mammoth from 'mammoth'
import officeParser from 'officeparser'

export interface ReviewDocumentInput {
  buffer: ArrayBuffer
  fileType: string
  fileName: string
  documentId?: string
  documentName: string
  folderId?: string
  folderName?: string
  divisionName?: string
  companyId: string
  userId: string
  industry?: string
  /**
   * The client to write the review with — the caller's own (`authed.db`), so the insert
   * runs under RLS like everything else in the request.
   *
   * Required, deliberately. This used to be optional with a service-role fallback, for
   * callers not yet converted off that key. Both callers now pass a client, so the
   * fallback became unreachable code that silently bypassed RLS — exactly the kind that
   * gets picked up later by someone who does not know why it was there. Making the
   * parameter required means the compiler enforces it and a future caller cannot forget.
   */
  db: SupabaseClient
}

// Reviews a document's actual content (PDF/image/Word/PowerPoint) and saves the
// result to document_reviews. Shared by the manual "Review" button
// (app/api/document-review/route.ts) and the audit engine's auto-indexing step —
// never duplicate this logic in two places.
export async function reviewDocument(input: ReviewDocumentInput) {
  const client = input.db
  const { buffer, fileType, fileName, documentId, documentName, folderId, folderName, divisionName, companyId, userId, industry } = input
  const base64 = Buffer.from(buffer).toString('base64')
  const lowerName = fileName.toLowerCase()

  const isImage = fileType.startsWith('image/')
  const isPDF = fileType === 'application/pdf' || lowerName.endsWith('.pdf')
  const isWord = fileType.includes('wordprocessingml') || fileType.includes('msword') || lowerName.endsWith('.docx') || lowerName.endsWith('.doc')
  const isPowerPoint = fileType.includes('presentationml') || fileType.includes('powerpoint') || lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt')

  let messageContent: AIContent
  const contextLine = `File name: ${documentName}\nFolder: ${folderName || ''}\nDivision: ${divisionName || ''}\nIndustry: ${industry || ''}\n\n`

  if (isPDF) {
    messageContent = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } } as any,
      { type: 'text', text: contextLine + 'Review this compliance document.' },
    ]
  } else if (isImage) {
    messageContent = [
      { type: 'image', source: { type: 'base64', media_type: fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: base64 } },
      { type: 'text', text: contextLine + 'Review this compliance document.' },
    ]
  } else if (isWord) {
    const nodeBuffer = Buffer.from(buffer)
    const result = await mammoth.convertToHtml({ buffer: nodeBuffer })
    messageContent = [{ type: 'text', text: contextLine + result.value + '\n\nReview this compliance document.' }]
  } else if (isPowerPoint) {
    const nodeBuffer = Buffer.from(buffer)
    const ast = await (officeParser as any).parseOffice(nodeBuffer)
    const text = ast.toText()
    messageContent = [{ type: 'text', text: contextLine + text + '\n\nReview this compliance document.' }]
  } else {
    throw new Error('Unsupported file type for review')
  }

  const review = await askAIJson(reviewPrompt(), messageContent, { maxTokens: 6000, enableWebSearch: true })

  const { data, error } = await client
    .from('document_reviews')
    .insert({
      company_id: companyId,
      user_id: userId,
      document_id: documentId || null,
      document_name: documentName,
      folder_id: folderId || null,
      folder_name: folderName || '',
      division_name: divisionName || '',
      document_type: review.document_type,
      issued_by: review.issued_by,
      issue_date: review.issue_date,
      expiry_date: review.expiry_date,
      renewal_date: review.renewal_date,
      is_current: review.is_current,
      expiring_soon: review.expiring_soon,
      days_until_expiry: review.days_until_expiry,
      coverage: review.coverage,
      regulation_reference: review.regulation_reference || null,
      gaps: review.gaps || [],
      gap_fixes: review.gap_fixes || [],
      action_items: review.action_items || [],
      summary: review.summary,
    })
    .select()
    .single()

  if (error) throw error
  return { data, review }
}
