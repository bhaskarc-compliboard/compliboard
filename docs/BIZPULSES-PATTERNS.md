# Bizpulses — How This Project Is Actually Built

A description of the conventions in this repo as of 2026-09-09, derived by reading the code.
Where a convention doesn't exist, this says so rather than inventing one.

Three corrections to assumptions people bring to this codebase:

- **This is TanStack Start, not Next.js.** File-based routes under `app/src/routes`, a generated
  `routeTree.gen.ts`, a Vite plugin (`@tanstack/react-start/plugin/vite`), deployed to Vercel.
  No App Router, no `page.tsx`, no React Server Components, no `next.config`.
- **There is essentially one server function.** `sendChatMessage` in `app/src/routes/chat.tsx`.
  Everything else in the app talks to Supabase directly from the browser under RLS.
- **There is no automated test suite.** No vitest, no jest, no playwright, no CI. Verification has
  been `npm run typecheck` plus manually clicking through the running app and querying the live
  database. That is the honest state.

---

## 1. Project structure

npm workspaces monorepo. Root `package.json` declares `["app", "worker", "packages/*"]`.

```
bizpulses-code/
├── app/                      # TanStack Start frontend (Vercel)
│   ├── src/
│   │   ├── router.tsx        # createRouter, defaultPreload: "intent"
│   │   ├── routeTree.gen.ts  # generated — never edit by hand
│   │   ├── lib/              # shared, route-agnostic logic
│   │   │   ├── supabase.ts             # the one browser client (anon key)
│   │   │   ├── reportRegistry.ts       # ReportDefinition registry (1220 lines)
│   │   │   ├── reportComputations.ts   # shared data-fetch + profit math
│   │   │   └── useEntityRanking.ts     # shared sort/window hook
│   │   └── routes/           # file-based routes; each file owns its own UI
│   ├── vite.config.ts        # envDir: "../"  ← see §10
│   └── tsconfig.json         # paths → ../packages/*/src/index.ts
├── worker/
│   └── src/index.ts          # the entire worker, 1836 lines, one file
├── packages/
│   ├── ai/src/index.ts       # askAI() — the ONLY Anthropic call site
│   └── db/src/index.ts       # GENERATED Supabase types — never edit
├── scripts/
│   ├── db-migrate.js         # supabase db push via session pooler
│   └── db-types.js           # supabase gen types → packages/db/src/index.ts
├── supabase/migrations/      # 17 .sql files, source of truth for schema
├── docs/                     # product guide + market research (.docx)
├── CLAUDE.md                 # standing brief for AI sessions
├── DECISIONS.md              # 128KB decision log, newest-first
├── TODO.md                   # Current State block + session log
└── test-files/               # hand-built CSV fixtures (see TEST_DATASET.md)
```

**What belongs where**

| Concern | Location | Rule |
|---|---|---|
| Any AI call | `packages/ai/src/index.ts` | `askAI()` is the only export; `@anthropic-ai/sdk` is imported nowhere else. Verified: `grep -rn "@anthropic-ai" app/src worker/src` returns nothing. |
| DB types | `packages/db/src/index.ts` | Generated. Both `app` and `worker` import `Database` from `@bizpulses/db`. |
| Cross-report data fetching + math | `app/src/lib/reportComputations.ts` | Anything two reports both need. |
| Per-report shape, columns, headline | `app/src/lib/reportRegistry.ts` | One object per report; no per-report files. |
| Shared UI state logic | `app/src/lib/useEntityRanking.ts` | The only custom hook in the codebase. |
| Everything else UI | the route file itself | Charts, tables, styles, Excel export all live inside `routes/reports/$reportId.tsx`. |

**Naming**

- Workspace packages: `@bizpulses/app`, `@bizpulses/worker`, `@bizpulses/ai`, `@bizpulses/db`.
- Route files are lowercase; dynamic segments use `$param` (`reports/$reportId.tsx`, `files/$type.tsx`).
- A bare `reports.tsx` next to `reports/` is the layout pass-through (`() => <Outlet />`).
- TS: `camelCase` values, `PascalCase` types/components, `SCREAMING_SNAKE` module constants
  (`POLL_INTERVAL_MS`, `CHART_COLORS`, `REPORT_REGISTRY`).
- SQL: `snake_case` throughout — see §2.
- The product name is always **Bizpulses** with the trailing `s`, including the storage bucket
  (`bizpulses-uploads`) and localStorage keys (`bpNavCollapsed`).

**There is no `components/` directory.** No shared Button, Card, or layout primitives. Every route
declares its own `const styles = { ... } as React.CSSProperties` object at the bottom of the file,
and the same card/header/button styles are re-declared in `reports/index.tsx`, `reports/$reportId.tsx`,
`files/index.tsx`, and elsewhere. No CSS framework, no CSS modules, no design tokens. This is
consistent but it is duplication, not a pattern to copy (§11).

Route files are large: `chat.tsx` 841 lines, `reports/$reportId.tsx` 834, `files/$type.tsx` 794,
`files/index.tsx` 664. The extraction rule that *is* followed is "pull it out only when a second
caller appears" — which is how `reportComputations.ts` and `useEntityRanking.ts` came to exist
(both documented in DECISIONS.md).

---

## 2. Supabase schema and migrations

**File naming.** `supabase/migrations/YYYYMMDDNNNNNN_snake_case_description.sql`. The last six
digits are a within-day sequence, not a time: `20260901000002_ap_aging.sql`,
`20260901000003_invoice.sql`, `20260901000004_inventory.sql`. Ordering is lexicographic, so the
sequence number is what actually controls apply order. Note the drift: several files carry a date
earlier than their filesystem mtime (`20260901000005_freight_cost.sql` was written Sep 2). Harmless,
but the number is the ordering contract, not the date.

**Commands.**

```bash
npm run db:migrate    # applies pending migrations AND regenerates types (chained)
npm run db:types      # regenerate types only — recovery path if db:migrate's second half failed
```

`db:migrate` is literally `node --env-file=.env scripts/db-migrate.js && node --env-file=.env scripts/db-types.js`.
`db-migrate.js` shells out to `npx supabase db push --db-url ...` against the **session pooler**
(`aws-0-us-west-2.pooler.supabase.com:5432`, username `postgres.<ref>`), not the direct DB host —
the direct host is IPv6-only and unreachable from most networks. `SUPABASE_DB_PASSWORD` required.

**Catalog queries need `--linked`.** For anything in `pg_constraint`, `pg_catalog`, or
`information_schema`, the JS client will not work — PostgREST does not expose system catalogs.
The confirmed pattern (CLAUDE.md §2.5):

```bash
npx supabase db query --project-ref mgolkkfihzlnglgggprg --linked \
  "SELECT conname, pg_get_constraintdef(oid) AS definition
   FROM pg_constraint WHERE conrelid = 'public.uploads'::regclass AND contype = 'c'"
```

Without `--linked` the CLI errors out. This is the mandated way to confirm a live constraint name
before writing a `DROP CONSTRAINT` — not from memory, not from the previous migration file.

**Is the schema reproducible from the repo?** Structurally, yes: migration `20260827000000` creates
every base table, every RLS policy, the storage bucket, and the storage policies; `20260828000001`
creates the `auth.users` trigger; every later table ships with its own table + index + RLS + grants +
stored function in one file. Nothing in the app depends on a table that no migration creates.
**But this has never been verified by an actual from-scratch replay** — there is one Supabase project
(`mgolkkfihzlnglgggprg`, hardcoded in both scripts), no staging project, and no CI that rebuilds the
schema. So "reproducible" is a reasonable inference, not a tested fact.

**Table conventions**

- Table names: plural `snake_case`, and canonical extracted data is suffixed `_rows`
  (`sales_rows`, `ar_aging_rows`, `ap_aging_rows`, `invoice_rows`, `inventory_rows`,
  `freight_cost_rows`, `purchasing_po_rows`, `received_po_rows`, `generic_document_rows`).
  Exceptions that predate the suffix rule: `uploads`, `product_costs`, `organisations`,
  `memberships`, `reconciliation_results`.
