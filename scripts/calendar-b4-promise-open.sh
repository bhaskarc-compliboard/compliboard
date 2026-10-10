#!/bin/bash
# THE GATE OPEN — the half B2 could not have shown. Calendar B4.
#
# Both gates are satisfied IN THE COPY ONLY: the constant is flipped with sed inside the scratchpad
# tree and EMAIL_FROM is set in the server's own environment. `lib/emailPromise.ts` in the real tree
# is never touched, so there is nothing to put back and nothing to forget to put back.
set -euo pipefail
SCRATCH="${SCRATCH:-/private/tmp/claude-501/-Users-bhaskar-Desktop-compliboard/7c424d31-2507-4f2a-8217-70d289986706/scratchpad}"
APP="$SCRATCH/app3997"
PORT=3997
mkdir -p "$APP"
rsync -a --exclude .next --exclude node_modules --exclude .git --exclude shots ./ "$APP/"
[ -d "$APP/node_modules" ] || cp -cR node_modules "$APP/"

# GATE 2: the off switch exists. GATE 1: a real sending address.
sed -i '' 's/^export const MY_ACCOUNT_OFF_SWITCH_EXISTS = false$/export const MY_ACCOUNT_OFF_SWITCH_EXISTS = true/' "$APP/lib/emailPromise.ts"
grep -q "MY_ACCOUNT_OFF_SWITCH_EXISTS = true" "$APP/lib/emailPromise.ts" || { echo "the flip did not take"; exit 1; }
echo "  copy: MY_ACCOUNT_OFF_SWITCH_EXISTS = true, EMAIL_FROM set"
echo "  real tree: $(grep -c 'MY_ACCOUNT_OFF_SWITCH_EXISTS = false' lib/emailPromise.ts) line(s) still false — untouched"

cd "$APP"
env HR_PREVIEW=1 EMAIL_FROM='CompliBoard <hello@compliboard.com>' \
  node scripts/haiku.mjs npx next dev -p "$PORT" > "$SCRATCH/app$PORT.log" 2>&1 &
SERVER=$!
cleanup() { kill "$SERVER" 2>/dev/null || true; pkill -f "next dev -p $PORT" 2>/dev/null || true; wait "$SERVER" 2>/dev/null || true; }
trap cleanup EXIT
for _ in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/calendar/dates" 2>/dev/null || true)
  [ "$CODE" = "401" ] && break
  sleep 2
done
[ "${CODE:-}" = "401" ] || { echo "server did not come up"; tail -20 "$SCRATCH/app$PORT.log"; exit 1; }
cd - > /dev/null
node --env-file=.env.local scripts/calendar-b4-promise.mjs "http://localhost:$PORT" open
# *** AND THE PAGE HAS TO BE OPENED BY A BROWSER, NOT BY `fetch`. ***
# The first run of this script read the raw HTML and reported the sentences ABSENT while
# /api/promise said true — which looked like the gate failing and was the check being blind. The
# landing page is a client component and the gate is answered after hydration, so the words appear
# only once JS has run. `fetch` runs none. R2 again, in a new disguise.
npm run measure -- / --base "http://localhost:$PORT" --width 1280 --full --shot shots/calendar-jobB-b4-promise-open.png 2>&1 | grep -aE "BLOCKED|Error" | head -2
