import { Resend } from 'resend';
import { emailFrom } from '@/lib/emailSender'
import { NextRequest, NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * *** M5 (fix list, root R2, Job E4): RESEND RETURNS ERRORS, IT DOES NOT THROW. ***
 *
 * `await resend.emails.send(...)` resolves with `{ data, error }`. Nothing read `error`, so a
 * refused send fell straight through to `success: true` and the panel said **"Thank you for your
 * feedback — we read every message."** We did not have it. The person who took the trouble to write
 * it was thanked for a message that went nowhere, and would never write it again.
 *
 * Two more things were wrong on the way: `FEEDBACK_EMAIL!` is asserted non-null and would send to
 * `undefined`, and the message was interpolated into HTML unescaped — their own words, so not an
 * attack, but a `<` in a sentence silently ate the rest of it.
 */
export async function POST(request: NextRequest) {
  try {
    const { message, company } = await request.json();

    const to = (process.env.FEEDBACK_EMAIL ?? '').trim()
    if (!to) {
      console.error('FEEDBACK NOT SENT: FEEDBACK_EMAIL is not set, so there was nowhere to send it.')
      return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 })
    }
    const key = (process.env.RESEND_API_KEY ?? '').trim()
    if (!key) {
      console.error('FEEDBACK NOT SENT: RESEND_API_KEY is not set.')
      return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 })
    }
    /** Their own sentence, not markup. A `<` used to eat the rest of the message. */
    const escape = (v: unknown) => String(v ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const sent = await resend.emails.send({
      from: emailFrom(),
      to,
      subject: `CompliBoard Feedback${company ? ` from ${escape(company)}` : ''}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #166534;">New Feedback — CompliBoard</h2>
          ${company ? `<p><strong>Company:</strong> ${escape(company)}</p>` : ''}
          <p><strong>Message:</strong></p>
          <div style="background: #f9f9f9; padding: 16px; border-radius: 8px; border-left: 4px solid #166534;">
            ${escape(message)}
          </div>
          <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">
            Sent from CompliBoard feedback form
          </p>
        </div>
      `,
    });

    // *** THE ANSWER IS WHETHER IT WENT. *** The panel's "Thank you" is drawn from this, so it must
    // not say yes on a refusal (§5.1: never an empty success).
    if (sent.error) {
      console.error('FEEDBACK NOT SENT:', sent.error.message)
      return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 })
    }
    return NextResponse.json({ success: true, id: sent.data?.id ?? null });
  } catch (error) {
    console.error('Feedback error:', error);
    return NextResponse.json({ error: 'Failed to send feedback' }, { status: 500 });
  }
}