- **PK:** always `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. No serial/bigint IDs anywhere.
- **Timestamps:** `TIMESTAMPTZ NOT NULL DEFAULT now()`. Named for the event
  (`uploaded_at`, `processed_at`, `created_at`) — there is no automatic `updated_at` column
  and no trigger to maintain one.
- **Money and quantities:** `NUMERIC`, never `float`. Dates are `DATE`, not timestamps.
- **FKs:** every data table carries both `org_id UUID NOT NULL REFERENCES organisations(id)` and
  `upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE`. Note the asymmetry, which is
  deliberate: deleting an upload cascades its rows away; `org_id` has no cascade, so an
  organisation cannot be deleted out from under live data.
- **Indexes:** named `idx_<table>_<cols>` and always org-leading, matching how every query filters:
  `idx_sales_rows_org_date ON sales_rows (org_id, sale_date)`,
  `idx_ar_aging_org_customer ON ar_aging_rows (org_id, customer, report_date)`.
  One partial index exists where it pays: `idx_uploads_superseded_by ... WHERE superseded_by IS NOT NULL`.
  (`generic_document_rows_org_upload` breaks the `idx_` prefix — one-off inconsistency.)

**The CHECK-constraint pattern for `report_type`.** `uploads.report_type` is a `TEXT` column
constrained to the known report types. Postgres cannot add a value to a CHECK, so **every** new
report type is a drop-and-recreate, and the recreated list must repeat all prior values:

```sql
-- Constraint name confirmed from live pg_constraint query: uploads_report_type_check.
ALTER TABLE uploads DROP CONSTRAINT uploads_report_type_check;
ALTER TABLE uploads ADD CONSTRAINT uploads_report_type_check
    CHECK (report_type IN (
        'sales', 'ar_aging', 'ap_aging', 'invoice', 'inventory',
        'freight_cost', 'product_costs', 'purchasing_po', 'received_po'
    ));
```

This has bitten the project at least once: `20260901000001_uploads_add_cancelled_status.sql` exists
solely because the original `status` CHECK omitted `'cancelled'`, so every UI cancel failed with a
400. Hence the rule to confirm the live constraint name via `supabase db query --linked` before
writing the DROP. The same pattern governs `uploads.status` and `uploads.grain`.

**Inconsistency worth naming:** `uploads.source` (`20260903000001`) is an enum-like column
(`'chat'` / `'files'`) shipped with **no** CHECK constraint, unlike every other enum-like column in
the schema. The constrained version is the better one; `source` should be brought in line.

**Constraint style beyond enums.** Multi-column invariants get a named table-level CHECK, e.g.
`inventory_rows_identifier_check CHECK (sku IS NOT NULL OR description IS NOT NULL)` — paired with
`NULLIF(elem->>'sku', '')` in the stored function so an empty string can't sneak past an
`IS NOT NULL` test. That pairing is the pattern: constraint in the schema, coercion in the writer.

**Stored functions.** Each canonical type gets one `replace_<type>_rows(p_org_id, p_upload_id,
p_period_start, p_period_end, p_rows JSONB)`, all built to the same template:

1. `SECURITY INVOKER` + `SET search_path = public`
2. Ownership guard: `IF NOT EXISTS (SELECT 1 FROM uploads WHERE id = p_upload_id AND org_id = p_org_id) THEN RAISE EXCEPTION`
3. `DELETE` scoped to `org_id` + the date window
4. `INSERT ... SELECT ... FROM jsonb_array_elements(p_rows)`
5. `REVOKE ALL ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ... TO service_role;`

DELETE + INSERT land in one transaction because PostgREST wraps each RPC call in one, so a failed
insert rolls the delete back rather than emptying the period. The one deliberate deviation is
`replace_invoice_freight_rows`, which scopes its DELETE by `upload_id` + `source_report_type = 'invoice'`
instead of a date range, so an invoice re-upload can't wipe standalone freight data.

`SECURITY DEFINER` is used exactly once, in `handle_new_user()`, because it must insert into
`organisations` and `memberships` before any session exists.

**Grants are not automatic.** Supabase does not grant PostgREST access to migration-created tables.
Every new table needs its own grant line or all reads and writes fail with "permission denied", even
for the service role, even when RLS would pass:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_rows TO authenticated, service_role;
```

`generic_document_rows` uses a stricter variant (`REVOKE ALL ... FROM PUBLIC`, then
`GRANT ... TO authenticated`, `GRANT ALL TO service_role`). That stricter form is the better one;
the rest of the schema uses the shorter line.

---

## 3. Row Level Security

Multi-tenancy is **org-scoped, not user-scoped**. Every data table carries `org_id`, never
`user_id`. Access is decided by a join to `memberships`, so an Owner, GM, and Bookkeeper at the same
org all see the same data, and a user at another org matches no membership row and sees nothing.

The complete real pattern, verbatim from `20260901000004_inventory.sql`:

```sql
ALTER TABLE inventory_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON inventory_rows
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.org_id = inventory_rows.org_id
              AND memberships.user_id = auth.uid()
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_rows TO authenticated, service_role;
```

**Policy naming.** Every org-scoped data table has exactly one policy named `org_isolation`
(policy names are per-table, so the repetition is legal and intentional — the name states the rule).
Two named exceptions:

- `memberships` uses `own_memberships`: `FOR ALL USING (user_id = auth.uid())`. A user sees only
  their own membership rows. Letting an owner list all members of their org is explicitly a later
  phase, noted in the migration comment.
- Storage policies are per-verb: `upload_insert`, `upload_select`, `upload_delete` on
  `storage.objects`, matching the org id against the first path segment:
  `memberships.org_id::text = (storage.foldername(name))[1]`. That is why upload paths are always
  `${orgId}/${Date.now()}-${safeFilename}` — the folder name *is* the tenant boundary.

**How the org scoping is expressed.** Always the same `EXISTS (SELECT 1 FROM memberships ...)`
subquery, never a `security definer` helper function, never a JWT claim. Policies are written
`FOR ALL USING (...)` with no separate `WITH CHECK`; Postgres reuses the `USING` expression as the
check for INSERT/UPDATE, so writes are constrained by the same predicate. That is correct, but it's
implicit — being explicit with `WITH CHECK` would document the intent better.

One style drift: `generic_document_rows` writes the same predicate with unqualified column names
(`WHERE user_id = auth.uid() AND org_id = generic_document_rows.org_id`) and an unquoted policy name.
Semantically identical; the fully-qualified form used everywhere else is the better one because it
can't be silently captured by a future column rename.

**Where the service-role key is used, and why.** Exactly one place — `worker/src/index.ts`:

```ts
// Service role key bypasses RLS — intentional; this worker runs server-side only.
// SUPABASE_SERVICE_ROLE_KEY must never appear in app (browser) code.
const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

Justification, concretely: the worker processes a file on behalf of an org with **no user session
attached** — the uploading user's JWT is never handed to it — so no `auth.uid()` exists for an RLS
policy to evaluate. It also needs `EXECUTE` on the `replace_*` functions, which are granted to
`service_role` only. The compensating control is that every one of those functions re-checks
ownership in SQL (`upload % does not belong to org %`) rather than trusting the caller.

`grep -rn "SERVICE_ROLE\|service_role" app/src` returns nothing. That invariant holds today and is
the one to keep holding.

---

## 4. Data access and authorization

**The browser client** is created once, module-scope, with the anon key:

```ts
// app/src/lib/supabase.ts
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
```

It is typed with the generated `Database`, so a wrong column name is a compile error rather than a
runtime 400. Session handling lives in `__root.tsx`, which owns the only auth state in the app and
exposes it via context:

```ts
export const SessionContext = createContext<Session | null>(null);
export const useSession = () => useContext(SessionContext);
```

Route protection is client-side only: `__root.tsx` holds `session` as `Session | null | undefined`
(`undefined` = still checking), renders nothing until resolved, and redirects to `/login` when there
is no session on a non-auth route. There is no server-side route guard — **RLS is the actual
security boundary**, and the redirect is a UX affordance.

**How `org_id` is derived** — the same four lines in every page that needs data:

```ts
const { data: membership, error } = await supabase
  .from("memberships")
  .select("org_id")
  .eq("user_id", session!.user.id)
  .single();
