/**
 * THE INVITATION EMAIL — My Account step 7 (`ACCOUNT-PLAN.md` decision 6, board 2).
 *
 * *** IT IS OURS, NOT THE LOGIN SYSTEM'S. *** Supabase can send its own invite mail, and this does
 * not use it. Two reasons, and the second is the one that matters: its mail is addressed from the
 * auth system in the auth system's words, so the first thing a new colleague ever reads from this
 * product would be a template nobody here wrote — and `ACCOUNT-PLAN.md` open question 3 already
 * records that the login system's own mails are the exception, used only where there is no
 * alternative (an email change, a password reset). The other reason is that the token is ours:
 * migration 082 keeps it out of `authenticated`'s grant entirely, so the only thing that can put it
 * in a link is a service-role reader, which is this.
 *
 * *** THE SAME TEMPLATE AS EVERY OTHER PRODUCT EMAIL. *** `renderEmail` from `lib/email.ts`, so the
 * invitation looks like the monthly calendar email, the audit notice and the batch notice, and so
 * the plain-text twin is built by the same function rather than written twice. The shape is a pure
 * value — this file calls nothing and reads nothing — so a test can render it and read both halves.
 */
import { type EmailShape, FOOTER_NOT_LEGAL_ADVICE, sandboxSenderRefusal } from './email.ts'
import { inviteSubject, joinButton, joinUrl, LINK_GOOD_FOR } from './peopleView.ts'

export interface InvitationMail {
  subject: string
  shape: EmailShape
}

/**
 * What the invitation says.
 *
 * `inviter` is the name of the person who sent it, or their address when they have not given a
 * name — never "someone", because an email asking you to join a company has to say who is asking.
 */
export function invitationEmail(input: {
  inviter: string
  company: string
  appUrl: string
  token: string
}): InvitationMail {
  const href = joinUrl(input.appUrl, input.token)
  return {
    subject: inviteSubject(input.inviter),
    shape: {
      title: `Join ${input.company} on CompliBoard`,
      lede:
        `${input.inviter} has invited you to ${input.company} on CompliBoard. ` +
        'Follow the link to choose your own password and sign in.',
      sections: [
        {
          rows: [
            {
              primary: 'Everyone at the company sees the same things',
              secondary:
                'The requirements that apply, the dates coming up, the documents on file and what ' +
                'they prove. There are no roles to pick.',
            },
          ],
        },
      ],
      button: { label: joinButton(input.company), href },
      footer: [
        // The one fact about the link a person has to know, in board 2's own words.
        `${LINK_GOOD_FOR[0].toUpperCase()}${LINK_GOOD_FOR.slice(1)}.`,
        // *** AND WHAT TO DO IF THIS WAS NOT MEANT FOR THEM. *** An invitation is the one product
        // email that can reach somebody who has never heard of us, and the honest thing is to say
        // plainly that ignoring it costs them nothing (§5.1).
        'If you were not expecting this, you can ignore it — nothing happens until you follow the link.',
        FOOTER_NOT_LEGAL_ADVICE,
      ],
    },
  }
}

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * CAN AN INVITATION BE SENT AT ALL? ASKED BEFORE ANYTHING IS WRITTEN.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * *** THE ORDER IS THE WHOLE FIX, AND IT WAS WRONG. *** `POST /api/invitations` used to insert the
 * row, read its token, build the mail and only THEN discover that the sandbox guard refuses to send
 * on production. It cancelled the row afterwards, which is tidy but not clean: for the length of
 * two round trips a live invitation existed for an email nobody would ever receive, the
 * one-live-invitation index was occupied by it, and a failure between the insert and the cancel
 * would have left it there for good — an invitation that can never be accepted and that blocks the
 * colleague from being invited again.
 *
 * Nothing about "can we send mail" depends on the row, so it is asked first and nothing is written.
 * `lib/email.ts` `sandboxSenderRefusal` is the rule for production's sandbox sender; the key and the
 * app URL are the other two things a sendable invitation needs. **A link that does not work is
 * worse than no email** (`lib/auditNotify.ts`'s rule), and an invitation whose entire content is a
 * dead link is the worst version of that.
 *
 * *** AND THE PERSON IS TOLD THE TRUTH, WHICH IS NOT "SOMETHING WENT WRONG". *** On production
 * today, with the Resend domain not yet verified, inviting a colleague is a thing the product
 * genuinely cannot do. "We could not send that just now" invites them to try again, which will fail
 * identically. The sentence says it is not switched on and that we will say when it is.
 *
 * A pure function of four strings, so a test can hold every branch without an environment and
 * without a mail client — the shape `sandboxSenderRefusal` is written in, for the same reason.
 */
export const MAIL_NOT_ON =
  'Invitations by email are not switched on yet. We will let you know when they are.'

export interface MailBlocked {
  /** What the person reads. One sentence, the same for every reason. */
  sentence: string
  /** What goes in the log. Ours, and never shown. */
  why: string
}

export function invitationMailBlocked(input: {
  from: string
  vercelEnv: string | undefined
  resendKey: string | undefined
  appUrl: string
}): MailBlocked | null {
  const sandbox = sandboxSenderRefusal(input.from, input.vercelEnv)
  if (sandbox) return { sentence: MAIL_NOT_ON, why: sandbox }
  if (!(input.resendKey ?? '').trim()) {
    return { sentence: MAIL_NOT_ON, why: 'RESEND_API_KEY is not set' }
  }
  if (!input.appUrl.trim()) {
    return {
      sentence: MAIL_NOT_ON,
      why: 'NEXT_PUBLIC_APP_URL is not set, so every link in the invitation would be dead',
    }
  }
  return null
}
