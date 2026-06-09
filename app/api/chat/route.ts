import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CHECKLIST_PROMPT = `You are CompliBoard, a compliance assistant for small businesses in the United States.

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
- description must include the regulation name and agency in one natural sentence
- why must explain consequences of non-compliance in plain English
- cost_note must use ranges not single numbers — never mislead with a low estimate
- providers only include well-known legitimate companies or agencies — local first, then regional, then national
- source_url must be an official .gov URL
- safety_alert only for genuinely dangerous situations
- Only answer compliance, regulatory, HR policy, or benefits questions
- Keep all language plain English — your users are small business owners not lawyers
- Order must_do items in the logical sequence a business owner must follow in real life. Always sequence items so prerequisites come before the actions that depend on them. Research and planning before applications, applications before approvals, approvals before physical work, registrations before operations.
- When analysing an uploaded document focus on gaps, risks, corrective actions, and deadlines`;

const RESEARCH_PROMPT = `You are CompliBoard, a compliance research assistant for small businesses in the United States.

The user wants to understand a compliance topic in plain English — not a checklist, just a clear explanation.

Respond with a thorough but plain-English explanation. Structure your response clearly with these sections:

WHAT THIS MEANS FOR YOU
[2-3 sentences explaining what this regulation or topic actually means for a small business owner. Cut through the legal language.]

WHO IT APPLIES TO
[1-2 sentences on which businesses, industries, or situations this applies to. Be specific.]

THE KEY FACTS
[4-6 bullet points of the most important things to know. Each bullet should be one clear sentence.]

COMMON MISCONCEPTIONS
[2-3 things business owners often get wrong about this topic.]

WHAT HAPPENS IF YOU IGNORE IT
[1-2 sentences on real consequences — fines, shutdowns, liability. Be honest but not alarmist.]

USEFUL RESOURCES
[2-3 official .gov links with a one-line description of what each covers.]

Rules:
- Write for a business owner with no legal background
- Be direct and specific — no vague generalities
- Use plain English throughout
- If the topic does not require any compliance action, say so clearly and explain why
- Only answer compliance, regulatory, HR policy, or benefits questions`;

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let question = '';
    let fileData: string | null = null;
    let fileType: string | null = null;
    let fileName: string | null = null;
    let mode = 'checklist';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      question = formData.get('question') as string || '';
      mode = formData.get('mode') as string || 'checklist';
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
      mode = body.mode || 'checklist';
    }

    const userQuestion = question.trim() ||
      (fileData ? 'Analyse this document and give me a compliance checklist. Identify any gaps, risks, or corrective actions needed.' : '');

    if (!userQuestion && !fileData) {
      return NextResponse.json({ error: 'No question or file provided' }, { status: 400 });
    }

    const systemPrompt = mode === 'research' ? RESEARCH_PROMPT : CHECKLIST_PROMPT;

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
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: messageContent,
        },
      ],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    if (mode === 'research') {
      return NextResponse.json({ research: responseText });
    }

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