if (error || !membership) { setLoadError("We couldn't find your organisation. Please refresh."); return; }
setOrgId(membership.org_id);
```

`.single()` encodes the current assumption: one membership per user. The schema permits many
(`UNIQUE (org_id, user_id)`, plus a comment about bookkeepers serving two clients), so this call
will need an org switcher before multi-org is real. Repeated verbatim in `chat.tsx`,
`files/index.tsx`, `reports/$reportId.tsx`, `files/$type.tsx`, `history.tsx` — a hook is the obvious
consolidation and does not exist yet.

`org_id` is then passed explicitly into every query (`.eq("org_id", orgId)`) *and* enforced again by
RLS. Belt and braces: the filter is for correctness and index use, the policy is for security.

**Writes from the browser** go straight to Supabase too — upload to Storage first, insert the row
second, and roll back the file if the row fails:

```ts
const storagePath = `${orgId}/${Date.now()}-${safeFilename}`;
const { error: storageError } = await supabase.storage
  .from(STORAGE_BUCKET).upload(storagePath, file, { upsert: false });
if (storageError) { console.error("[files] storage upload failed:", storageError.message); return; }

const { error: dbError } = await supabase.from("uploads").insert({
  org_id: orgId, filename: file.name, storage_path: storagePath,
  file_size_bytes: file.size, mime_type: file.type || null, source: "files",
});
if (dbError) {
  console.error("[files] DB insert failed:", dbError.message);
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
}
```

Inserting that row is what queues the job — there is no queue service; the `uploads` table *is* the
queue. Cancel is likewise a plain UPDATE guarded by status:

```ts
await supabase.from("uploads")
  .update({ status: "cancelled", response_message: "Upload cancelled — no data was saved." })
  .eq("id", id).in("status", ACTIVE_STATUSES);
```

**The one server function.** `sendChatMessage` in `app/src/routes/chat.tsx` exists for exactly one
reason: the Anthropic API key must not reach the browser.

```ts
const sendChatMessage = createServerFn({ method: "POST" })
  .validator((data: { message: string }) => data)
  .handler(async ({ data }) => {
    // Vite dev server doesn't inject non-VITE_ .env vars into process.env for
    // server functions. Load them the same way the worker does. In production
    // the host (Vercel/Fly) already sets process.env, so this is a no-op there.
    if (!process.env.ANTHROPIC_API_KEY) {
      const { config } = await import("dotenv");
      const { join } = await import("path");
      config({ path: join(process.cwd(), "../.env") });
    }
    const { askAI } = await import("@bizpulses/ai");
    const response = await askAI(data.message, { task: "chat", system: "...", maxTokens: 512 });
    return { text: response.text };
  });
```

Two things to copy and one not to. Copy: the dynamic `import("@bizpulses/ai")` inside the handler,
which keeps the SDK out of the client bundle; and the dev-only dotenv fallback, which is a real
TanStack Start + Vite gap. Don't copy the `.validator` — `(data: { message: string }) => data` is a
type assertion, not validation; nothing checks the shape or length at runtime.

Note what this function does *not* do: it takes no `orgId`, reads no database, and gets no session.
Freeform chat currently has no access to the user's data — the system prompt tells the model to say
so. Any future server function that touches data will need to authenticate and derive `org_id`
itself; there is no established pattern for that here yet.

**The worker's separate path** is described in §5. It uses the service-role key, bypasses RLS, and
never shares code with the app beyond `@bizpulses/ai` and `@bizpulses/db`.

---

## 5. The worker service

One file, `worker/src/index.ts`, 1836 lines, run as a plain always-on Node process
(`tsx watch src/index.ts` in dev, `tsc` → `node dist/index.js` in prod). It is separate from Vercel
because classify + N extraction calls + reconcile routinely exceed any serverless timeout.

**Polling loop.** No queue, no webhooks, no LISTEN/NOTIFY. `setInterval(poll, 5_000)`, plus one
immediate `poll()` at boot so a restart picks up work without waiting:

```ts
console.log("Bizpulses worker starting…");
poll();
setInterval(poll, POLL_INTERVAL_MS);
```

Each cycle: clear stuck jobs → collect in-flight org ids → select the oldest `pending` upload whose
org is not in that list → claim it → run the pipeline.

**Concurrency serialization is per-org, not global.** One org's in-flight file must never delay a
different org's, but two files from the same org must not race each other into the same
`replace_*` date window:

```ts
const { data: inFlightRows } = await supabase.from("uploads")
  .select("org_id").in("status", ["classifying", "classified", "extracting"]);
const blockedOrgIds = [...new Set((inFlightRows ?? []).map((r) => r.org_id))];

const { data: pending } = await (
  blockedOrgIds.length > 0
    ? baseQuery.not("org_id", "in", `(${blockedOrgIds.join(",")})`)
    : baseQuery
).single();
```

The claim is a compare-and-set — `UPDATE ... WHERE id = ? AND status = 'pending'` returning the row;
if it comes back empty another poll won the race and this one returns. There is then an odd step 4
that resets the row back to `pending` so `runPipeline` can re-claim it through `markStatus`. It
works, but it opens a small window where a just-claimed job looks unclaimed, and it exists only to
keep `markStatus` as the single status-transition path. Worth simplifying.

`markStatus` itself is guarded so a completed or cancelled job can never be dragged backwards:

```ts
await supabase.from("uploads").update({ status, ...extra }).eq("id", uploadId)
  .in("status", ["pending", "classifying", "classified", "extracting"]);
```

**The pipeline.** `runPipeline()` is one long numbered sequence — classify → extract → dedupe →
reconcile → respond:

1. Claim (`pending → classifying`)
2. PDF size pre-check against stored `file_size_bytes` (10 MB inline-base64 ceiling)
3. Download from Storage
4. Re-check actual bytes
5. `prepareAttachment` — PDF → base64; XLSX → text via ExcelJS; `.xls` → `XlsFormatError`
6. **Cancel checkpoint** before the first AI call
7. `classify()` → report type, period, grain, date gaps, and `classifier_notes` describing the exact
   column layout. This call **writes the prompt cache**; extraction reads it.
   - `report_type === "unknown"` branches to `runTrack2Pipeline` (generic JSONB documents)
8. 24-month wide-period sanity check — flags, does not block
9. `extract()` — PDFs are one call with the cached attachment; CSV/Excel is split into
   `CHUNK_SIZE = 300`-row chunks with the header re-prepended to each, one AI call per chunk,
   **all rows accumulated in memory**, cancel checked before every chunk
10. `checkCompleteness()` — runs *before* the replace, while the old data still exists
11. **Cancel checkpoint** — last point at which nothing has been written
12. `supabase.rpc(RPC_NAMES[reportType], { p_org_id, p_upload_id, p_period_start, p_period_end, p_rows })`
    — the atomic DELETE+INSERT. (12b: invoice files carrying a freight column cross-write into
    `freight_cost_rows`.)
13. **Dedupe** — `findAndStampSuperseded()` finds earlier `complete`, non-superseded uploads of the
    same type whose period overlaps (`.lte("period_start", periodEnd).gte("period_end", periodStart)`),
    stamps them `superseded_by = <new id>`, and returns a plain-English summary
14. **Reconcile** — `maybeReconcile()` only fires when both sides of a pair exist (counted with
    `select("*", { count: "exact", head: true })`), then writes a row into `reconciliation_results`
15. `computeFieldCoverage()` over all extracted rows — the authoritative source for any completeness
    claim in the response
16. `askAI(respondPrompt, { task: "chat", maxTokens: 512 })` → the bookkeeper message, stored in
    `response_message`, then `status = 'complete'`

Everything the pipeline learned (superseded summary, reconciliation outcome, field coverage, wide-period
flag, date gaps, at most one "insight opportunity") is folded into that one prompt rather than
concatenated as templated strings. That is a deliberate design choice, documented in DECISIONS.md.

**Progress messaging.** `updateProgressMessage()` writes `uploads.progress_message` after
classification and after each chunk; the browser polls the row and renders it. This is the only
"push" mechanism — no realtime subscriptions are used anywhere in the codebase.

**Stuck-job handling.** A crashed worker would otherwise leave an org permanently blocked, since the
poll loop excludes orgs with in-flight rows. So `clearStuckJobs()` runs at the top of every cycle:
anything in `classifying`/`classified`/`extracting` with `uploaded_at` older than
`STUCK_TIMEOUT_MINUTES = 15` is marked `failed`, with the UPDATE guarded by `.eq("status", job.status)`
so a job that completed between the SELECT and the UPDATE isn't clobbered. The code is candid that
`uploaded_at` is a proxy for "processing started" and that 15 minutes absorbs the difference.

**Cancellation** is cooperative: the UI sets `status = 'cancelled'`, and the worker checks
`isCancelled(uploadId)` at each checkpoint, throwing `UploadCancelledError`. The catch block treats
it as a clean exit — the UI already wrote the status and message, so the worker writes nothing.
Because all rows are held in memory until step 12, a cancel before that point guarantees zero
database effect.

**The worker does not hot-reload.** This is the single most important operational fact about this
repo. `app` is Vite and updates itself; the worker is a plain Node process. After **any** change
under `worker/src/` — chunking, cancel checkpoints, prompts, poll loop, timeouts — you must:

1. `Ctrl+C` in the terminal running `npm run dev:worker`
2. `npm run dev:worker` again, and see `Bizpulses worker starting…`

Testing a worker change against the old process produces a result that looks like a pass or a
failure for entirely the wrong reason, and burns a full upload cycle. CLAUDE.md §6 requires
confirming the restart happened before asking anyone to test.

---

## 6. TypeScript conventions

`strict: true` in all four tsconfigs. The app targets `moduleResolution: "Bundler"` with `paths`
mapping `@bizpulses/ai` and `@bizpulses/db` at source; `worker` and `packages/ai` use `NodeNext`.
No ESLint config exists in the repo (a few `eslint-disable-next-line` comments are present but no
linter runs).

**Generated database types.** `packages/db/src/index.ts` is 958 lines of `supabase gen types
typescript` output. Never hand-edited. `scripts/db-types.js` writes it via the Management API
(`--project-id`), so no Docker is needed; it requires `SUPABASE_ACCESS_TOKEN`.

**The mandatory pairing.** `npm run db:migrate` chains `db:types` for a reason: both clients are
constructed as `createClient<Database>(...)`, so the generated types are what turns a misspelled
column or a stale column name into a compile error instead of a runtime PostgREST 400. Running a
migration without regenerating means the types describe a schema that no longer exists and
`typecheck` starts lying. If `db:types` fails (usually a missing `SUPABASE_ACCESS_TOKEN`), fix that
and run `npm run db:types` manually **before writing any new queries** — CLAUDE.md §2.5.

The worker leans on this hard, deriving its own types from the generated schema rather than
restating them:

```ts
type TableName  = keyof Database["public"]["Tables"];
type DbFunction = keyof Database["public"]["Functions"];

