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
- Order must_do items in the logical sequence a business owner must follow in real life
- When analysing an uploaded document focus on gaps, risks, corrective actions, and deadlines`;

const RESEARCH_PROMPT = `You are CompliBoard, a compliance research assistant for small businesses in the United States.

The user wants to understand a compliance topic in plain English — not a checklist, just a clear explanation.

Respond with a thorough but plain-English explanation. Structure your response clearly with these sections:

WHAT THIS MEANS FOR YOU
WHO IT APPLIES TO
THE KEY FACTS
COMMON MISCONCEPTIONS
WHAT HAPPENS IF YOU IGNORE IT
USEFUL RESOURCES

Rules:
- Write for a business owner with no legal background
- Be direct and specific — no vague generalities
- Use plain English throughout
- Only answer compliance, regulatory, HR policy, or benefits questions`;

const SUBSTEPS_PROMPT = `You are CompliBoard, a compliance assistant for small businesses in the United States.

You must respond ONLY with a valid JSON object. No other text. No markdown. No backticks. Just raw JSON.

You are generating detailed micro-steps to complete ONE specific compliance checklist item.

Use this exact structure:
{
  "must_do": [
    {
      "name": "Short action title — start with a verb",
      "description": "Exact specific instructions including form numbers, phone numbers, or webpages.",
      "source_url": "",
      "agency_name": "Full official name of the agency responsible",
      "search_hint": "Specific Google search string to find the exact page",
      "cost_note": "Exact fee if known, range if varies",
      "time_estimate": "How long this step takes",
      "what_you_need": "Documents or information to have ready",
      "is_determination": false,
      "clarifying_questions": []
    }
  ]
}

CRITICAL RULES:
- Every source_url must be a direct deep link — never a homepage
- Every step must have time_estimate, cost_note, and what_you_need filled in
- If cost is free, say Free
- If nothing is needed to prepare, say None needed
- Steps must be in logical order
- 3 to 6 steps total — no more
- is_determination true only when user must make a choice based on their situation
- clarifying_questions must be empty array when is_determination is false`;

function buildSystemPrompt(mode: string, scanResult: Record<string, unknown> | null): string {
  if (mode === 'research') return RESEARCH_PROMPT;
  if (mode === 'substeps') return SUBSTEPS_PROMPT;
  if (!scanResult) return CHECKLIST_PROMPT;

  const sr = scanResult as {
    chemicals?: string[]
    certifications?: string[]
    operations?: Record<string, boolean | null>
    custom_industry?: string | null
  };

  const chemicals = sr.chemicals && sr.chemicals.length > 0 ? sr.chemicals.join(', ') : null;
  const certs = sr.certifications && sr.certifications.length > 0 ? sr.certifications.join(', ') : null;
  const ops = sr.operations
    ? Object.entries(sr.operations)
        .filter(function(entry) { return entry[1] === true; })
        .map(function(entry) { return entry[0].replace(/_/g, ' '); })
        .join(', ')
    : null;
  const customIndustry = sr.custom_industry || null;

  const contextLines: string[] = [];
  if (chemicals) contextLines.push('Chemicals on site: ' + chemicals);
  if (certs) contextLines.push('Certifications: ' + certs);
  if (ops) contextLines.push('Operations confirmed: ' + ops);
  if (customIndustry) contextLines.push('Business description: ' + customIndustry);

  if (contextLines.length === 0) return CHECKLIST_PROMPT;

  const profileBlock = [
    '',
    '---',
    'COMPANY PROFILE — use this to personalise every answer:',
    contextLines.join('\n'),
    '',
    'INSTRUCTIONS: Reference these specifics directly in your answers.',
    'If they ask about chemical storage — mention their actual chemicals by name.',
    'If they ask about transport — reference their confirmed HazMat drivers.',
    'If they have ISO certs — acknowledge their existing quality system.',
    'Never give a generic answer when you have their specific profile.',
    '---',
  ].join('\n');

  return CHECKLIST_PROMPT + profileBlock;
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let question = '';
    let fileData: string | null = null;
    let fileType: string | null = null;
    let fileName: string | null = null;
    let mode = 'checklist';
    let scanResult: Record<string, unknown> | null = null;

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
      scanResult = body.scanResult || null;
    }

    const userQuestion = question.trim() ||
      (fileData ? 'Analyse this document and give me a compliance checklist. Identify any gaps, risks, or corrective actions needed.' : '');

    if (!userQuestion && !fileData) {
      return NextResponse.json({ error: 'No question or file provided' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(mode, scanResult);

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
            text: 'File name: ' + fileName + '\n\nUser question: ' + userQuestion,
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
            text: 'File name: ' + fileName + '\n\nUser question: ' + userQuestion,
          },
        ] as Anthropic.MessageParam['content'];
      } else {
        messageContent = 'File name: ' + fileName + '\n\nUser question: ' + userQuestion;
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
