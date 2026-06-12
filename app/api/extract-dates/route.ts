import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
Maximum 5 dates per document.`

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const fileName = formData.get('file_name') as string || ''

    if (!file) {
      return NextResponse.json({ dates_found: [] })
    }

    const fileType = file.type
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    let messageContent: Anthropic.MessageParam['content']

    const isImage = fileType.startsWith('image/')
    const isPDF = fileType === 'application/pdf'

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
    } else {
      // For Excel/CSV we can't send binary to Claude — skip date extraction
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