const RPC_NAMES: Record<ReportType, DbFunction> = { sales: "replace_sales_rows", /* ... */ };
const TABLE_INFO: Record<ReportType, { table: TableName; dateCol: string }> = { /* ... */ };
```

Renaming a stored function in a migration therefore breaks `typecheck` at the map. That is the
single best type-safety idea in the codebase.

**Validation: essentially none.** No zod, no valibot, no runtime schema checking anywhere.

- The one server function's `.validator()` is a pass-through type assertion.
- AI responses are parsed with `JSON.parse` plus a bracket-slicing fallback
  (`parseExtractResult`, `classify`), and are then trusted as `Record<string, unknown>[]` and handed
  straight to Postgres.
- **The database is the validation layer.** `NOT NULL`, CHECK constraints, `::NUMERIC` / `::DATE`
  casts inside the `replace_*` functions, and `NULLIF(..., '')` are what actually reject bad model
  output — a malformed row raises in SQL and rolls the whole transaction back.

That works, but it means a bad extraction surfaces as a Postgres error string rather than a
structured, per-row diagnosis. Casting is done with `as unknown as Json` at the RPC boundary; there
are two `any` escapes (the adaptive-thinking param in `packages/ai`, and the Recharts tooltip
`content` prop), both commented with why.

---

## 7. Error handling and observability

**Worker: typed errors → two distinct messages.** Named error classes carry the failure mode
(`PdfTooLargeError`, `NoDataError`, `ClassifyParseError`, `ExtractParseError`, `XlsFormatError`,
`UploadCancelledError`), and one catch block at the end of `runPipeline` maps each to a plain-language
sentence a non-technical owner can act on:

```ts
} else if (err instanceof XlsFormatError) {
  message = "This file is in the old Excel format (.xls). Please open it in Excel or Google Sheets, " +
            "save it as .xlsx or CSV, and upload again.";
}
```

Two columns, two audiences — this is the pattern worth copying:

- `uploads.response_message` — what the user reads. Always written, on success *and* failure. The
  product rule is "never silent": no infinite spinner, no bare error code.
- `uploads.error_message` — the technical string (`${err.name}: ${err.message}`), and for parse
  failures the first 3000 characters of the raw model response are folded in, so a bad extraction is
  diagnosable from the database later without anyone having had a terminal open.

Everything else is `console.log` / `console.warn` / `console.error`, ~30 call sites, all prefixed
with the upload id: `[${uploadId}] Claimed — ${filename}`, `[${uploadId}] → ${rows.length} rows`,
`[${uploadId}] Complete ✓`. Non-fatal failures degrade rather than throw — a failed
`progress_message` write is a `console.warn` and the pipeline continues.

**App: local error strings, and some silence.** Pages hold a `loadError` string and render a banner;
auth pages surface `error.message` from Supabase directly. There is no error boundary, no toast
system, no retry. And there are genuinely silent paths — `uploadSingleFile` logs a storage or insert
failure to the console and returns, with nothing shown to the user; `downloadExcel` catches, logs,
and leaves the button looking like it worked. Those are bugs by the project's own "never silent"
standard, not conventions.

**What monitoring exists: nothing beyond the above.** No Sentry, no error tracking, no metrics, no
log aggregation, no alerting, no health check endpoint, no uptime monitor. Worker logs live only in
whatever terminal or host console is running the process; nothing ships them anywhere or retains
them. If the worker dies, the only signal is uploads sitting in `pending` — and no one is told.
`clearStuckJobs()` is the closest thing to self-healing, and it only converts a hang into a
user-visible failure message; it does not report anything to an operator.

AI token usage *is* returned by `askAI` (`inputTokens`, `outputTokens`, `cacheCreationTokens`,
`cacheReadTokens`) but no caller records it. Cost is invisible today.

---

## 8. Reports engine architecture

The newest and most deliberately designed part of the codebase. A report is **data, not a page**:
adding one means adding one object to a registry, not a route, a component, or a migration.

**The registry.** `app/src/lib/reportRegistry.ts` exports
`REPORT_REGISTRY: Record<string, ReportConfig>` — currently 11 reports, keyed by URL slug
(`sales-by-customer`, `customer-concentration`, `ar-vs-ap`, `margin-trend`, `landed-cost`,
`contribution-waterfall`, `sales-by-product`, `product-profitability`, `negative-margin`,
`stockout-risk`, `inventory-aging`). `reports/index.tsx` renders the catalog straight from
`Object.entries(REPORT_REGISTRY)`; `reports/$reportId.tsx` looks up `REPORT_REGISTRY[reportId]` and
renders "Report not found" if it misses. Neither page knows what any individual report is.

The contract each entry fills:

```ts
export interface ReportConfig {
  title: string;
  description: string;
  chartType: "bar" | "line" | "composed" | "grouped-bar" | "trend-line" | "stacked-waterfall" | "flagged-bar";
  chartCardLabel?: string;      // overrides the auto "Top N by X" header
  xKey: string;
  yKeys: string[];              // first = preferred; chart falls back to later entries when first has no data
  yLabels: string[];
  chartLimit?: number;
  windowSize?: number;          // pageable window instead of a fixed top-N slice
  sortable?: boolean;
  columns: ColumnDef[];
  barColorThresholds?: Array<{ below: number; color: string }>;
  barColorFallback?: string;
  chartReferenceLines?: Array<{ y: number; label: string; stroke: string; labelColor?: string }>;
  query: (orgId: string) => Promise<QueryResult>;
  generateHeadline: (rows: ReportRow[]) => Headline | null;
  excelFilename: string;
}
```

`ReportRow` is deliberately loose — `Record<string, string | number | null>` — so chart, table, and
Excel export all read the same object by key, and `ColumnDef.format` (`currency | number | date |
text | percent`) drives rendering in all three.

**The honesty channel.** `QueryResult` carries `{ rows, note, hasComparisonData? }`. `note` is
rendered as a banner above the chart and is how the product admits what it can't compute:

```ts
note = `Profit shown for ${(profitCoverage * 100).toFixed(0)}% of revenue — remaining rows have no matching cost data.`;
```

Related conventions worth keeping: `generateHeadline` is called even when `rows` is empty, so a
flag-list report can return a positive "all clear" headline instead of an empty state; and
`fetchPeriodData` returns `null` (not zeros) when no sales rows exist at all, so "no data for this
period" stays distinguishable from "data exists and profit is genuinely zero".

**Shared computations.** `app/src/lib/reportComputations.ts` holds what more than one report needs:
`fetchPeriodData`, `fetchProfitByCustomer`, `fetchProfitByProduct`, `fetchFreightByCustomer`,
`fetchInventorySnapshot`. Its core is the **three-tier profit fallback join** (appended verbatim
below), applied per sales row:

1. `gross_profit` stated directly on the row
2. `unit_cost × quantity` from the row
3. `product_costs` nearest-effective-date lookup by SKU — costs are fetched **unfiltered by date**
   because a June sale may need a January cost snapshot, and the per-SKU list is sorted
   **newest-first** so `list.find(e => e.effective_date <= saleDate)` returns the most recent
   applicable cost. (DECISIONS.md records that getting this sort backwards was a real bug.)
4. otherwise `null` — the row counts toward revenue but not profit

Coverage is tracked as it goes (`profit_revenue` vs `total_revenue`) and becomes `profitCoverage`,
which drives the note *and* real decisions: Customer Concentration only uses profit as its basis at
`profitCoverage >= 0.99`, because partial coverage would make customers with missing costs look like
they have zero share.

**Known inconsistency:** `margin-trend` re-implements the entire three-tier join, cost map, and
nearest-date lookup inline in the registry, with a comment admitting it ("identical logic to
fetchProfitByCustomer"). `ar-vs-ap` also queries Supabase directly from the registry. The
`reportComputations` version is the better one — the inline copy is a second place to fix the join
if the logic ever changes.

**`useEntityRanking`.** The one custom hook. Any report that shows a long, user-sortable, paged list
of entities gets sorting and windowing from it, entity-agnostic:

```ts
const ranking = useEntityRanking(rows, config);   // config supplies yKeys, windowSize, sortable
const { sortedRows, windowedRows, canPrev, canNext, windowStart, windowEnd, goToPrev, goToNext, toggleSort } = ranking;
```

It returns both the full sorted list (for the table) and the current window (for the chart), sorts by
the first `yKey` that actually has data (`activeSortKeyIndex`), and resets to page 1 on a sort flip.

**The chartType system.** `ReportChart` in `reports/$reportId.tsx` is a single component that
switches on `config.chartType`, sharing one axis/grid/tooltip config across all branches:

| chartType | Renders | Row-order rule |
|---|---|---|
| `bar` (default) | single Recharts `Bar` on the active yKey | re-sorted descending, top `chartLimit` |
| `line` | single `Line` | re-sorted descending, top `chartLimit` |
| `trend-line` | time series, `connectNulls={false}` so gaps break the line rather than drawing a misleading bridge | `rows.slice(-limit)` — chronological, newest window |
| `grouped-bar` | every yKey side by side | preserved (bucket order is load-bearing) |
| `composed` | bars for `yKeys[0]` + line for `yKeys[1]` + `ReferenceLine` at 70% | preserved (cumulative % depends on it) |
| `stacked-waterfall` | three stacked bars (profit / freight / COGS) summing to revenue | preserved; pre-sorted and pre-windowed by the page |
| `flagged-bar` | per-bar `<Cell>` colors from `barColorThresholds` (first `value < below` wins) plus `chartReferenceLines` | preserved (pre-sorted by the query) |

The rule underneath: **`bar` and `line` may re-sort; every other type must not**, because their row
order carries meaning. The two config-driven types (`flagged-bar`, `stacked-waterfall`) are the
newest and the most reusable — thresholds and reference lines are declared as data in the registry,
so a new flag report needs no chart code at all.

**Excel export** is `exceljs` in the browser, driven by the same `columns` array, downloaded via a
Blob object URL. No server round-trip.

**Gap to know about.** `QueryOpts { dateFrom, dateTo }` is fully implemented in
`reportComputations.ts`, but `ReportConfig.query` is typed `(orgId: string)` and no caller ever
passes options — `grep -rn "dateFrom" app/src` hits only `reportComputations.ts`. TODO.md's Current
State block lists a "date-range selector" as complete in Phase B; it is not wired into the reports
engine. TODO.md also refers to the AI module as `aiProvider.ts`, which does not exist — it is
`packages/ai/src/index.ts`. Trust the code over TODO.md.

---

## 9. Testing and quality gates

Plainly: **there is no automated test suite, and no CI.** No test runner is installed in any
workspace, no `*.test.ts` / `*.spec.ts` file exists, there is no `.github/` directory, and no
pre-commit hook. Nothing runs automatically on commit or push.

What actually functions as a quality gate:

1. **`npm run typecheck`** (`tsc --noEmit` across all workspaces). Because both Supabase clients are
   typed with the generated `Database`, this catches the failure mode that would otherwise dominate:
   wrong column names, wrong RPC names, wrong argument shapes, drift after a migration. It is the
   real gate, and it is only as good as the freshness of `packages/db/src/index.ts` (§6).
2. **Database constraints as runtime tests.** `NOT NULL`, CHECK constraints, the ownership guard in
   every `replace_*` function, and `::NUMERIC` / `::DATE` casts reject bad AI output at write time
   and roll the transaction back.
3. **Manual verification against the live database.** The documented method for anything structural:
   `npx supabase db query --project-ref mgolkkfihzlnglgggprg --linked "SELECT ..."`. Migration
   comments record it being used — "Constraint name confirmed from live pg_constraint query".
4. **A standing manual test dataset.** `test-files/` holds 13 hand-built CSVs (sales for four
   months, invoices, AR/AP aging, inventory, freight, POs, product costs) with `TEST_DATASET.md`
   documenting the intended storylines — deliberately planted concentration, margin, shortfall and
   cost-variance signals — so a new report can be checked against a known expected answer. This is
   the closest thing to a fixture suite, and it is exercised by hand.
5. **`DECISIONS.md` as a regression record.** 128KB, newest-first, one entry per non-obvious call,
   including bugs found and why the fix was chosen. It is the institutional memory that the absent
   test suite would otherwise hold.

Everything else — does the upload land, does the chart render, does the bookkeeper message read
sensibly — has been verified by a person clicking through the app with both `dev:app` and
`dev:worker` running. That has worked at this size. It does not scale, and the three-tier profit
join, `splitTextIntoChunks`, `findAndStampSuperseded`, and the reconciliation math are all pure
functions that would be cheap to test and expensive to get silently wrong.

---

## 10. Environment and deployment

**Env var naming.** One `.env` at the monorepo root, gitignored from the first commit, with
`.env.example` committed and heavily annotated. Three groups:

| Variable | Used by | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `packages/ai` (worker + server fn) | Never reaches the browser. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | server-side | |
| `SUPABASE_SERVICE_ROLE_KEY` | worker only | Must never appear in `app/`. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | browser | Deliberate duplication — Vite only exposes `VITE_`-prefixed vars. The anon key is safe to ship; RLS is the boundary. |
| `SUPABASE_DB_PASSWORD` | `npm run db:migrate` | Session-pooler connection. |
| `SUPABASE_ACCESS_TOKEN` | `npm run db:types` | Personal token, account-level not project-level. |

No secret is ever inlined in a code file; the project ref `mgolkkfihzlnglgggprg` is hardcoded in both
scripts, which is an identifier, not a secret.

**The `envDir` quirk.** Vite looks for `.env` next to `vite.config.ts` — i.e. `app/` — but the
`.env` lives at the monorepo root so the worker and scripts can share it. Hence:

```ts
export default defineConfig({
  // .env lives in the monorepo root (bizpulses-code/), one level above this file.
  // Vite defaults to looking next to vite.config.ts, so we point it up.
  envDir: "../",
  plugins: [tsConfigPaths(), tanstackStart(), react()],
});
```

`envDir` only covers `import.meta.env` for client code. It does **not** put non-`VITE_` vars into
`process.env` for server functions in dev — which is why `sendChatMessage` carries its own dotenv
fallback (§4), and why the worker calls `config({ path: join(__dirname, "../../.env") })` as its
very first statement, before any other import that might read `process.env`.

**Local setup, start to finish**

```bash
git clone <repo> && cd bizpulses-code
npm install                        # workspaces: app, worker, packages/*
cp .env.example .env               # fill in all seven values
npm run db:types                   # confirm SUPABASE_ACCESS_TOKEN works; regenerates packages/db
npm run typecheck                  # should be clean before you start
```

Then **two terminals, both required**:

```bash
# terminal 1 — the app (Vite, hot reloads)
npm run dev:app

