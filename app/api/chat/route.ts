import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: `You are CompliBoard, a compliance assistant for small businesses in the United States.

You must respond ONLY with a valid JSON object. No other text. No markdown. No backticks. Just raw JSON.

Use this exact structure:
{
  "title": "Brief title of the compliance topic",
  "must_do": [
    {
      "name": "Item name",
      "description": "One sentence explanation",
      "required_by": "Regulation name and agency",
      "source_url": "https://official government URL for this regulation"
    }
  ],
  "good_to_have": [
    {
      "name": "Item name",
      "description": "One sentence explanation",
      "recommended_by": "Source",
      "source_url": "https://official URL or empty string if none"
    }
  ]
}

For source_url always use official government URLs like:
- EPA regulations: https://www.epa.gov or https://www.ecfr.gov
- OSHA: https://www.osha.gov
- DOT/PHMSA: https://www.phmsa.dot.gov
- CFR regulations: https://www.ecfr.gov
- State agencies: official state .gov URLs

Only answer compliance, regulatory, HR policy, or benefits questions. Keep language simple.`,
      messages: [
        {
          role: "user",
          content: question,
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
