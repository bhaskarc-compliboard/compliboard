#!/bin/bash
# THE CROSS-SECTION GATE, PARTS 4, 5 AND 6 — `docs/CALENDAR-PLAN.md` §2.5, Job E.
#
# Run against the short-lived isolated server, so nothing touches the owner's dev server on 3000:
#
#   bash scripts/with-server.sh 'bash scripts/fixlist-gate.sh'
#
# PART 4  every page still loads and shows its rows, with its BLOCKED list printed. No model call
#         and no write — `measure-layout.mjs` fails both in the browser before they leave.
# PART 5  every nightly job run by hand; each writes its `job_runs` row. `?dry=1` where the job
#         sends mail, because **a gate that sends mail is a gate with a side effect** — Calendar B8
#         sent a real email from its own gate run, and `?dry=1` is honoured on POST only.
# PART 6  the sender of every email, read from the code that sends it.
#
# W2's end-to-end run is `scripts/fixlist-w2-deleter.mjs`, called from part 5 so the deleter's own
# by-hand run is the one that proves it.
set -uo pipefail

BASE="${BASE:?BASE must be set — run this through scripts/with-server.sh}"
cd "$(dirname "$0")/.."
mkdir -p shots

# *** THE CRON SECRET COMES OUT OF `.env.local`. *** bash does not read it, and without the header
# every job answers 404 — `requireCronSecret` is deliberately opaque, so a gate run with no secret
# looks exactly like seven broken jobs. Job E's first gate run printed seven 404s for this reason.
if [ -z "${CRON_SECRET:-}" ] && [ -f .env.local ]; then
  CRON_SECRET=$(grep -m1 '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '"'"'"'')
fi
if [ -z "${CRON_SECRET:-}" ]; then
  echo "  CRON_SECRET is not set and is not in .env.local; every job would answer 404." >&2
  exit 1
fi
export CRON_SECRET

say() { printf '\n%s\n%s\n' "$1" "$(printf '=%.0s' $(seq 1 ${#1}))"; }
FAILED=0

# =============================================================================================
say "PART 4 — every page loads and shows its rows (BASE=$BASE)"
# =============================================================================================
for page in /dashboard /calendar /documents /audits /compliance /hr /company-information /account; do
  name="$(echo "$page" | tr -d '/')"
  out=$(node --env-file=.env.local scripts/measure-layout.mjs "$page" \
          --base "$BASE" --shot "shots/jobE-gate-$name.png" 2>&1)
  title=$(echo "$out" | grep -m1 -iE "^ *title" || true)
  blocked=$(echo "$out" | grep -m1 -iE "BLOCKED" || echo "BLOCKED (?)")
  if echo "$out" | grep -qiE "Internal Server Error|could not open|failed to"; then
    echo "  ✗ $page — $(echo "$out" | tail -3 | tr '\n' ' ')"
    FAILED=1
  else
    echo "  ✓ $(printf '%-22s' "$page") ${title:-(no title line)}  |  $blocked"
  fi
done

# =============================================================================================
say "PART 5 — every nightly job, by hand"
# =============================================================================================
# `?dry=1` for the two that send mail of their own accord. The others send only when they finish
# work, and staging holds none for them (0 document_batches, 0 audit_sections) — which is stated
# rather than assumed: the counts come back in each answer.
for job in "summarise" "delete" "scan-documents" "audit-sections" "handbook-queue" \
           "handbook-checks" "calendar-month?dry=1"; do
  name="${job%%\?*}"
  code=$(curl -s -o /tmp/jobE-$name.json -w "%{http_code}" -X POST \
          -H "x-cron-secret: ${CRON_SECRET:-}" "$BASE/api/jobs/$job")
  # *** `dry_run` IS PRINTED, NOT HIDDEN. *** The first version printed `j.counts ?? j`, which for
  # calendar-month showed `sent: 1` with no sign of whether anything had actually been sent — and
  # Calendar B8's slip was a gate run that sent a real email. On a dry run `counts.sent` means
  # "would have been sent" (`lib/calendarNotify.ts:344` returns before `emails.send`), so the flag
  # is the only thing that tells the two apart and it goes first.
  counts=$(node -e "try{const j=require('/tmp/jobE-$name.json');const f=(j.dry_run===true?'dry_run=true ':j.dry_run===false?'dry_run=false ':'');const c=j.counts??j;const s=f+JSON.stringify(c);console.log(s.length>150?s.slice(0,150)+'…':s)}catch(e){console.log('(no JSON)')}")
  if [ "$code" = "200" ]; then echo "  ✓ $(printf '%-18s' "$name") 200  $counts"
  else echo "  ✗ $(printf '%-18s' "$name") $code  $counts"; FAILED=1; fi
done

say "PART 5b — W2 end to end: the deleter, through the route a cron calls"
node --experimental-strip-types --env-file=.env.local scripts/fixlist-w2-deleter.mjs || FAILED=1

# =============================================================================================
say "PART 6 — the sender of every email"
# =============================================================================================
# Read from the code that sends it, not from a list: one function answers for all of them, and the
# question is whether any sender was changed by this job.
grep -n "emailFrom()" lib/*.ts | sed 's/^/  /'
echo "  and emailFrom() itself:"
grep -n "export function emailFrom" -A 8 lib/emailSender.ts | sed 's/^/    /' \
    || true

exit $FAILED