# terminal 2 — the ingestion worker (does NOT hot reload)
npm run dev:worker      # expect: "Bizpulses worker starting…"
```

Running only one leaves the product half-broken in a confusing way: with no worker, uploads sit at
"Looking at your file…" forever; with no app, there is nothing to upload from. After **any** edit
under `worker/src/`, `Ctrl+C` terminal 2 and start it again (§5).

Applying a schema change:

```bash
npm run db:migrate     # push + regenerate types, in that order, never one without the other
npm run typecheck      # confirm no column-name drift
```

**Deployment: mostly not established here.** The intent is stated (CLAUDE.md §4: app on Vercel,
worker on Fly.io or Railway, landing page separately in Framer), but the repo contains **no**
deployment configuration — no `vercel.json`, no `fly.toml`, no `Dockerfile`, no Procfile, no
workflow file. `app` has `build` (`vite build`) and `start` (`vite preview`); `worker` has `build`
(`tsc`) and `start` (`node dist/index.js`). Whatever host runs the worker must supply `.env` values
as real environment variables and must restart the process on deploy.

**There is one environment, not two.** CLAUDE.md §2.4 requires staging separate from production, but
a single Supabase project ref is hardcoded in `scripts/db-migrate.js` and `scripts/db-types.js`, and
there is no second project, no branch, and no env switch. Today, local development runs against the
same database everything else does. Flagging this as a known gap rather than describing it as a
convention.

---

## 11. What I'd do differently

### Patterns worth repeating

- **One AI module, enforced.** `askAI(prompt, { task })` with model routing as a private constant,
  and `@anthropic-ai/sdk` imported in exactly one file. Swapping models is a one-line change; the
  `task` names (`chat` / `analysis` / `reasoning`) let cost and capability be tuned centrally.
  Prompt caching is applied automatically inside the module rather than by callers.
- **Deriving types from generated schema types.** `Record<ReportType, DbFunction>` and
  `Record<ReportType, { table: TableName }>` turn a renamed table or stored function into a compile
  error. Cheap, and it substitutes for a lot of tests.
- **Atomic `replace_*` stored functions with an in-SQL ownership guard.** DELETE+INSERT in one
  transaction, plus `RAISE EXCEPTION` if the upload doesn't belong to the org. The database
  enforces the invariant even though the only caller bypasses RLS.
- **Accumulate everything in memory, write once.** Extraction holds all rows until a single RPC, so
  a failed chunk or a mid-flight cancel leaves the database exactly as it was. Cancel checkpoints
  placed immediately before each irreversible step.
- **Two error messages, two audiences.** `response_message` (plain language, always written) and
  `error_message` (technical, with the raw model output folded in for parse failures). Failures are
  diagnosable from the database days later.
- **The registry pattern for reports.** New report = one object. The catalog page, the detail page,
  the chart, the table, and the Excel export all derive from the same config.
- **`note` as a first-class field.** Making "here's what I couldn't compute and why" part of the
  data contract, and letting coverage thresholds change the metric's basis, is a genuinely good idea
  for a product that claims to be trustworthy.
- **`DECISIONS.md`.** A dated, newest-first log of non-obvious calls including the ones that were
  wrong. In a codebase with no tests, this is what stops a fix from being silently undone.
- **Migrations that explain themselves.** Every file opens with a paragraph on why, not just what.

### Technical debt not to carry forward

- **No tests, no CI.** The highest-value gap. `aggregateProfitBy`, `splitTextIntoChunks`,
  `findAndStampSuperseded`, and the reconciliation math are pure and easy to test; a wrong sort
  direction in the cost lookup has already caused a real bug. Even `typecheck` on push would help.
- **No monitoring at all.** If the worker dies, nothing notices and no one is told. Uploads simply
  stop being processed. Some error reporting and a worker heartbeat are overdue.
- **One environment.** No staging. Migrations, worker changes, and prompt changes are all exercised
  against the only database that exists.
- **Duplicated logic in `reportRegistry.ts`.** `margin-trend` re-implements the three-tier profit
  join inline; `ar-vs-ap` queries Supabase directly from the registry. Both should route through
  `reportComputations.ts`.
- **The `membership → org_id` lookup copy-pasted into five routes**, each with its own error string,
  and each using `.single()` even though the schema supports multiple memberships per user. This
  should be one `useOrgId()` hook.
- **Inline style objects duplicated across every route.** No shared components, no tokens. Changing
  the card style means editing four files.
- **Route files of 700–850 lines.** `chat.tsx` holds a server function, polling logic, upload
  handling, history loading, and all presentation; `$reportId.tsx` holds seven chart variants, an
  Excel exporter, and a page.
- **`.validator()` that validates nothing**, and no runtime validation of model output before it
  reaches SQL. Postgres catches it, but the diagnosis is poor.
- **Silent failures in the app.** Storage-upload, DB-insert, and Excel-export errors log to console
  and show the user nothing — contradicting the project's own "never silent" rule that the worker
  follows carefully.
- **`uploads.source` has no CHECK constraint** while every comparable column does.
- **The claim/reset dance in the poll loop** (claim → set back to `pending` → re-claim through
  `markStatus`) exists only to keep one status-transition path and opens a window where a claimed
  job looks free. Single-worker assumption throughout — two worker instances would race.
- **CHECK-constraint churn.** Adding a report type means dropping and recreating a constraint and
  restating every prior value. A lookup table, or a Postgres enum with `ADD VALUE`, would avoid the
  whole class of "constraint name from memory" errors that CLAUDE.md §2.5 exists to prevent.
- **Doc drift in `TODO.md`** — it names `aiProvider.ts` (doesn't exist) and claims a date-range
  selector is shipped (the plumbing exists, nothing calls it). The code is the source of truth.

---

## Appendix — verbatim excerpts

### A. `CLAUDE.md`

````markdown
# Bizpulses — Project Rules for Claude Code

This file is read automatically by Claude Code at the start of every session in this
project. It is the standing brief — you should not need to re-explain these rules in
chat. If anything here conflicts with an instruction given in a session, pause and
flag the conflict rather than silently picking one.

## 0. Who you're working with

The project owner has zero coding experience. Explain what you're doing in plain
language as you go — not deep technical jargon — and prefer small, reviewable steps
over large, silent changes. Never assume familiarity with terms like "migration,"
"environment variable," or "endpoint" — briefly say what they mean the first time
you use them in a session.

## 1. Where the source of truth lives

- The full product specification lives in `/docs/Bizpulses_Product_Guide.docx`.
  This filename stays constant — when the guide is revised, the file is replaced
  in place rather than saved under a new name. Full revision history is preserved
  via git, not via multiple filenames.
- Market research and competitive context lives in
  `/docs/Bizpulses_Market_Research.docx`. Same rule applies — replace in place on
  revision, don't create a new versioned filename.
- At the start of any new session, or before starting a new feature, read the
  relevant sections of these docs rather than relying on memory of a past session
  or a chat conversation elsewhere — those don't carry over into this project.
- If the owner references a decision "from our chat" that isn't reflected in
  `/docs`, ask them to drop in an updated doc rather than guessing at what was
  decided.

## 2. Non-negotiable architecture rules

### 2.1 AI provider abstraction — do not skip this, even early
All calls to any AI provider (Claude, OpenAI, or others) MUST go through a single,
central module — not be called directly from individual pages, routes, or features.
- Create this early (ideally before the first real feature), not retrofitted later.
- Every feature calls a shared function/interface (e.g. `askAI(prompt, options)`),
  never a provider SDK directly.
- The specific provider and model in use is a configuration detail inside that one
  module, swappable without touching any calling code.
- Different tasks may be routed to different models/providers via this same layer
  (e.g. a cheaper model for routine chat, a stronger one for harder reasoning) —
  that routing logic also lives inside this module, not scattered across features.

### 2.2 Secrets and API keys
- Never write an API key, password, or token directly into a code file.
- All secrets live in environment variables, loaded from a `.env` file that is
  never committed to git (must be listed in `.gitignore` from the very first commit).
- If you ever generate code that contains a literal key or secret string, stop and
  flag it — that is always a mistake, not a shortcut.

### 2.3 Version control
- This project is a git repository from the first file. Every meaningful change is
  a commit with a clear, plain-language message (not "fix stuff" — say what
  changed and why).
- Commit at natural checkpoints — after a feature works, not mid-edit — so the
  owner always has a working state to roll back to.

### 2.4 Environments
- Maintain a clear separation between a test/staging setup and production
  (real customer data). New features and changes are verified in staging first.
- Never test experimental changes directly against production data.

### 2.5 Database changes
- All schema changes go through tracked migration files, never manual/ad hoc
  changes to the live database structure.
- `npm run db:migrate` automatically regenerates TypeScript types afterward
  (it chains `db:types`). Never run one without the other — the types in
  `packages/db/src/index.ts` must always reflect the live schema so that
  column-name mistakes in queries are caught at compile time, not at runtime.
  If `db:types` fails (e.g. `SUPABASE_ACCESS_TOKEN` not set), fix that and
  run `npm run db:types` manually before writing any new database queries.
- **For any catalog-level database query** (constraint names, column lists,
  index names, anything in `pg_constraint`, `pg_catalog`, or
  `information_schema`) — use the Supabase CLI's direct database connection,
  not the Supabase JS client and not Node.js scripts. The JS client goes
  through PostgREST, which does not expose system catalog tables by design.
  The confirmed working command pattern is:
  ```
  npx supabase db query --project-ref mgolkkfihzlnglgggprg --linked "SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.uploads'::regclass AND contype = 'c'"
  ```
  Note: `--linked` is required — without it the CLI errors. The project ref
  (`mgolkkfihzlnglgggprg`) is the Supabase project ID and is fixed for this
  project.
  Replace the SQL with whatever catalog query is needed. Do not improvise an
  alternative approach if this method is available — it has direct database
  access and has been confirmed to work in this project. Specifically: every
  migration that touches a CHECK constraint must confirm the live constraint
  name with this method before writing the DROP statement, not from memory,
  not from the prior migration file, and not from a JS-client workaround.

### 2.6 Build in small, working slices
- Follow the phased build sequence from the product spec (ingestion MVP → core
  reports → conversational layer → freeform query → personalization → stellar
  experience layer → reporting out → remaining intake channels → notifications →
  security polish → roles).
- At the end of each phase, there should be something the owner can actually see
  and click through — not a large batch of interdependent, untested code.
- Do not silently jump ahead to a later phase's features without flagging that
  you're doing so and why.

## 3. Communication style during sessions

- Before a large or structurally significant change (new architecture pattern,
  new major dependency, anything touching the AI-provider module, anything
  touching auth/security), explain the plan in plain language and wait for a
  go-ahead rather than proceeding silently.
- After completing a chunk of work, summarize in plain terms: what now works,
  what to click on or try to see it, and what's still not built yet.
- If you hit a genuine architectural fork (e.g. "this could be built two
  different ways with a real tradeoff"), surface it plainly rather than picking
  silently — the owner may want to bring it back to a planning conversation
  before deciding.
- **Default bias is toward building things correctly now, not deferring for
  speed.** Only defer a feature or fix if it genuinely cannot be built yet —
  e.g. it needs real usage data to design against, or depends on another
  undelivered piece. Never defer solely because it is more work right now or
  because a phase is already large. When proposing to defer, explicitly label
  the reason as one of:
  - **Genuinely blocked** — cannot be designed or built without something not
    yet available (data, dependency, user research).
  - **More effort required** — could be built now but would take extra work;
    the owner decides whether to pull it in.
  This labelling makes lazy deferrals catchable before they are accepted.
  Bizpulses is priced and positioned as a premium, trustworthy tool — customer
  experience and correctness take priority over shipping speed.

## 4. Stack decisions already made (do not re-litigate without flagging)

- Frontend: React + TanStack Start, hosted on Vercel.
- Landing page: built separately in Framer — not part of this codebase.
- Lovable is not used anywhere in this project.
- Database/Auth/Storage: Supabase (managed cloud, not self-hosted, for now).
- AI: Claude via the Messages API / Agent SDK, called only through the provider
  abstraction module described in 2.1 — architected so other providers (e.g.
  OpenAI) can be added later without a rewrite.
- Background/ingestion worker: a small always-on Node/TypeScript service
  (Fly.io or Railway), separate from the Vercel-hosted frontend, since ingestion
  and AI orchestration steps can run longer than a serverless function allows.

## 5. Naming consistency

The product name is "Bizpulses" — with a trailing "s" — everywhere: code comments,
database/table names, environment variable prefixes, page titles, repo name. Do not
use "Bizpulse" (no s) anywhere, including in generated boilerplate, sample data, or
placeholder text. If a scaffolding tool or template defaults to a different name,
correct it before committing.

## 6. Worker restart required after any worker change

The background worker (`worker/src/index.ts` and anything it imports) does **not**
hot-reload. Unlike the app (which Vite updates automatically), the worker is a plain
Node process that must be manually restarted whenever its code changes:

1. In the terminal running `npm run dev:worker`, press `Ctrl+C` to stop it.
2. Run `npm run dev:worker` again. You should see "Bizpulses worker starting…".

**Always confirm with the user that the worker has been restarted before asking them
to test any worker-side change.** Testing against the old process will appear to
succeed or fail for the wrong reasons and wastes a test cycle.

This applies to: cancel checkpoints, stuck-job timeout changes, chunking changes,
extraction logic, poll loop changes — anything in `worker/src/`.

## 7. First-session kickoff instruction

The owner's first message in a new Claude Code session on this project should be
close to:

> Read CLAUDE.md and the documents in /docs. Set up the initial project
> structure per the stack decisions in CLAUDE.md, including the AI provider
> abstraction module described in section 2.1, before building any feature.
> Confirm the plan with me in plain language before writing code.
````

### B. A representative migration — `supabase/migrations/20260901000004_inventory.sql`

Chosen because it shows the full checklist a new canonical report type follows: table → index →
RLS → grants → `uploads` CHECK-constraint recreate → `replace_*` stored function → function grants.

```sql
-- Inventory Report — new canonical report type
-- Point-in-time stock-level snapshot by SKU/product, not a transaction log.
-- Unlike every other canonical type, the primary identifier is flexible:
-- some ERP exports use SKU codes only, some use product descriptions only,
-- some include both. Both fields are nullable; a table-level CHECK constraint
-- enforces that at least one is always present — a row with neither is meaningless.
-- No reconciliation stored function is needed: inventory-vs-sales velocity
-- analysis is a query-time feature, not a data-integrity check at ingest time.

