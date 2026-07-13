import { askAIJson, type AIContent } from '@/lib/ai'
import { EXTRACT_PROMPT } from '@/prompts/extract-dates'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import officeParser from 'officeparser'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileName = formData.get('file_name') as string || ''

    if (!file) {
      return NextResponse.json({ dates_found: [] })
    }

    const fileType = file.type
    const fileName2 = file.name.toLowerCase()
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const isImage = fileType.startsWith('image/')
    const isPDF = fileType === 'application/pdf' || fileName2.endsWith('.pdf')
    const isExcel = fileType.includes('spreadsheet') || fileType.includes('excel') || fileName2.endsWith('.xlsx') || fileName2.endsWith('.xls')
    const isCSV = fileType === 'text/csv' || fileName2.endsWith('.csv')
    const isWord = fileType.includes('wordprocessingml') || fileType.includes('msword') || fileName2.endsWith('.docx') || fileName2.endsWith('.doc')
    const isPowerPoint = fileType.includes('presentationml') || fileType.includes('powerpoint') || fileName2.endsWith('.pptx') || fileName2.endsWith('.ppt')

    let messageContent: AIContent

    if (isPDF) {
      messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as any,
        { type: 'text', text: `File name: ${fileName}\n\nExtract all important compliance dates from this document.` },
      ]
    } else if (isImage) {
      messageContent = [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
            data: base64,
          },
        },
        { type: 'text', text: `File name: ${fileName}\n\nExtract all important compliance dates from this document.` },
      ]
    } else if (isExcel) {
      // Convert Excel to text using xlsx library
      const nodeBuffer = Buffer.from(buffer)
      const workbook = XLSX.read(nodeBuffer, { type: 'buffer', cellDates: true })
      let textContent = `File name: ${fileName}\n\n`
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        textContent += `Sheet: ${sheetName}\n${csv}\n\n`
      }
      messageContent = [
        { type: 'text', text: `${textContent}\n\nExtract all important compliance dates from this spreadsheet.` },
      ]
    } else if (isCSV) {
      // CSV is plain text — read directly
      const text = new TextDecoder().decode(buffer)
      messageContent = [
        { type: 'text', text: `File name: ${fileName}\n\n${text}\n\nExtract all important compliance dates from this spreadsheet.` },
      ]
    } else if (isWord) {
      // Convert Word doc to HTML using mammoth (preserves table structure)
      const nodeBuffer = Buffer.from(buffer)
      const result = await mammoth.convertToHtml({ buffer: nodeBuffer })
      const text = result.value
      messageContent = [
        { type: 'text', text: `File name: ${fileName}\n\n${text}\n\nExtract all important compliance dates from this document.` },
      ]
    } else if (isPowerPoint) {
      // Convert PowerPoint to text using officeparser
      const nodeBuffer = Buffer.from(buffer)
      const ast = await (officeParser as any).parseOffice(nodeBuffer)
      const text = ast.toText()
      messageContent = [
        { type: 'text', text: `File name: ${fileName}\n\n${text}\n\nExtract all important compliance dates from this presentation.` },
      ]
    } else {
      // Unsupported file type
      return NextResponse.json({ dates_found: [] })
    }

    const parsed = await askAIJson(EXTRACT_PROMPT, messageContent, { maxTokens: 1000 })

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Date extraction error:', error)
    return NextResponse.json({ dates_found: [] })
  }
}
