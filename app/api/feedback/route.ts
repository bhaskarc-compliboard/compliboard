import { Resend } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { message, company } = await request.json();

    await resend.emails.send({
      from: 'CompliBoard <onboarding@resend.dev>',
      to: process.env.FEEDBACK_EMAIL!,
      subject: `CompliBoard Feedback${company ? ` from ${company}` : ''}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #166534;">New Feedback — CompliBoard</h2>
          ${company ? `<p><strong>Company:</strong> ${company}</p>` : ''}
          <p><strong>Message:</strong></p>
          <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; border-left: 4px solid #166534;">
            ${message}
          </div>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
            Sent from CompliBoard feedback form
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
  }
}
