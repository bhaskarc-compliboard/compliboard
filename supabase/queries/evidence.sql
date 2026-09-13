/* ============================================================
   THE FOUR QUERIES M6 RENDERS FROM.  docs/EVIDENCE-LINKING.md §5.

   A file rather than strings in a route, for the reason the census is a file (AUDIT-CHECKS
   check 10): a query that lives only in code gets retyped, and a retyped query is a different
   question. M6 renders whatever these return, so a wrong join here is a wrong status on every
   screen.

   The comment block is /* */ and not -- on purpose: the Supabase CLI takes SQL as a positional
   argument, so a string starting with `--` is parsed as flags and the command prints its help.
   ============================================================ */

/* ---- Q1 · THE REQUIREMENTS LIST. Two independent facts per row, never one verdict. ----
   obligations.status answers "is this OWED". obligation_evidence_state answers "what has been
   SHOWN". The LEFT JOIN is load-bearing: an obligation with no evidence must produce a row of
   zeroes, not vanish. That row — "this applies to you, nothing has been shown for it yet" — is
   the common, permanent default and the reason 7.3 precedes M6. */
select o.id                                   as obligation_id,
       o.entity_id,
       o.status,                              /* applies | does_not_apply | undetermined | unknown */
       o.resolution_rationale,                /* "Ruled out by: industrial_stormwater = false" */
       o.determined_by -> 'switches_missing'  as facts_needed,
       r.requirement_name,
       r.citation,                            /* TEXT. Never a link until verified — §58.5 */
       r.category,
       coalesce(a.short_name, '(unassigned)') as agency,
       (r.status = 'verified')                as library_verified,  /* false on all 200, honestly */
       coalesce(s.live_evidence, 0)           as live_evidence,
       coalesce(s.expired_evidence, 0)        as expired_evidence,
       coalesce(s.contradicting_evidence, 0)  as contradicting_evidence,
       s.next_expiry
  from public.obligations o
  join public.requirement_templates r on r.id = o.requirement_template_id
  left join public.agencies a on a.id = r.agency_id
  left join public.obligation_evidence_state s on s.obligation_id = o.id
 where o.company_id = $1
   and o.applicable_to is null                /* OPEN obligations only. History stays. */
 order by case o.status when 'applies' then 1 when 'unknown' then 2
                        when 'undetermined' then 3 else 4 end,
          a.short_name nulls last, r.requirement_name;

/* ---- Q2 · WHAT IS SHOWN FOR ONE OBLIGATION. The expansion under a row. ----
   Corrected links are returned and labelled: a customer who fixes a mistake should see that
   they fixed it. A RENEWAL has a successor (superseded_by); a CORRECTION has only a sentence. */
select e.id,
       d.name                as document_name,
       e.contribution,                        /* satisfies | contradicts */
       e.matched_by,                          /* user | document_review | ai_match */
       e.match_confidence,                    /* NULL on every user link, by constraint */
       e.valid_from, e.valid_until, e.assessed_at,
       e.superseded_reason,
       case when e.superseded_by is not null      then 'renewed'
            when e.superseded_reason is not null  then 'corrected'
            when e.valid_until is not null
             and e.valid_until < current_date     then 'expired'
            else 'live' end  as link_state
  from public.obligation_evidence e
  left join public.documents d on d.id = e.document_id
 where e.obligation_id = $1
 order by (e.superseded_by is null and e.superseded_reason is null) desc,
          e.assessed_at desc nulls last, e.added_at desc;

/* ---- Q3 · THE COVERAGE STRIP. ----
   All 56 rows read `not_built` today and 0 carry a verifier. That is what the strip says, and
   saying it is the strip's whole job (CLAUDE.md §6). `partial` is NOT a coverage_status value —
   it appears in TODO's M6 example and in no enum — so a renderer maps these three and invents
   nothing. */
select a.short_name              as agency,
       c.status,                             /* not_built | generated | verified */
       c.row_count,
       c.last_verified_at,
       (c.verified_by is not null) as has_a_verifier
  from public.industry_coverage c
  join public.agencies a on a.id = c.agency_id
 where c.industry = $1
   and (c.jurisdiction_state = $2 or c.jurisdiction_state is null)
 order by case c.status when 'verified' then 1 when 'generated' then 2 else 3 end, a.short_name;

/* ---- Q4 · THE CORRECTION. Unlinking is a correction, never a deletion. ----
   *** WHAT THIS DELIBERATELY DOES NOT DO: IT DOES NOT REOPEN AN OBLIGATION. ***
   An obligation closed on the strength of a link later removed STAYS CLOSED. The history was
   true when it was recorded, and §47 makes applicable_to immutable for the same reason: a
   correction changes what is true NOW, not what was true THEN. Reopening would rewrite a period
   the customer may already have reported on.

   valid_until = current_date rather than a delete, so the row stays readable; superseded_reason
   is what separates a correction from a renewal. */
update public.obligation_evidence
   set valid_until       = current_date,
       superseded_reason = $3,
       assessed_at       = now()
 where id = $1
   and company_id = $2                        /* tenancy in the predicate, not in the caller */
   and superseded_by is null
   and superseded_reason is null              /* correcting a correction is a no-op */
returning id, obligation_id, superseded_reason;
