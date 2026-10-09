#!/bin/bash
# RUN A COMMAND AGAINST A SHORT-LIVED ISOLATED SERVER — Calendar Job A.
#
# `docs/HOW-WE-BUILD.md` §3c: `next dev` holds a lock at `.next/dev/lock`, so a second one cannot
# start in the same folder as the owner's. The copy is the way round that, and `npm run haiku -- …`
# is what keeps every model tier on Haiku (§3.4a). This script does both, runs one command against
# the copy, and stops the server again — so nothing is left running between tasks.
#
#   bash scripts/with-server.sh '<command to run with BASE=http://localhost:3998>'
#
# The copy lives in the session scratchpad and is reused: `rsync` brings it up to date each time,
# which takes about a second, and `node_modules` is cloned once (APFS, no data copied).
set -euo pipefail

SCRATCH="${SCRATCH:-/private/tmp/claude-501/-Users-bhaskar-Desktop-compliboard/7c424d31-2507-4f2a-8217-70d289986706/scratchpad}"
APP="$SCRATCH/app3998"
PORT="${PORT:-3998}"
CMD="${1:?usage: with-server.sh '<command>'}"

mkdir -p "$APP"
rsync -a --exclude .next --exclude node_modules --exclude .git --exclude shots ./ "$APP/"
[ -d "$APP/node_modules" ] || cp -cR node_modules "$APP/"

cd "$APP"
env HR_PREVIEW=1 node scripts/haiku.mjs npx next dev -p "$PORT" > "$SCRATCH/app$PORT.log" 2>&1 &
SERVER=$!
# `kill 0` would take this shell with it; the server's own pid is enough, and `pkill -f` catches the
# `next dev` child the wrapper spawns.
cleanup() {
  kill "$SERVER" 2>/dev/null || true
  pkill -f "next dev -p $PORT" 2>/dev/null || true
  wait "$SERVER" 2>/dev/null || true
}
trap cleanup EXIT

# Ready is a 401 from a guarded route, not a port being open: a port opens before the app compiles.
for _ in $(seq 1 60); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$PORT/api/calendar/dates" 2>/dev/null || true)
  [ "$CODE" = "401" ] && break
  sleep 2
done
if [ "${CODE:-}" != "401" ]; then
  echo "  the server on $PORT did not come up; its log:"
  tail -20 "$SCRATCH/app$PORT.log"
  exit 1
fi
grep -m1 "haiku check" "$SCRATCH/app$PORT.log" || true
echo "  server ready on $PORT"

cd - > /dev/null
BASE="http://localhost:$PORT" bash -c "$CMD"
