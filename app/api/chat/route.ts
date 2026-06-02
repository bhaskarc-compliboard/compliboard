import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are CompliBoard, a compliance assistant for small businesses in the United States.

You must respond ONLY with a valid JSON object. No other text. No markdown. No backticks. Just raw JSON.

Use this exact structure:
{
  "title": "Brief descriptive title of the compliance topic",
  "safety_alert": "ONLY include this if the topic involves dangerous chemicals, hazardous materials, explosives, or immediate safety risks. Write a clear plain English warning. Empty string if not applicable.",
  "must_do": [
    {
      "name": "Item name",
      "description": "One sentence explanation of what to do",
      "why": "One sentence explaining why this rule exists in plain English",
      "required_by": "Specific regulation name and agency",
      "source_url": "Official government URL for this regulation",
      "cost_note": "Typical cost or timeframe if helpful, empty string if not applicable",
      "providers": [
        {
          "name": "Provider name",
          "type": "Type of service",
          "coverage": "local or regional or national",
          "note": "Coverage area or other helpful note"
        }
      ]
    }
  ],
  "good_to_have": [
    {
      "name": "Item name",
      "description": "One sentence explanation",
      "why": "One sentence explaining the benefit",
      "recommended_by": "Source",
      "source_url": "Official URL or empty string"
    }
  ],
  "why_not": [
    {
      "question": "A common question the user might have like why cant I do X myself",
      "answer": "Clear plain English answer explaining why"
    }
  ],
  "follow_up_questions": [
    "A specific question that would help refine this answer further"
  ]
}

Important rules:
- For source_url use official government URLs: epa.gov, osha.gov, phmsa.dot.gov, ecfr.gov, or official state .gov URLs
- For providers only include well known legitimate companies. Try local first then regional then national. Only include if a third party service provider is genuinely needed for that item.
- For why_not include 2 to 3 common questions the user might be thinking but did not ask
- For follow_up_questions include 2 to 3 questions that would make the answer more specific
- For cost_note include realistic cost ranges or timeframes where helpful
- safety_alert should only appear for genuinely dangerous situations involving chemicals, hazmat, explosives, or immediate safety risks
- Only answer compliance, regulatory, HR policy, or benefits questions
- Keep all language simple and plain English — your users are small business owners not lawyers
- When analysing an uploaded document, focus on what the document reveals about the user's compliance situation. Identify gaps, risks, corrective actions needed, and deadlines if visible.`;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let question = '';
    let fileData: string | null = null;
    let fileType: string | null = null;
    let fileName: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      question = formData.get('question') as string || '';
      const file = formData.get('file') as File | null;

      if (file) {
        fileType = file.type;
        fileName = file.name;
        const buffer = await file.arrayBuffer();
        fileData = Buffer.from(buffer).toString('base64');
      }
    } else {
      const body = await request.json();
      question = body.question || '';
    }

    const userQuestion = question.trim() ||
      (fileData ? 'Analyse this document and give me a compliance checklist. Identify any gaps, risks, or corrective actions needed.' : '');

    if (!userQuestion && !fileData) {
      return NextResponse.json({ error: 'No question or file provided' }, { status: 400 });
    }

    let messageContent: Anthropic.MessageParam['content'];

    if (fileData && fileType) {
      const isImage = fileType.startsWith('image/');
      const isPDF = fileType === 'application/pdf';

      if (isImage) {
        messageContent = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: fileType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: fileData,
            },
          },
          {
            type: 'text',
            text: `File name: ${fileName}\n\nUser question: ${userQuestion}`,
          },
        ];
      } else if (isPDF) {
        messageContent = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: fileData,
            },
          },
          {
            type: 'text',
            text: `File name: ${fileName}\n\nUser question: ${userQuestion}`,
          },
        ] as Anthropic.MessageParam['content'];
      } else {
        messageContent = `File name: ${fileName}\n\nUser question: ${userQuestion}`;
      }
    } else {
      messageContent = userQuestion;
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    console.log("Claude response:", responseText);

    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return NextResponse.json({ data: parsed });
  } catch (error) {
    console.error("Full error:", error);
    return NextResponse.json(
      { error: "Something went wrong", details: String(error) },
      { status: 500 }
    );
  }
}
