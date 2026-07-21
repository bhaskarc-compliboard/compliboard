import { askAI, type AIContent } from '@/lib/ai';
import { buildSystemPrompt } from '@/prompts/checklist';
import { NextRequest, NextResponse } from "next/server";

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
      (fileData
        ? (mode === 'research'
            ? 'Summarize what this document is, what it covers, and flag anything that looks off, expired, or missing.'
            : 'Analyse this document and give me a compliance checklist. Identify any gaps, risks, or corrective actions needed.')
        : '');

    if (!userQuestion && !fileData) {
      return NextResponse.json({ error: 'No question or file provided' }, { status: 400 });
    }

    const systemPrompt = buildSystemPrompt(mode, scanResult);

    let messageContent: AIContent;

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
        ] as AIContent;
      } else {
        messageContent = 'File name: ' + fileName + '\n\nUser question: ' + userQuestion;
      }
    } else {
      messageContent = userQuestion;
    }

    const responseText = await askAI(systemPrompt, messageContent, { maxTokens: 6000 });

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