-- ─── inventory_rows ───────────────────────────────────────────────────────────

CREATE TABLE inventory_rows (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id         UUID    NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    org_id            UUID    NOT NULL REFERENCES organisations(id),
    sku               TEXT,
    description       TEXT,
    quantity_on_hand  NUMERIC NOT NULL,
    report_date       DATE    NOT NULL,
    last_receipt_date DATE,
    reorder_point     NUMERIC,
    unit_value        NUMERIC,
    CONSTRAINT inventory_rows_identifier_check
        CHECK (sku IS NOT NULL OR description IS NOT NULL)
);

CREATE INDEX idx_inventory_rows_org_sku ON inventory_rows (org_id, sku, report_date);


-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE inventory_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON inventory_rows
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.org_id = inventory_rows.org_id
              AND memberships.user_id = auth.uid()
        )
    );


-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_rows TO authenticated, service_role;


-- ─── uploads.report_type CHECK constraint ────────────────────────────────────
-- Constraint name confirmed from live trigger-violation test: uploads_report_type_check.
-- Postgres requires drop + recreate to add a value to a CHECK constraint.

ALTER TABLE uploads DROP CONSTRAINT uploads_report_type_check;

ALTER TABLE uploads ADD CONSTRAINT uploads_report_type_check
    CHECK (report_type IN (
        'sales', 'ar_aging', 'ap_aging', 'invoice', 'inventory',
        'product_costs', 'purchasing_po', 'received_po'
    ));


