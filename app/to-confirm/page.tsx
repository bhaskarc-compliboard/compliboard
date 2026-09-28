/**
 * /to-confirm — GONE, AND IT REDIRECTS RATHER THAN 404s. Task 0, commit 2.
 *
 * The confirmation queue is the first section of `/your-company`: the questions and the record they
 * complete are one thing, and they were two screens only because the queue was built first.
 *
 * *** A REDIRECT AND NOT A DELETION, FOR TWO REASONS. ***
 * The batch email links people into the product and a bookmarked or already-sent link must not land
 * on "not found" — `CLAUDE.md` §5.1 applies to a dead URL as much as to an error message. And the
 * route is in the wild: `NEXT_PUBLIC_APP_URL` has been stamped into every batch email since
 * 26 September.
 *
 * `permanentRedirect` rather than `redirect`: 308, because the page is not coming back. The API
 * route `/api/to-confirm` is UNTOUCHED and is still what answers a confirmation, from this page's
 * successor and from the report drawer both.
 */
import { permanentRedirect } from 'next/navigation'

export default function ToConfirmRedirect() {
  permanentRedirect('/your-company')
}
