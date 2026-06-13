import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import officeParser from 'officeparser'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const EXTRACT_PROMPT = `You are a compliance document analyzer. Extract any important dates from this document.

Look for:
- Expiry dates, expiration dates
- Renewal dates
- Inspection due dates
- License validity dates
- Permit end dates
- Annual review dates
- Any compliance deadlines

You must respond ONLY with a valid JSON object. No other text. No markdown. No backticks.

Use this structure:
{
  "dates_found": [
    {
      "title": "Short descriptive title for the calendar event. Example: Business License Renewal",
      "date": "YYYY-MM-DD format",
      "description": "One sentence context about this date from the document",
      "is_recurring": false,
      "recurrence_period": null
    }
  ]
}

If the document mentions annual renewals or recurring inspections, set is_recurring to true and recurrence_period to "annually".
If no dates are found, return: { "dates_found": [] }
Only include dates that are in the future or within the last 30 days.
Maximum 10 dates per document.`

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

    let messageContent: Anthropic.MessageParam['content']

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
      const text = await new Promise<string>((resolve, reject) => {
        officeParser.parseOfficeAsync(nodeBuffer, { outputErrorToConsole: false })
          .then((data: string) => resolve(data))
          .catch((err: Error) => reject(err))
      })
      messageContent = [
        { type: 'text', text: `File name: ${fileName}\n\n${text}\n\nExtract all important compliance dates from this presentation.` },
      ]
    } else {
      // Unsupported file type
      return NextResponse.json({ dates_found: [] })
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      system: EXTRACT_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Date extraction error:', error)
    return NextResponse.json({ dates_found: [] })
  }
}