-- ─── replace_inventory_rows ───────────────────────────────────────────────────
-- Atomic delete-then-insert on report_date window, same pattern as all other
-- replace_* functions.
--
-- NULLIF on sku and description: an absent or empty-string field in the JSONB
-- becomes NULL rather than an empty string. This matters because the
-- inventory_rows_identifier_check constraint tests for IS NOT NULL — an empty
-- string would pass the check but be meaningless. NULLIF ensures that genuinely
-- absent identifiers are NULL, so the constraint fires correctly on any row
-- where neither field was found in the source.
--
-- last_receipt_date, reorder_point, and unit_value are all nullable; NULL is
-- the correct representation when the source file does not include them.

CREATE OR REPLACE FUNCTION public.replace_inventory_rows(
    p_org_id       UUID,
    p_upload_id    UUID,
    p_period_start DATE,
    p_period_end   DATE,
    p_rows         JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM uploads WHERE id = p_upload_id AND org_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'upload % does not belong to org %', p_upload_id, p_org_id;
    END IF;

    DELETE FROM inventory_rows
    WHERE org_id      = p_org_id
      AND report_date BETWEEN p_period_start AND p_period_end;

    INSERT INTO inventory_rows (
        org_id, upload_id, sku, description,
        quantity_on_hand, report_date,
        last_receipt_date, reorder_point, unit_value
    )
    SELECT
        p_org_id,
        p_upload_id,
        NULLIF(elem->>'sku', ''),
        NULLIF(elem->>'description', ''),
        (elem->>'quantity_on_hand')::NUMERIC,
        (elem->>'report_date')::DATE,
        (elem->>'last_receipt_date')::DATE,
        (elem->>'reorder_point')::NUMERIC,
        (elem->>'unit_value')::NUMERIC
    FROM jsonb_array_elements(p_rows) AS elem;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_inventory_rows(UUID, UUID, DATE, DATE, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_inventory_rows(UUID, UUID, DATE, DATE, JSONB) TO service_role;
```

### C. The profit-fallback join — `app/src/lib/reportComputations.ts` (lines 74–180)

```ts

// ── Cost map helpers ──────────────────────────────────────────────────────────
// Private to this module — no external caller exists yet.

function buildCostMap(costs: CostEntry[]): CostMap {
  const map = new Map<string, CostEntry[]>();
  for (const c of costs) {
    const list = map.get(c.product_sku) ?? [];
    list.push(c);
    map.set(c.product_sku, list);
  }
  // Newest-first so Array.find returns the most recent applicable cost.
  // YYYY-MM-DD strings sort correctly as plain strings.
  for (const list of map.values()) {
    list.sort((a, b) => b.effective_date.localeCompare(a.effective_date));
  }
  return map;
}

function lookupUnitCost(map: CostMap, sku: string | null, saleDate: string): number | null {
  if (!sku) return null;
  const list = map.get(sku);
  if (!list?.length) return null;
  // First entry where effective_date ≤ saleDate is the most recent applicable cost.
  return list.find(e => e.effective_date <= saleDate)?.unit_cost ?? null;
}

// ── Per-customer profit aggregation ──────────────────────────────────────────

export interface CustomerAgg {
  total_revenue:  number;
  total_profit:   number;
  profit_revenue: number; // revenue of rows where profit was computable
  order_count:    number;
}

export interface ProfitData {
  byEntity:       Map<string, CustomerAgg>; // keyed by customer name or product SKU
  grandRevenue:   number;
  grandProfitRev: number;
  profitCoverage: number; // 0–1 fraction of total revenue with computable profit
  note:           string | null;
}

// ── Profit aggregation by entity ──────────────────────────────────────────────
// getKey extracts the grouping key from each sales row (customer name, product
// SKU, etc.). Null key fields are handled by the caller via the ?? fallback.
//
// Three-tier profit fallback per row:
//   Tier 1 — gross_profit direct from the sales row
//   Tier 2 — unit_cost × quantity from the sales row
//   Tier 3 — product_costs nearest-effective-date join (always by product_sku,
//             regardless of the grouping key)
//   Tier 4 — null (row counted in revenue but not in profit)
async function aggregateProfitBy(
  orgId:  string,
  opts:   QueryOpts | undefined,
  getKey: (row: SalesRow) => string,
): Promise<ProfitData | null> {
  const data = await fetchPeriodData(orgId, opts);
  if (!data) return null;

  const { salesRows, productCosts } = data;
  const costMap = buildCostMap(productCosts);
  const byEntity = new Map<string, CustomerAgg>();

  for (const row of salesRows) {
    const key      = getKey(row);
    const revenue  = Number(row.revenue) || 0;
    const quantity = row.quantity != null ? Number(row.quantity) : null;
    const saleDate = row.sale_date;

    let rowProfit: number | null = null;
    if (row.gross_profit != null) {
      rowProfit = Number(row.gross_profit);
    } else if (row.unit_cost != null && quantity != null) {
      rowProfit = revenue - (Number(row.unit_cost) * quantity);
    } else {
      const pcCost = lookupUnitCost(costMap, row.product_sku, saleDate);
      if (pcCost != null && quantity != null) rowProfit = revenue - (pcCost * quantity);
    }

    const cur = byEntity.get(key) ?? {
      total_revenue: 0, total_profit: 0, profit_revenue: 0, order_count: 0,
    };
    cur.total_revenue += revenue;
    cur.order_count   += 1;
    if (rowProfit != null) {
      cur.total_profit   += rowProfit;
      cur.profit_revenue += revenue;
    }
    byEntity.set(key, cur);
  }

  const grandRevenue   = [...byEntity.values()].reduce((s, v) => s + v.total_revenue,  0);
  const grandProfitRev = [...byEntity.values()].reduce((s, v) => s + v.profit_revenue, 0);
  const profitCoverage = grandRevenue > 0 ? grandProfitRev / grandRevenue : 0;

  let note: string | null = null;
  if (profitCoverage === 0) {
    note = "Profit not available — add a Product Costing report, or make sure your sales export includes a gross profit or unit cost column.";
  } else if (profitCoverage < 0.99) {
    note = `Profit shown for ${(profitCoverage * 100).toFixed(0)}% of revenue — remaining rows have no matching cost data.`;
  }

  return { byEntity, grandRevenue, grandProfitRev, profitCoverage, note };
}
```

### D. RLS for one multi-tenant table — `uploads`

From `20260827000000_phase1_ingestion_schema.sql` (policy + enable), plus its grant from
`20260828000002_grant_table_permissions.sql` and the matching storage policies that scope raw files
by org folder.

```sql
-- ─── Row-Level Security ───────────────────────────────────────────────────────
-- All data tables use the same pattern:
--   "does a memberships row exist linking auth.uid() to this row's org_id?"
-- This means an Owner, GM, and Bookkeeper at the same org all pass.
-- A user from a different org has no matching membership row and sees nothing.
-- The worker's service role key bypasses RLS entirely — no policy needed for it.
ALTER TABLE uploads                ENABLE ROW LEVEL SECURITY;

-- uploads and all canonical data tables: same membership check.
CREATE POLICY "org_isolation" ON uploads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.org_id = uploads.org_id
              AND memberships.user_id = auth.uid()
        )
    );


