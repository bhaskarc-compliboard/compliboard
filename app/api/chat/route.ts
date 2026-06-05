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
  "safety_alert": "ONLY include if the topic involves dangerous chemicals, hazardous materials, explosives, or immediate safety risks. Plain English warning. Empty string if not applicable.",
  "must_do": [
    {
      "name": "Item name — short and action-oriented",
      "description": "Maximum one sentence. What to do and which regulation requires it. Be concise. Example: Register with FMCSA for a USDOT number under 49 CFR 390.19.",
      "source_url": "Official government URL — epa.gov, osha.gov, phmsa.dot.gov, ecfr.gov, or official state .gov URLs only",
      "why": "One to two sentences explaining why this rule exists and what happens if ignored. Write for a business owner, not a lawyer.",
      "cost_note": "Honest cost range with context. Use ranges not single numbers. Example: $100 to $500 depending on state and business size. Free if no cost involved.",
      "providers": [
        {
          "name": "Provider or agency name",
          "type": "Type of service",
          "coverage": "local or regional or national",
          "note": "What they help with specifically"
        }
      ],
      "steps": [
        {
          "title": "Short action title",
          "detail": "One sentence explaining exactly what to do",
          "link": "Direct URL to complete this step if available, empty string if not"
        }
      ]
    }
  ],
  "good_to_have": [
    {
      "name": "Item name",
      "description": "One sentence explanation including who recommends it",
      "source_url": "Official URL or empty string",
      "why": "One sentence on the benefit",
      "cost_note": "Cost range or empty string"
    }
  ],
  "follow_up_questions": [
    "A specific follow-up question that would make this checklist more tailored to their situation"
  ]
}

CRITICAL RULES:
- description must include the regulation name and agency in one natural sentence — do not put regulation in a separate field
- why must explain consequences of non-compliance in plain English — fines, shutdowns, liability
- cost_note must use ranges not single numbers — never mislead with a low estimate
- steps must be 3 to 6 concrete actions a person can actually take — not vague advice
- steps.link must be a real direct URL where they complete that step — registration portals, form pages, agency contacts
- providers only include well-known legitimate companies or agencies — local first, then regional, then national
- source_url must be an official .gov URL — no third party sites
- follow_up_questions replace the old why_not and refine sections — include 2 to 3 questions
- safety_alert only for genuinely dangerous situations — chemicals, hazmat, explosives, immediate safety risks
- Order must_do items in the logical sequence a business owner must follow in real life. Always sequence items so prerequisites come before the actions that depend on them. Research and planning before applications, applications before approvals, approvals before physical work, registrations before operations. Never list a step that depends on a previous step before that previous step.
- Only answer compliance, regulatory, HR policy, or benefits questions
- Keep all language plain English — your users are small business owners not lawyers
- When analysing an uploaded document focus on gaps, risks, corrective actions, and deadlines`;

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
      max_tokens: 6000,
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
