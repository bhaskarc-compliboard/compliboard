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
import { type EmailShape, FOOTER_NOT_LEGAL_ADVICE } from './email.ts'
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