-- from 20260828000002_grant_table_permissions.sql (uploads is one of the nine tables listed):
GRANT SELECT, INSERT, UPDATE, DELETE ON uploads TO authenticated, service_role;

CREATE POLICY "upload_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'bizpulses-uploads'
        AND EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.org_id::text = (storage.foldername(name))[1]
              AND memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "upload_select" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'bizpulses-uploads'
        AND EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.org_id::text = (storage.foldername(name))[1]
              AND memberships.user_id = auth.uid()
        )
    );

CREATE POLICY "upload_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'bizpulses-uploads'
        AND EXISTS (
            SELECT 1 FROM memberships
            WHERE memberships.org_id::text = (storage.foldername(name))[1]
              AND memberships.user_id = auth.uid()
        )
    );
```

### E. Root `package.json`

```json
{
  "name": "bizpulses",
  "private": true,
  "type": "module",
  "workspaces": [
    "app",
    "worker",
    "packages/*"
  ],
  "scripts": {
    "dev:app": "npm run dev --workspace=app",
    "dev:worker": "npm run dev --workspace=worker",
    "build:app": "npm run build --workspace=app",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "db:migrate": "node --env-file=.env scripts/db-migrate.js && node --env-file=.env scripts/db-types.js",
    "db:types": "node --env-file=.env scripts/db-types.js"
  },
  "devDependencies": {
    "supabase": "^2.116.0"
  }
}
```
