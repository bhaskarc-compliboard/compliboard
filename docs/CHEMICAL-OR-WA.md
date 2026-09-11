# Chemical Manufacturing Vertical — Oregon & Washington
**Version:** 1.4 · **Updated:** 11 September 2026
**Supersedes:** version 1.3 (11 Sep). Adds to §3.2 where the four jurisdiction facts come
from: state, county and city are geocoded from the address against the US Census Bureau
Geocoder, and fire authority is asked, because fire districts do not follow county lines.
Both failure paths leave the jurisdiction unknown and ask. Version 1.3 **rewrote §3.2's
match rule** — it described three
jurisdiction cases and migration 007 made five plus a nullable. `city` and `local` resolve
per SITE rather than per company, `local` may be a fire district that is neither a city nor
a county, and a NULL layer is not a jurisdiction case at all: those rows are contractual and
are gated by a switch, which the match key must pass through rather than decide. Also
records that the company's stated address is the source of truth and a website scan never
is. Version 1.2 corrected §4.4's reading of the model split; version 1.1 expanded §6.6
Multi-site. **Corrects §4.4** — the 174 / 11 / 3 model split was
described as "one enumeration with two validators." It is not: the merge was sequential, each
model adding what the previous ones missed, so the column is a build log rather than
authorship. What the split does carry is a convergence signal, and that is why no fourth model
was run. §3.1 replaces `sources[]` with `generated_by` (ai | manual), since the model name
drives no decision and trust is carried by `verification_status`. Version 1.1 expanded §6.6
Multi-site: adds the rule that **site is a
property of data, not of people** — which site you are looking at is a filter, never a
permission — plus switch scope (company-wide vs per-site), site naming, and what goes into
the schema now versus what waits for a customer to ask. Nothing else changed; 1.0 remains
correct as far as it went. Recorded as `DECISIONS.md` §20.

**Status: design only. Nothing in this document is built.**
**Scope:** Chemical manufacturing, blending, repackaging, and distribution in Oregon and Washington
**Covers:** Regulatory map → requirement library → AI call architecture → runtime behaviour → display → verification → change monitoring

---

## Part 0 — How to read this document

### 0.1 What this is

A single design document covering everything from "how does a requirement come into existence" to "what does the user see on screen." It is the reference for building vertical #1 properly, and the template for every vertical after it.

### 0.2 Where retrieval belongs, and why not here

Part 1 is written from domain knowledge, not live retrieval. That is deliberate, not a shortcut.

**Part 1's job is the frame** — which agencies exist, how the answer is structured, where Oregon and Washington diverge, and what to be suspicious of. That content is stable and belongs in prose.

**Specifics belong in rows, not prose.** A document saying "the deadline is March 1" goes stale silently and carries no check date. The same fact as a `requirement_templates` row with `citation_url`, `citation_quote`, and `source_checked_at` is auditable, re-checkable by the change monitor, and displays a verification badge in the UI. Verified specifics written into a design document are put somewhere they cannot be maintained.

**Primary-source retrieval happens at table creation (§4.5)** — a systematic pass of roughly 190 rows, each producing a source URL, the operative quote, and a check date, written directly into the library. Then continuously, via change monitoring (§7.1). Not once.

Two examples, retrieved live, showing what the pass yields:

**CFATS — a whole branch that must not be published.** CISA states that as of July 28, 2023, Congress allowed the statutory authority for the CFATS program (6 CFR Part 27) to expire, and CISA cannot enforce compliance at this time. A generator working from training data would very plausibly publish Top-Screen and Site Security Plan obligations as live requirements. This is why §10.8 calls for a standing "confirm before publishing" list.

**Oregon CR2K — the divergence claim confirmed and now citable.** OAR 837-085-0090(2) requires a covered employer who possessed a reportable hazardous substance during the previous calendar year to submit a Hazardous Substance Report by March 1 of the following year; ORS 453.317 adds "or within 60 days after the State Fire Marshal mailed the survey, whichever is later." Reportable quantities are 500 lb solid / 500 gal liquid / 500 cu ft gas, 500 lb or the TPQ (whichever is less) for EHS, and 10 lb / 5 gal / 20 cu ft for highly toxic materials and explosives. Federal EPCRA 312 is generally 10,000 lb — **Oregon is roughly 20× stricter**, so a facility below federal reporting can still owe the Oregon survey.

Also caught by retrieval: the Office of the State Fire Marshal separated from Oregon State Police into its own agency around 2023–24, and both URL structures remain live. Minor, but wrong agency attribution is the kind of detail that costs credibility on an otherwise correct page.

**Rule:** treat Part 1 as the generation frame and coverage checklist. Treat every date, fee, threshold, agency name, and citation in it as unverified until it exists as a row with a retrieved source.

### 0.3 The problem this design solves

Testing established a clear pattern:

| Task shape | Result |
|---|---|
| Reasoning **against an artifact** — label image, warehouse photo, room design | ~99% match to paid consultant work, plus findings the consultant missed |
| Enumerating **from nothing** — a text question with no document | B−: one wrong headline requirement with real cost attached, one invented premise, one miscitation, the key determination absent |

The gap is not knowledge. It is **anchoring**. The model reasons excellently against something and enumerates unreliably from nothing.

Every architectural decision below follows from one principle:

> **Never let the model enumerate from nothing. Always give it something to reason against — a document, an agency scope, a library row, or a draft to critique.**

---

# PART 1 — THE REGULATORY MAP

## 1.1 Why agency is the organizing frame

Requirements are finite and they cluster by regulator. A chemical manufacturer does not face an unbounded universe of obligations; it faces OSHA, EPA, DOT, the state environmental agency, the fire authority, and a short tail of others.

Agency does four jobs no other axis does:

1. **Bounds generation.** "Enumerate everything" fails. "Enumerate Oregon DEQ air quality obligations for this facility" succeeds. Bounded scope substitutes for the missing artifact.
2. **Makes omissions detectable.** A missing requirement inside a free enumeration is invisible. A thinly-covered agency in a known list is a visible gap.
3. **Matches how the user thinks.** A plant manager thinks "the DEQ inspection" and "the fire marshal visit," not "category: air emissions."
4. **Makes verification finite.** "Verify 188 requirements" has no finish line. "Verify the 41 DEQ rows" does.

**Agency is a field, not a folder.** Requirements sometimes have two enforcing agencies (`agency_id` primary, `secondary_agency_ids[]`). Storage stays one table; agency is a filter, a frame, and a coverage check.

---

## 1.2 Federal layer — applies in both states

This layer is generated **once** and serves Oregon, Washington, and every future state. Roughly half the requirement volume.

### OSHA — 29 CFR 1910 / 1904
**Important structural note:** Oregon and Washington are both **OSHA-approved State Plan states.** Federal OSHA does not directly enforce at private-sector chemical plants in either state. Oregon OSHA and Washington DOSH adopt federal standards and add their own, which are sometimes more stringent.

**Practical consequence for the library:** federal OSHA rules are the *baseline content*, but the citation shown to an Oregon or Washington customer must be the **state citation** (OAR 437 or WAC 296), not the 29 CFR one. Showing a Washington plant a 29 CFR citation is not wrong on substance but is wrong on enforcement authority, and a state inspector will notice.

This is the single most common error an AI generator will make on these two states. It must be handled explicitly in the generation prompt.

Core subject areas:
- Hazard Communication / GHS — written program, SDS, container labels, training
- Process Safety Management — threshold quantity dependent
- Respiratory Protection — written program, fit testing, medical evaluation
- Permit-Required Confined Spaces
- Control of Hazardous Energy (lockout/tagout)
- Personal Protective Equipment — hazard assessment, certification
- Emergency Action Plan / Fire Prevention Plan
- Flammable Liquids storage
- Hazardous Waste Operations and Emergency Response (HAZWOPER) — emergency response tier
- Substance-specific standards triggered by exposure — lead, benzene, hexavalent chromium, methylene chloride, silica, formaldehyde, cadmium, MDA, and others
- Machine guarding, electrical safety, walking-working surfaces
- Occupational noise exposure — hearing conservation above action level
- Bloodborne pathogens — if first aid responders designated
- Recordkeeping (29 CFR 1904) — injury and illness logs, posting, electronic submission

### EPA
- **RCRA** — hazardous waste generator category (VSQG / SQG / LQG), determined by monthly generation; manifests, accumulation limits, container management, weekly inspections, personnel training, contingency plan, biennial report (LQG), land disposal restrictions
- **TSCA** — inventory, PMN for new chemicals, SNURs, Chemical Data Reporting (quadrennial), Section 8(e) substantial risk reporting, recordkeeping; recent risk-management rules on specific substances
- **EPCRA** — Section 302 EHS notification, 311/312 SDS and Tier II inventory reporting, 313 Toxic Release Inventory (Form R / Form A), 304 release notification
- **Clean Air Act** — NESHAP subparts by process, NSPS, Title V or minor source permitting (administered by the state or local authority), Risk Management Program if a listed substance exceeds threshold quantity
- **Clean Water Act** — NPDES if direct discharge, stormwater industrial general permit, pretreatment standards if discharging to a POTW
- **SPCC** — oil storage above 1,320 gallons aggregate aboveground; written plan, PE certification unless self-certification criteria met
- **CERCLA** — reportable quantity release notification to the National Response Center
- **FIFRA** — if manufacturing, formulating, or repackaging pesticides: establishment registration, product registration, annual production reporting

### DOT / PHMSA — 49 CFR
- Hazmat registration (annual, if offering certain quantities/classes)
- Hazardous materials classification and packing group determination
- Proper shipping name, UN number, marking, labeling
- **Combination packaging rules** — inner packagings are not separately DOT-marked or labeled; the outer package carries the marking and label. This is the rule the earlier test output got wrong and it belongs in the library explicitly, phrased as a scope rule.
- Limited quantity and excepted quantity provisions
- UN specification packaging and closure instructions
- Shipping papers, emergency response information, emergency response telephone number
- Placarding thresholds
- Hazmat employee training and recurrent training with documentation
- Security plan if certain materials and quantities

### FMCSA — if own fleet
- USDOT number, operating authority as applicable
- Driver qualification files, medical certification
- CDL with hazmat endorsement, TSA security threat assessment
- Hours of service and electronic logging
- Drug and alcohol testing program, including Clearinghouse queries
- Vehicle inspection, repair, and maintenance records
- Cargo tank specification and periodic testing if applicable

### Conditional federal agencies
- **ATF** — explosives license/permit if applicable
- **DEA** — List I / List II chemical registration and recordkeeping
- **CPSC** — consumer product packaging, poison prevention packaging
- **FDA** — food contact substances, food facility registration if applicable
- **DHS / CISA** — chemical facility security. **VERIFY CURRENT STATUS:** the CFATS program's statutory authority lapsed in 2023 and the program's current status must be confirmed before any requirement is published. This is a high-risk item for a model to state confidently from training data.
- **Bureau of Industry and Security / Census** — export controls and AES filing if exporting

---

## 1.3 Oregon layer

### Oregon OSHA — OAR Chapter 437
Adopts federal standards with Oregon-specific additions. Cite OAR, not 29 CFR.

Oregon-specific or notably divergent areas:
- **Heat illness prevention** — Oregon rule with defined temperature triggers, water, shade, rest, acclimatization, and training requirements
- **Wildfire smoke** — Oregon rule with AQI-based triggers, exposure controls, respirator availability, training
- Agriculture-adjacent rules if the operation includes them
- Oregon-specific recordkeeping and posting requirements

### Oregon DEQ
- **Air:** Air Contaminant Discharge Permit (ACDP) — general, simple, or standard — or Title V for major sources. Annual reporting and fee obligations. **VERIFY the annual report and fee due dates** — this was a flagged disagreement in earlier generation work.
- **Cleaner Air Oregon** — Oregon's risk-based air toxics program, layered on top of conventional air permitting. Facility-specific emissions inventory and risk assessment obligations when called in. **This is a genuine Oregon distinctive with no Washington equivalent.**
- **Hazardous waste:** Oregon implements RCRA with state additions; EPA/state ID number, generator category, manifesting, reporting, and fee obligations
- **Water:** NPDES or WPCF permits; industrial stormwater general permit (1200-Z) with monitoring, benchmark sampling, and annual reporting
- **Underground storage tanks** — registration, permitting, operator training, release detection
- **Spill and release reporting** — Oregon Emergency Response System notification
- Solid waste, if applicable

### Oregon State Fire Marshal
- **Community Right to Know (CR2K) / Hazardous Substance Information Survey** — Oregon's hazardous substance reporting program. **Critically, Oregon reporting thresholds are lower than the federal EPCRA Tier II thresholds**, so a facility can be below federal reporting and still owe an Oregon survey. Annual filing window in the early part of the calendar year — **verify exact dates.**
- Oregon Fire Code adoption and enforcement, coordinated with local fire authorities

### Local fire authority
Portland Fire & Rescue, Tualatin Valley Fire & Rescue, and others, depending on address:
- Hazardous materials facility permits and operational permits
- Annual or periodic inspections
- High-piled storage, spray finishing, flammable liquid storage permits
- Hazardous materials management plan / hazardous materials inventory statement where required
- Fire protection system testing and maintenance records

### Local sewer / POTW
City of Portland BES, Clean Water Services, and others:
- Industrial wastewater discharge permit / pretreatment authorization
- Self-monitoring, reporting, slug discharge control plan

### Other Oregon
- **Secretary of State** — business registry, annual renewal
- **Department of Revenue** — including the Corporate Activity Tax, an Oregon-specific gross receipts tax with registration and filing obligations above a receipts threshold
- **BOLI** — wage and hour, sick time, Oregon Family Leave, required workplace postings
- **Paid Leave Oregon** — contributions and notice
- **Employment Department** — unemployment insurance
- **ODOT Motor Carrier** — intrastate motor carrier and hazmat transport obligations
- **Department of Agriculture** — pesticide and fertilizer registration, licensing; food safety licensing where applicable
- **Workers' compensation** — coverage requirement, posting
- **Local jurisdiction** — business license, zoning and conditional use, building and occupancy, stormwater

---

## 1.4 Washington layer

### Washington L&I / DOSH — WAC Title 296
Washington's state plan. Cite WAC, not 29 CFR.

Structurally different from Oregon in numbering and in several substantive areas:
- **WAC 296-800 Safety and Health Core Rules** — Washington's baseline employer obligations, including an accident prevention program requirement that has no direct federal analogue in the same form
- **Washington PSM rule** — Washington maintains its own process safety management rule which in some respects is broader than the federal standard. **This is a major OR/WA divergence and must not be treated as a copy of 29 CFR 1910.119.**
- **Outdoor heat exposure** — Washington rule with its own temperature triggers, distinct from Oregon's
- **Wildfire smoke** — Washington rule with its own AQI triggers, distinct from Oregon's
- **Hazard communication** — Washington's own GHS-aligned rule
- Boiler and pressure vessel, elevator, and electrical programs administered by L&I
- Washington-specific recordkeeping, posting, and reporting obligations

### Washington Department of Ecology
- **Dangerous waste — WAC 173-303.** **This is the single most important OR/WA difference in the entire library.** Washington's dangerous waste program is *broader than federal RCRA*: it includes state-only waste designations and state-only criteria beyond the federal listed/characteristic tests. A waste stream that is non-hazardous under federal RCRA and under Oregon's program can be a regulated dangerous waste in Washington.

  **Consequence:** generator category, accumulation limits, reporting, and fees can all differ for the same operation depending on which side of the Columbia it sits. Any generation prompt that treats Washington hazardous waste as "federal RCRA plus a state ID number" will produce wrong answers. This must be stated explicitly in the prompt.

- **Air:** Washington air permitting is largely administered by **regional clean air agencies**, not by Ecology directly, for most of the state — Puget Sound Clean Air Agency, Southwest Clean Air Agency, Spokane Regional Clean Air Agency, and others by county. **The correct air permitting authority is determined by the facility's county.** This is structurally different from Oregon, where DEQ is the default authority.
- **Water:** NPDES, industrial stormwater general permit, state waste discharge permits
- **Underground storage tanks** — Ecology program
- **Spill prevention and release reporting**
- Product-related programs — Washington has been active in chemical restriction and reporting programs; **verify current scope and applicability**

### Washington emergency planning and fire
- **EPCRA Tier II** — administered through Washington's State Emergency Response Commission / Emergency Management Division, with distribution to the LEPC and local fire department. Federal thresholds apply unless the state has adopted lower ones — **verify.**
- **Washington State Patrol / Fire Protection Bureau** — state fire marshal functions, code adoption
- **Local fire authority** — operational permits, hazardous materials inventory statements, inspections, code enforcement, determined by jurisdiction

### Other Washington
- **Secretary of State** — business registration, annual report
- **Department of Revenue** — **Business & Occupation tax**, Washington's gross receipts tax. Washington has no corporate income tax; the B&O structure is materially different from Oregon's CAT and has its own classification, registration, and filing obligations.
- **L&I** — workers' compensation is a **state fund** in Washington, structurally different from Oregon's private-carrier market. Registration, quarterly reporting, and premium obligations by risk classification.
- **Paid Family and Medical Leave** — Washington program, contributions and reporting
- **WA Cares Fund** — long-term care program contributions; **verify current status and obligations**
- **Employment Security Department** — unemployment insurance
- **Utilities and Transportation Commission** — intrastate motor carrier obligations
- **Department of Agriculture** — pesticide and fertilizer registration and licensing; food processing licensing where applicable
- **Department of Health** — where applicable
- **Local jurisdiction** — business license (Washington has a consolidated state business licensing system that covers many cities), zoning, building, stormwater

---

## 1.5 The OR/WA divergence table — the highest-risk content in the library

These are the items where a Washington answer derived from Oregon content is **wrong**, not merely imprecise. Every one is a mandatory review point.

| Domain | Oregon | Washington | Risk if conflated |
|---|---|---|---|
| **Hazardous waste scope** | RCRA-based with state additions | **Dangerous waste — broader than RCRA, state-only designations** | Waste treated as non-regulated that is regulated. Direct enforcement exposure. |
| **Air permitting authority** | DEQ (with Lane Regional in one area) | **Regional clean air agencies by county** | Permit sought from the wrong agency; missed local requirements |
| **Air toxics program** | **Cleaner Air Oregon** — risk-based, Oregon-only | Different approach | Oregon-only obligation applied to WA, or WA facility told it has none |
| **Process safety** | Federal-aligned | **Washington-specific PSM rule, broader in parts** | Under-scoped PSM program in Washington |
| **Chemical inventory reporting** | **OSFM CR2K/HSIS, thresholds below federal** | EPCRA Tier II via EMD | Oregon facility below federal threshold wrongly told it has no reporting |
| **OSHA citation authority** | OAR 437 | WAC 296 | Wrong citation shown; loses credibility with inspectors |
| **Heat / wildfire smoke** | Oregon rule, Oregon triggers | Washington rule, different triggers | Wrong trigger temperature or AQI in the SOP |
| **Workers' comp** | Private carrier market | **State fund** | Wrong process entirely |
| **Gross receipts tax** | Corporate Activity Tax | **B&O tax** | Wrong registration, wrong filing |
| **Business licensing** | State + local separately | Consolidated state system covering many cities | Wrong process |

**Design rule:** Washington content is generated independently, never derived from Oregon content. The generation prompt must state that Oregon analogues are not to be assumed.

---

# PART 2 — THE SWITCH MODEL

## 2.1 Why switches exist

In the existing chemical data, **182 of 188 requirements are conditional.** Only 6 apply universally. The requirement list is therefore not the product — **applicability determination is the product.**

Two chemical companies at the same Portland address in the same industry can owe 40 obligations and 150 obligations respectively. Geography cannot distinguish them. Only business facts can.

## 2.2 Switch definition

A switch is a fact about the company that determines whether requirements apply. It is defined once in a library table and valued once per company.

```
switches (library)
  id                    hazwaste_generator_category
  label                 "Hazardous waste generator category"
  type                  enum
  allowed_values        [VSQG, SQG, LQG]  -- OR
                        [SQG, MQG, LQG]   -- WA uses different terminology; verify
  question_plain        "How much hazardous waste do you generate per month?"
  determination_source  documents | profile | user_answer | computed_by_requirement
  volatility            static | annual | monthly
  jurisdiction_variant  true   -- this switch means different things in OR vs WA
```

```
company_switches (per company)
  company_id, switch_id
  value
  state          known | unknown | needs_user
  confidence     high | medium | low
  basis          "SDS inventory shows 1,400 lb methylene chloride; manifest log shows
                  ~180 kg/month waste generation"
  source         ai_from_documents | ai_from_profile | user_set | computed
  determined_at, expires_at
  user_locked    boolean
```

## 2.3 The four states — and why `unknown` is a safety feature

| State | Effect on dependent requirements |
|---|---|
| **known-true** | Requirement applies |
| **known-false** | Requirement marked not-applicable, **with the contradicting evidence recorded** |
| **unknown** | Requirement is **undetermined** — never "does not apply" |
| **needs_user** | Surfaced as a question on the switches screen |

This encodes the product's core safety rule directly in the data model: a false green is far more dangerous than a false gap. Absence of evidence never produces a clear.

## 2.4 The switch list — chemical manufacturing, OR & WA

**Universal (reused by every vertical):**
1. `entity_state` — Oregon / Washington
2. `entity_county` — drives fire authority, and in WA the air authority
3. `employee_count` — banded: 1–10 / 11–19 / 20–24 / 25–49 / 50–99 / 100+
4. `multi_site` — more than one facility
5. `multi_state` — operations in more than one state
6. `owns_fleet` — company-operated vehicles
7. `cdl_drivers` — employs CDL drivers
8. `imports_exports`
9. `holds_iso_certification` — 9001 / 14001 and similar
10. `owns_vs_leases_facility` — affects some permit and tank obligations
11. `has_contract_flowdowns` — customer-imposed audit or compliance requirements

**Chemical-specific:**
12. `business_type` — manufacturer / blender / repackager / distributor / toll processor
13. `hazwaste_generator_category` — **jurisdiction-variant; WA designation criteria are broader**
14. `psm_rmp_threshold` — listed substance above threshold quantity
15. `tier2_epcra_threshold` — federal thresholds
16. `or_cr2k_threshold` — **Oregon only, lower than federal**
17. `tri_reportable` — TRI-listed chemicals above thresholds, including recent additions
18. `tsca_regulated_substances` — substances under current TSCA risk-management rules
19. `ehs_above_tpq` — extremely hazardous substances above threshold planning quantity
20. `oil_storage_1320gal` — SPCC trigger
21. `underground_storage_tanks`
22. `aboveground_storage_tanks`
23. `air_permit_required` — and which tier
24. `air_toxics_program_applicable` — **Oregon: Cleaner Air Oregon call-in status**
25. `wastewater_discharge` — direct (NPDES) / to POTW (pretreatment) / none
26. `industrial_stormwater` — exposure of materials to precipitation
27. `ships_placardable_hazmat`
28. `cargo_tanks_or_rail`
29. `explosives_atf`
30. `dea_list_chemicals`
31. `pesticide_products_fifra`
32. `food_contact_or_food_grade`
33. `consumer_products_cpsc`
34. `boilers_pressure_vessels`
35. `onsite_laboratory`
36. `refrigeration_over_50lb`
37. `confined_spaces_present`
38. `respirator_use`
39. `noise_above_action_level`
40. `substance_exposure_above_action_level` — lead, benzene, hexavalent chromium, silica, formaldehyde, and others; multi-value
41. `outdoor_work` — heat and wildfire smoke rules
42. `hot_work_welding`
43. `spray_finishing`
44. `high_piled_storage`
45. `flammable_liquid_quantity_band` — drives fire code permits
46. `emergency_response_team` — HAZWOPER responder tier vs evacuation-only

Approximately 46 switches. **Most are determined from documents and profile without asking the user anything.** The genuinely user-facing question count is expected to be 5–8 for a typical company.

## 2.5 Determination requirements — the dependency chain

Some requirements *produce* switch values. Generator category is determined monthly by measurement; PSM applicability is determined by a threshold calculation; air permit tier is determined by a potential-to-emit calculation.

Model with `requirement_templates.produces_switch`. Resolution runs in passes:

1. Resolve everything against currently-known switches
2. Determination requirements with evidence write back their switch values
3. Re-resolve
4. Repeat until stable, cap at 3 passes, flag anything still moving

---

# PART 3 — DATA MODEL

## 3.1 Tables

```
agencies
  id, name, short_name, jurisdiction_level, state, county,
  website, contact_phone, contact_email, notes

requirement_templates            -- the library; global, not customer data
  id
  industry                        chemical-manufacturing
  jurisdiction_level              federal | state | county | city | contractual
  jurisdiction_state              Oregon | Washington | null
  jurisdiction_county
  agency_id                       fk
  secondary_agency_ids[]
  category                        permits | written_program | training |
                                  recordkeeping | monitoring | reporting |
                                  physical_control | fees_taxes
  name
  citation                        the *enforcing* citation — OAR/WAC for state-plan
  citation_federal_analogue       29 CFR reference, for context only
  citation_url                    primary source link
  citation_quote                  the operative sentence, retrieved
  entity_scope                    organization | site | chemical | equipment | person
  applies_expression              jsonb — machine-evaluable
  trigger_plain                   human-readable version
  scope_rules                     text — what this does NOT cover
  cadence_type                    one_time | annual | quarterly | monthly |
                                  on_trigger | maintain_current
  cadence_anchor                  "March 1" | "anniversary of issue"
  evidence_description
  evidence_types[]
  fails_if
  priority                        critical | high | standard
  produces_switch
  verification_status             generated | verified | disputed
  verification_note
  verified_by, verified_at, source_checked_at
  generated_by                    ai | manual        -- origin only; trust lives in verification_status
  version, effective_from, effective_to, supersedes_id
```

```
switches                library definitions (§2.2)
company_switches        per-company values with basis and lock
entities                organization / site / chemical / equipment / person
obligations             resolved list — produced by code
obligation_evidence      requirement ↔ document links, as rows
```

## 3.2 Three structural rules

**Jurisdiction is in the match key.** Serving one state's requirements to another state's company is a silent, dangerous failure (`CLAUDE.md` §3.2).

*Rewritten 11 Sep. The previous version described three cases; migration 007 made
`jurisdiction_layer` five values plus a nullable, and two of those had no rule at all.*

**The six cases, complete:**

| `jurisdiction_layer` | Applies when | Compared against |
|---|---|---|
| `federal` | always | — serves every state |
| `state` | the company's state matches | `companies.state` |
| `county` | the company's county matches | `companies.county` |
| `city` | the site's city matches | **`entities.city`** |
| `local` | the site's fire authority covers it | **`entities.fire_authority`, else county, else city** |
| `NULL` | **never decided here** | — see below |

**Three things this settles that the three-case version did not:**

**1. `city` and `local` resolve per SITE, not per company.** Two plants of one company can
sit under different fire authorities (§6.6, `DECISIONS.md` §20), so a company-level answer
is wrong at every site but one. Migration 009 gave `entities` the address columns this
needs; before that, both layers were unresolvable for every company.

**2. `local` means "the authority having jurisdiction", which may be neither a city nor a
county.** An Oregon rural fire protection district is its own body. That is why
`entities.fire_authority` exists and is checked first: falling back to county or city is a
best effort, not the definition.

**3. A `NULL` layer is not a jurisdiction case at all, and the match key must pass it
through untouched.** Those rows are contractual — ISO 9001, ISO 14001, NACD Responsible
Distribution — imposed by a registrar rather than a government, and they are not
territorial (`DECISIONS.md` §21.2). **They are gated by a SWITCH, not by geography**:
`holds_iso_certification` is already switch #9 in §2.4.

That distinction is easy to get wrong in either direction, and both are bad. Drop them and
a certified company is never told about the surveillance audit it will fail. Apply them by
default and every company is told it must maintain an ISO certificate it has never held.
**The match key's job is to hand them to the switch evaluator, not to decide them.**

### Where the four jurisdiction facts come from

*Recorded 11 Sep, `DECISIONS.md` §25. Not built — it lands with the M7 signup rework.*

| Fact | Source | Why |
|---|---|---|
| `state`, `county`, `city` | **Geocode the address.** US Census Bureau Geocoder — no API key, effectively unlimited, returns matched address, city, state, state FIPS, county and county FIPS | A lookup with a **known correct answer**. A model would be right most of the time and wrong occasionally *with no signal on which* — and a wrong county silently changes which requirements apply |
| `fire_authority` | **Ask the user.** One field at onboarding | Fire districts **do not follow county or city lines**. Tualatin Valley Fire & Rescue spans Washington, Clackamas and Multnomah counties, so geocoding cannot produce it — which is why it is a fourth independent fact and not derived from the other three |

**Never `scan_result`.** An unverified AI website scan silently outranked the stated address
for months and cost most companies their state-level requirements (`DECISIONS.md` §24.1,
`TODO.md` 1.4).

**A deterministic lookup against an authoritative source outranks both a stated value and an
inferred one.** That is stronger than §24.1's ordering and replaces it for these three
fields: a customer typing "Washington County" can be wrong, and people in Portland routinely
do not know which of three counties an address falls in.

**Both failure paths ask rather than substitute.** A geocode failure — Census downtime is
common enough that commercial geocoders advertise against it — leaves the jurisdiction
**unknown**, and the state- and county-scoped requirements show as undetermined. An unknown
fire authority leaves the three `local` rows undetermined. Neither resolves against a guess,
and neither disappears.

**Rows are versioned, never edited.** A regulation changes; the old row gets `effective_to`, a new row gets `version + 1` and `effective_from`. Audits pin to a library version so past reports remain reproducible.

**Evidence lives in rows, not JSON.** `obligation_evidence` makes "what's missing" a database query, enables resolution tracking, and lets audits run incrementally. One table resolves three separate known problems.

## 3.3 The `scope_rules` field — new, and directly from the failed test

The earlier test output asserted that each 2.5L bottle needs DOT marking and labeling. It does not — inner packagings in a combination package are not separately marked or labeled under DOT; the outer package carries them.

That is a **scope exclusion**, and models are systematically weaker at exclusions than at requirements. Training corpora are full of "you must do X" and thin on "X does not apply here."

The fix is to make exclusions first-class content:

```
name         DOT marking and labeling of packages
scope_rules  Applies to the package as offered for transport. In a combination
             packaging, the OUTER package carries the marking and label. Inner
             packagings are NOT separately marked or labeled under DOT.
             Workplace container labeling of inner packagings is a separate
             OSHA HazCom obligation with different content.
```

Every requirement where a common misreading exists gets a `scope_rules` entry. This is where hard-won domain knowledge — including consultant corrections and every error found in testing — accumulates in the product rather than in one person's head.

---

# PART 4 — BUILDING THE LIBRARY

## 4.1 Principle

Never ask for "all requirements." Always ask agency by agency, with bounded scope. Bounded scope is the substitute for a missing artifact.

## 4.2 Generation order

**Pass 1 — Federal**, once, serving both states and all future states.
Agencies: OSHA baseline content, EPA (RCRA, TSCA, EPCRA, CAA, CWA, SPCC, CERCLA, FIFRA), DOT/PHMSA, FMCSA, then the conditional set.

**Pass 2 — Oregon**, agency by agency:
Oregon OSHA → DEQ air → DEQ waste → DEQ water/UST → State Fire Marshal → local fire → local sewer → SoS/DOR/BOLI/Paid Leave → ODOT → ODA

**Pass 3 — Washington**, agency by agency, **generated independently**:
L&I/DOSH → Ecology dangerous waste → regional air authority → Ecology water/UST → EMD Tier II → WSP/local fire → SoS/DOR B&O/L&I workers' comp/PFML → UTC → WSDA

**Pass 3 must not be seeded with Oregon output.** The divergence table in §1.5 is the reason. The prompt states explicitly that Oregon analogues must not be assumed.

## 4.3 The generation prompt — structure

```
ROLE
You are a regulatory compliance specialist enumerating the obligations
enforced by ONE specific agency against ONE specific industry in ONE
specific jurisdiction.

SCOPE — the only thing you enumerate
Agency:        Oregon Department of Environmental Quality — Air Quality
Industry:      Chemical manufacturing, blending, and repackaging
Jurisdiction:  Oregon
Do not enumerate obligations of any other agency. If an obligation is
enforced by another agency, omit it — it is covered by another pass.

CRITICAL JURISDICTION RULES
- Oregon is an OSHA State Plan state. Cite OAR 437, not 29 CFR.
- Do NOT assume Oregon requirements mirror federal or any other state.
- Where Oregon exceeds or differs from federal, state the difference.

OUTPUT — one object per requirement, JSON only
  name, citation, citation_url, citation_quote,
  agency, category, entity_scope,
  applies_expression   -- use ONLY switches from the provided list;
                          propose new ones in a separate block
  trigger_plain,
  scope_rules          -- REQUIRED: what this does NOT cover, and the
                          most common misreading
  cadence_type, cadence_anchor,
  evidence_description, evidence_types, fails_if,
  priority, produces_switch,
  confidence           -- high | medium | low
  verification_flags[] -- any specific date, fee, threshold, or numeric
                          value you are not certain is current

RULES
- Every specific date, fee amount, and numeric threshold MUST be listed
  in verification_flags. These are the values most likely to be stale.
- If you are uncertain whether an obligation exists, include it with
  confidence: low rather than omitting it. Omissions are invisible;
  low-confidence inclusions are reviewable.
- Prefer the operative regulatory text over paraphrase for citation_quote.

AVAILABLE SWITCHES
[the switch list]
```

Settings: `temperature: 0.1` — this is enumeration under rules, not creative writing. Web search enabled.

## 4.4 Multi-model cross-check

Run each agency pass through Claude, GPT, and Gemini independently with the identical prompt.

| Outcome | Action |
|---|---|
| All three agree on existence and specifics | `generated`, confidence high |
| Agree on existence, differ on a specific | `disputed` — the specific goes to primary-source resolution |
| Only one model produces it | `disputed` — likely either a real find or a hallucination; must be resolved |
| Citation differs | Resolve against primary source, always |

**What the 174 / 11 / 3 split on the existing data actually means — corrected 10 Sep.**

The merge that produced the current chemical file was **sequential, not competitive.** GPT
generated first and produced 174 rows. Claude ran next and added **11 rows GPT had missed.**
Gemini ran last and added **3 the other two had missed.** All three lists were merged; none
was chosen over another, and no row was discarded in favour of a rival.

So the `source` column is a **build log** — which model was the first to contribute a row the
others lacked — and it is **not authorship, not a quality ranking, and not a tie-break.** An
earlier version of this section read it as "substantially one enumeration with two
validators." That was wrong, and it is corrected here rather than quietly dropped, because
the wrong reading makes the data look weaker than it is.

**The one thing worth keeping from that split is a convergence signal: 174, then +11, then
+3.** Each additional model found dramatically less than the one before it — a curve that
flattens that hard is evidence the enumeration is close to complete.

The evidence is **weak but real.** Weak because three models trained on overlapping corpora
can share a blind spot, and a requirement none of them knows about produces exactly this
curve too. Real because the drop is that steep: if substantial territory were missing, the
third model would not have found only three rows.

**That curve is why a fourth model was not run.** The expected yield is roughly one row, and
one row does not change a decision. The remaining risk is a shared blind spot, and another
model of the same kind is precisely the wrong instrument for that — a shared blind spot is
closed by primary-source retrieval against the agency's own scope (§4.5), not by another
opinion. That is where the effort goes instead.

## 4.5 Primary-source resolution — the step that makes verification meaningful

Every `disputed` item, and every item in `verification_flags`, is resolved by **retrieval, not by a model vote.**

- Federal: eCFR and the Federal Register both expose real APIs — retrieve the current section text
- Oregon: Oregon Administrative Rules and Oregon Revised Statutes as published by the Secretary of State
- Washington: Washington Administrative Code and Revised Code of Washington as published by the Code Reviser
- Agency pages for fees, forms, and filing dates

Store `citation_url`, `citation_quote`, and `source_checked_at` on the row.

**A disagreement resolved by retrieval is worth something. A disagreement resolved by a model's opinion is worth almost nothing.**

## 4.6 Human verification — scoped so one person can actually do it

Do not review 188 rows. Review by **fact class**, because the failure modes are concentrated:

| Priority | What | Why |
|---|---|---|
| 1 | Every specific date, deadline, fee, and numeric threshold | The demonstrated failure class — models are weakest here and these matter most operationally |
| 2 | Every `disputed` item | Known disagreement |
| 3 | Every `critical` priority citation | Highest consequence if wrong |
| 4 | Every row in the §1.5 divergence table | Highest OR/WA conflation risk |
| 5 | Every `scope_rules` entry | These are exclusions; models are systematically weak on exclusions |

Expect roughly 50–60 rows per state out of ~190. Days of focused work, not months.

Federal structural content — written program requirements, training obligations, general recordkeeping — that three models independently agree on can ship as `generated` with the agreement recorded.

## 4.7 The learning loop

Every error found in testing, every consultant correction, every customer challenge becomes either a new `scope_rules` entry or a `disputed` flag on an existing row. The library gets more correct with use rather than staying static.

---

# PART 5 — RUNTIME: THE CLAUDE CALL ARCHITECTURE

## 5.1 What went wrong in the test, precisely

The failed output had four causes, and only one was model capability:

1. **Output schema foreclosed the right answer.** The checklist format has no slot for "I need one more fact first." A model asked to fill a checklist fills the checklist. Asking a question was structurally unavailable.
2. **Autoregressive lock-in.** Once the wrong headline requirement was written, six sub-steps elaborated it coherently. No backtracking in a single pass.
3. **Substep expansion legitimized an unverified premise.** Expansion received requirement #1 as given and never questioned the parent — spending $650–1,800 of cost estimates on a requirement that did not exist as stated.
4. **Effort inverted.** Six sub-steps on label procurement; one sentence each on the requirements that were actually correct. A consultant spends 80% of effort on *what is it, what packing group, what packaging* and 20% on *where to buy labels*.

Additionally: checklist generation appears to run at default temperature because it is treated as conversational. **Identifying which requirements apply is a judgment call, not conversation.** That is a quality-affecting parameter and should be discussed before changing.

## 5.2 The six-stage runtime pipeline

```
User question
     ↓
 STAGE 1  Determination gate      — what facts decide this? do we have them?
     ↓                              → if a blocking fact is missing, ASK. Stop.
 STAGE 2  Agency scoping          — which agencies have jurisdiction here?
     ↓
 STAGE 3  Library retrieval       — pull matching requirement rows (the anchor)
     ↓
 STAGE 4  Identification          — which requirements apply? temp 0.1
     ↓
 STAGE 5  Critic pass             — adversarial review, fresh context
     ↓                              → material error? loop once to Stage 4
 STAGE 6  Expansion               — sub-steps, costs, contacts, only on survivors
     ↓
   Display
```

### Stage 1 — Determination gate

A short call, before anything is enumerated:

```
The user asked: [question]
Known company facts: [switches with values]

1. What facts determine the answer?
2. Which are known? Which are unknown?
3. For each unknown: does the answer BRANCH materially on it (blocking),
   or can it be stated conditionally (non-blocking)?
4. For each blocking unknown, what single artifact would resolve it?

Output JSON. Do not answer the question.
```

For the shipping test this returns: packing group unknown, blocking, resolved by the SDS. The product then asks for the SDS instead of enumerating past it.

**This single stage would have prevented most of the errors in the failed test.** Packing group determines UN number, hazard class, limited-quantity eligibility, packaging spec, and label — five of the six things that went wrong.

It is also the runtime expression of `produces_switch`: a determination whose output flips downstream requirements gets resolved *before* the downstream requirements are enumerated.

**Rule:** at most one blocking question, and always paired with what it unlocks. "Upload the SDS and I can give you the exact packing group, UN number, and whether limited quantity applies" — not a form.

### Stage 2 — Agency scoping

```
Activity: [question]
Company: [state, county, industry, relevant switches]
Available agencies for this jurisdiction: [list from §1.2–1.4]

Which agencies have jurisdiction over this activity? For each, state
in one line what its interest is. Do not enumerate requirements.
```

For the shipping question: DOT/PHMSA (transport), OSHA/state plan (workplace labeling), FMCSA (own fleet), and possibly the state fire authority for storage before shipment.

This is the coverage frame. It bounds Stage 4 and enables the completeness check in Stage 5.

### Stage 3 — Library retrieval

Query `requirement_templates` on industry + jurisdiction + the agencies from Stage 2. This is **the anchor** — the model now reasons against known rows rather than enumerating from nothing.

Where the library is thin, the model may still add requirements — but they are marked `library_gap` and fed back into the library build queue. **Live answers become a discovery channel for library gaps.**

### Stage 4 — Identification

```
temperature: 0.1

For each candidate requirement, decide: applies / does not apply /
undetermined. For each, state which switch values decide it.

For each requirement that applies, state:
  - which PHYSICAL OBJECT it attaches to (the bottle, the case, the
    pallet, the vehicle, the facility, the person, the record)
  - which REGIME governs it (transport / workplace / environmental /
    fire / tax)

Do not write sub-steps. Do not write costs. Identification only.
```

The physical-object and regime fields are deliberate. The failed test attached a transport-regime requirement to the wrong physical object — bottle rather than case — and got it right for OSHA and wrong for DOT **in the same document.** Forcing the model to state the object and regime explicitly makes the error visible rather than buried in prose.

### Stage 5 — Critic pass — the highest-value addition

A **fresh call with no access to Stage 4's reasoning.** It sees only the output.

```
You are reviewing a compliance determination for errors. Be adversarial.
Assume errors exist and find them.

For each requirement listed:
1. Which physical object does it attach to? Is that correct?
2. Which regulatory regime? Is that the right regime for this object?
3. What SCOPE EXCLUSIONS apply? Does this requirement actually reach
   this object, or does it attach to a container, package, or entity
   one level up or down?
4. What determination does it depend on? Was that determination made,
   or assumed?
5. Are any specific dates, fees, or thresholds stated? Flag every one.

Then, coverage:
6. Agencies identified as having jurisdiction: [list from Stage 2].
   For each, was it addressed? What obligations of that agency are
   conspicuously absent?
7. Does any statement assume a fact the user did not provide?

Output: errors[], omissions[], unverified_specifics[], assumptions[]
```

This exploits a real asymmetry: **critique is cheap and reliable; generation is expensive and fragile.** The model reviewing a written artifact is in its strongest mode — it has an anchor.

Applied to the failed test, this pass would have caught the combination-packaging error (question 3), the missing packing group (question 4), the invented "own vehicles" framing (question 7), the penalty figure (question 5), and the DOT training and UN specification packaging omissions (question 6).

Run the critic on the **stronger model.** Identification and critique are where the decisions are; sub-step prose is not.

### Stage 6 — Expansion

Only requirements that survive the critic get sub-steps, costs, times, prerequisites, and contacts.

**Effort allocation rule:** sub-steps are spent on *determination and decision* first, procurement second. Determining packing group and selecting UN specification packaging deserve more depth than choosing a label printer.

Expansion may run on the cheaper model — it is prose generation from settled facts.

## 5.3 Model tier allocation

| Stage | Tier | Why |
|---|---|---|
| 1 Determination gate | Strong | Recognizing missing information is a known weak spot |
| 2 Agency scoping | Cheap | Bounded lookup against a known list |
| 3 Library retrieval | — | Database query |
| 4 Identification | Strong | Holding structural rules against plausible surface patterns |
| 5 Critic | **Strongest** | The safety net; highest value per token in the pipeline |
| 6 Expansion | Cheap | Prose from settled facts |

Currently the same capability is spent on judgment and on prose. The judgment calls decide whether the output is right.

## 5.4 The four model weaknesses this design compensates for

| Weakness | Compensation |
|---|---|
| **Negative knowledge** — better at "must do X" than "X doesn't apply here" | `scope_rules` as first-class content; critic question 3 |
| **Regime/object boundaries** — which rule attaches to which object | Explicit object + regime fields in Stage 4; critic questions 1–2 |
| **Specific numerics** — dates, fees, thresholds go stale | `verification_flags`; primary-source retrieval; never generated at runtime |
| **Under-asking** — enumerates all branches rather than requesting one fact | Stage 1 determination gate with an explicit "ask" output path |

---

# PART 6 — DISPLAY

## 6.1 Principles

1. **Severity first.** Critical → high → standard. Consistent semantic colour on every visual element, not decoration.
2. **Plain-language citations.** "Oregon OSHA rule on hazard communication (OAR 437-002-0360)" — never a bare code.
3. **Show the reason.** Every applicable requirement displays why: which switch, which value, which evidence.
4. **Show what's unresolved.** Undetermined obligations are visible as open questions, never hidden and never rendered as clear.
5. **Show verification status.** A verified row and an AI-generated row are not the same thing and must not look the same.

## 6.2 Requirements page

**Primary grouping: agency.** This matches how the user thinks and makes coverage legible.

```
┌─ OREGON DEQ ─────────────────────── 14 apply · 2 undetermined ──┐
│ ✓ verified · last checked Aug 2026                              │
├─────────────────────────────────────────────────────────────────┤
│ ● Air Contaminant Discharge Permit — Simple ACDP                │
│   Applies because: air_permit_required = yes                    │
│   Evidence: ACDP-2024-0891.pdf · valid to 03/2027                │
│   Next: annual report [date — verify] · fee [amount — verify]    │
│                                                                  │
│ ▲ Cleaner Air Oregon risk assessment                            │
│   UNDETERMINED — depends on: called in by DEQ?          [Answer] │
└─────────────────────────────────────────────────────────────────┘
```

Secondary views: by category (permits / written programs / training / recordkeeping / monitoring / reporting), by status, by due date.

## 6.3 Coverage strip — the honesty feature

```
Oregon chemical manufacturing — library coverage
OSHA ✓verified   DEQ ✓verified   Fire ✓verified   SoS ✓verified
DOT ✓verified    EPA ✓verified   Local fire ◐partial   ODA ○not built
```

This states plainly what is covered and to what standard. It is the answer to "does this cover fire code," and it is more credible than any claim of completeness — because it admits limits.

## 6.4 Switches screen — the highest-leverage screen in the product

46 switches, most pre-answered from documents and profile, each showing the basis, each editable, each edit instantly recomputing every obligation.

```
Hazardous waste generator category            SQG          [edit] 🔒
  Determined from: manifest log, Jan–Jun 2026, avg 180 kg/month
  Confidence: high · Re-checked monthly · Last: 09/01/2026
  Affects 23 requirements

Process safety — listed substance above TQ    UNKNOWN    [Answer →]
  Could not determine. Upload your chemical inventory with
  maximum on-site quantities and this resolves automatically.
  Affects 11 requirements
```

The "affects N requirements" number is what makes a user willing to correct a switch. One correction fixes dozens of downstream answers.

## 6.5 Answer display

The failed test's structure was broadly right — MUST DO / GOOD TO HAVE, steps with time, cost, prerequisites, and agency. Keep it. Add:

- **The determination banner**, when Stage 1 asked something:
  *"This answer assumes packing group III. Upload your SDS for an exact determination."*
- **Physical object tags** on each requirement — `[the case]` `[each bottle]` `[the vehicle]` `[your records]`. Directly targets the failure mode from the test.
- **Regime tags** — `[DOT — transport]` `[OSHA — workplace]`. Makes the two-regime distinction visible rather than implicit.
- **Verification badges** on any specific date, fee, or threshold that has not been primary-source checked.
- **Agency coverage footer:** *"This answer covers DOT, Oregon OSHA, and FMCSA obligations. It does not address fire code storage requirements — ask separately."* Honest scope beats implied completeness.

## 6.6 Multi-site

With `entity_scope`, a two-plant company gets per-site obligation lists. Site-scoped requirements exist once per site and can have different statuses. Rolled-up company view plus per-site drill-down.

This is not an edge case. One company with plants in several places is normal in chemical manufacturing, and **their requirement lists genuinely differ by site** — different Oregon OSHA citations, different waste rules, a different air authority. A six-facility operator is one business with six sites, not six legal entities.

### ⚡ Site is a property of DATA, not of PEOPLE

**This is the decision in multi-site most likely to go wrong, so it is stated before the screens.**

A permit belongs to a site. A manifest log belongs to a site. A generator category belongs to a site. **A user belongs to the company and sees everything in it.**

*"Which site am I looking at"* is therefore a **filter** — a dropdown, with roll-up as "all sites" — and never a permission.

```
Showing:  [ All sites ▾ ]                    3 sites · 47 apply · 6 undetermined
          ├ All sites (roll-up)
          ├ CompanyA-Hillsboro
          ├ CompanyA-Albany
          └ CompanyA-Longview
```

**The tempting alternative is per-user site access, and it is a trap.** It makes the simple case — one site, one person, which is most early customers — complicated. It turns a dropdown into a permissions system with an inheritance model and an admin screen. And every query then has to resolve *"which sites may this person see"* before it can ask anything useful, which means the permission check reaches into resolution, evidence, documents and the calendar rather than staying in one component.

If a customer later asks that the Hillsboro manager not see Longview's findings, **that is a separate permissions feature**, priced and built as one. It is not something to pre-build for a customer who has not asked.

### Switch scope is the part that has to be right

Every switch is either company-wide or per-site, and getting one wrong is not approximately right — it is wrong at every site but one, in the direction of a confident answer.

| Company-wide | Per-site |
|---|---|
| Employee count | Hazardous waste generator category |
| ISO 9001 certification | Air permit tier / ACDP level |
| Corporate written programs | Underground storage tanks |
| DOT operating authority | Local fire jurisdiction |
| Ownership and entity structure | Tier II reportable quantities |

So `switches` carries a `scope` — `company` or `site` — and `company_switches` carries a nullable site reference. The switches screen (6.4) shows a site-scoped switch once per site, each with its own basis and its own "affects N requirements" count.

### Naming

**Sites carry the name the operator already uses** — `CompanyA-Hillsboro`, never `Site 2` or a generated label. A plant manager thinks *"the Hillsboro plant"*. If the product makes them translate that into an id, it is harder to use than the spreadsheet it replaces.

### Sequencing

The **structure** goes in with the schema rebuild, before real customer data exists: a site row seeded for every company at signup — including single-site customers, so nothing is special-cased later — and a site reference on documents, obligations and evidence. The **interface** on this page waits until a customer asks for it.

One account per facility is the near-term answer and it works. What it costs: company-level documents uploaded once per account and ageing independently, no roll-up view, and a consolidation later that means merging live customer accounts and deciding which copy of a shared document is authoritative.

*(`DECISIONS.md` §20 · `TODO.md` 1.6 · `BUILD-PLAN.md` 2.8.)*

---

# PART 7 — VERIFICATION AND CHANGE MONITORING

## 7.1 Change detection is retrieval; impact assessment is AI

Never ask a model "what changed recently." That is the weakest form of the question and the one most likely to miss things.

**Detect deterministically:**
- Federal Register API — rules touching the CFR parts referenced in the library
- eCFR — section-level change tracking
- Oregon SoS Administrative Rules bulletins
- Washington Code Reviser WSR filings
- Agency pages for fee schedules and filing dates

**Assess with AI:** does this change touch our rows? Which rows? Which customers? How material?

## 7.2 Versioning makes change monitoring useful

Without `effective_from` / `supersedes_id`, detection gives you a news alert. With it: *"Row 47 is superseded effective 03/01/2027. 23 customers were shown the prior obligation. Here they are."*

The second sentence is the product.

## 7.3 The checking agent

A continuously-running agent comparing live answers against the library. Three requirements:

**Independence must be real.** The library is Claude-generated and live answers are Claude-generated. Agreement between them is one witness speaking twice, not corroboration. **The checker must run on a different model,** and the tiebreaker on disagreement must be **primary-source retrieval, not a third model's vote.**

**Normalize before comparing.** A prose answer cannot be diffed against a table. An intermediate call extracts requirement-shaped claims — citation, obligation, object, threshold, cadence — then set-compare.

**Disagreements are not equally valuable:**

| Type | Meaning | Value |
|---|---|---|
| In library, not in answer | Library over-includes, or answer omitted | Ambiguous — the answer only responds to what was asked |
| In answer, not in library | **Library gap** | High — actionable, feeds the build queue |
| Both, different specific | One is wrong on a date/threshold/citation | **Highest** — resolvable against primary source |

Weight the system toward hunting type 3 and mining type 2.

## 7.4 Seeded errors — monitoring an unsupervised process

An agent running unsupervised has a specific failure: it gradually stops finding things and reports clean, which reads as success.

**Inject known-bad rows at intervals** — wrong threshold, stale date, wrong citation, wrong physical object. If the checker misses the seeds, the checker is broken, not the library. This is the only way to monitor an unsupervised process without supervising it, and it costs almost nothing.

## 7.5 The golden-file test set

The consultant-benchmarked scenarios are ground truth and the most valuable test asset in the business. Formalize them:

```
scenario_id, input (industry, address, question, artifacts),
consultant_answer, compliboard_answer,
matched[], missed[], extra_correct[], extra_wrong[],
run_date, model, library_version
```

Re-run after every prompt change, model upgrade, or matching change. This is the regression suite that protects the core IP from silent degradation — and it is a far stronger diligence claim than either "160 experts" or "trust the model."

**Add every failure found to the set.** The shipping-labels case is test #1, with the correct answer written out.

## 7.6 Human spot-check

One thing stays human, and it is not the library. It is **the checker's own judgments.** Twenty adjudications per quarter. If the agent is reasoning badly about source text, that error propagates everywhere and no automated layer above it catches it.

---

# PART 8 — BUILD SEQUENCE

| # | Step | Output |
|---|---|---|
| 1 | Schema: agencies, requirement_templates with jurisdiction + versioning + scope_rules, switches, company_switches, entities, obligations, obligation_evidence | Migration files — schema reproducible from source |
| 2 | Load the 46 switches with definitions and jurisdiction variants | Switch library |
| 3 | Federal layer, agency by agency, multi-model, primary-source resolution | ~95 verified federal rows serving all states |
| 4 | Oregon layer, agency by agency | ~90 Oregon rows |
| 5 | Human verification pass by fact class (§4.6) | Oregon marked verified with dates |
| 6 | Resolution engine — pure code, no AI | Deterministic obligation lists |
| 7 | Switch determination from documents — AI, with basis logged and user override | Company switch values |
| 8 | Runtime pipeline: determination gate → agency scoping → library retrieval → identification → **critic** → expansion | Fixes the demonstrated failure mode |
| 9 | Normalize audit output into obligation_evidence | Resolution tracking, incremental audits, real dashboards |
| 10 | Requirements page, switches screen, coverage strip | Vertical #1 shippable |
| 11 | Calendar reads cadence from obligations | Deadlines without requiring uploads |
| 12 | Golden-file test set formalized, seeded-error harness | Regression protection |
| 13 | Washington layer, independently generated and verified | Second state |
| 14 | Change monitoring: Federal Register + eCFR + OAR + WAC retrieval | Currency claim becomes real |
| 15 | Shadow checker agent, different model, primary-source tiebreak | Continuous library improvement |

**Steps 8 and 5 are the two that most change output quality.** Step 8 fixes the demonstrated runtime failure. Step 5 is what makes the content trustworthy. If time is short, those two before anything cosmetic.

---

# PART 9 — WHAT THIS EARNS

**A defensible quality claim.** Not "160 experts," not "trust the model," but: *every requirement is anchored to primary source text, with the retrieved quote, the URL, and the date it was last checked; benchmarked against paid consultant deliverables across N scenarios; continuously re-verified by an independent checker.* That is reproducible and dated, which a human review process is not.

**A finite, honest coverage statement.** "Oregon chemical: OSHA, DEQ, DOT, EPA, State Fire Marshal, SoS verified as of August 2026. Local fire partial. ODA not built." Precise beats implied-complete.

**Two states from one federal build.** ~95 federal rows serve Oregon, Washington, and every state after. State two is a ~90-row job, not a ~190-row job. That is the economics of the vertical blitz.

**A carve-out asset.** Verified, cited, jurisdiction-scoped, switch-tagged chemical requirements for two states are cleanly separable and unambiguously valuable to a chemical-industry buyer — in a way that shared application code is not.

---

# PART 10 — ONBOARDING AND SWITCH ACQUISITION

## 10.1 The governing rule

> **Never ask the user anything that can be derived from the address, the website, a public database, or a document they already have.**

There are ~46 switches. If onboarding asks 46 questions, nobody finishes, and the answers are wrong anyway — an eight-person chemical blender does not know their generator category or TRI status. **That not knowing is why they need the product.** An onboarding form that demands expert answers is asking the customer to do the job they are paying for.

Sources ranked by cost to the user, cheapest first:

| Source | User cost | Switches it can resolve |
|---|---|---|
| Address | Zero | ~5 |
| Public databases | Zero | ~8, several of them high-value |
| Website scan | Zero | ~10 |
| Documents already on hand | Low — an upload | ~20, the hardest ones |
| Direct questions | High | **Target: 6–8** |

## 10.2 Layer 1 — The address (zero questions)

One field resolves the entire jurisdiction spine:

- `entity_state` → Oregon or Washington → which state library applies
- `entity_county` → local fire authority; **in Washington, which regional clean air agency has air permitting authority** (Puget Sound / Southwest / Spokane / others) — a structural difference from Oregon with no user input required
- City → local business licensing, zoning, building authority
- Sewer district → which POTW governs pretreatment (Portland BES, Clean Water Services, and others)
- Whether the site is inside a fire district with its own operational permit program

Geocode once at signup. None of this is a question.

## 10.3 Layer 2 — Public databases (zero questions, highest value per effort)

**This is the most under-used input available, and much of it is free.**

| Source | What it returns | Switches resolved |
|---|---|---|
| **EPA ECHO / FRS** | Facility ID, permits, inspection and violation history, program participation by media | air, water, waste program status |
| **EPA RCRAInfo** | EPA hazardous waste ID number and **generator category** | `hazwaste_generator_category` — one of the hardest and most consequential switches |
| **EPA TRI** | Whether the facility has filed Form R, and for what chemicals | `tri_reportable` |
| **Oregon DEQ / WA Ecology facility databases** | State permits — ACDP, NPDES, 1200-Z, UST registrations | air, water, tank switches |
| **Oregon SoS / WA SoS** | Registration status, entity type, officers, standing | registration requirements, entity structure |
| **OSHA / state plan establishment data** | Prior inspections, citations, program history | risk context |
| **FMCSA SAFER** | USDOT number, fleet size, safety rating, hazmat authority | `owns_fleet`, `cdl_drivers`, `ships_placardable_hazmat` |
| **Oregon OSFM CR2K** | Whether the facility has an OSFM facility ID and files | `or_cr2k_threshold` |

**Design implication:** at signup, given only a company name and address, a public-records pass should run before any question is asked. If RCRAInfo says the facility is a registered SQG, do not ask. Show it and let them confirm.

This is also a genuinely striking onboarding moment — *"we found your EPA ID, your air permit, and your DOT number"* — before the user has typed anything but an address.

**Design note:** these are read-only lookups, which under the standing rule are safe to build without a quality discussion. What data feeds the AI *is* quality-affecting, so how these results enter the switch-determination prompt should be discussed.

## 10.4 Layer 3 — The website scan (zero questions)

The scan already exists. What it should be extracting for this vertical:

**Reliable from a website:**
- `business_type` — manufacturer / blender / repackager / distributor / toll processor. Usually explicit.
- `holds_iso_certification` — 9001, 14001, 45001, RC14001, Responsible Care, NACD Responsible Distribution. **Almost always displayed as a badge or a certifications page**, because it is a sales asset. High-confidence source.
- Product lines and chemical families → likely hazard classes, and a first pass at PSM/TRI/TSCA exposure
- `multi_site` — locations pages
- `imports_exports` — international shipping or distribution language
- `food_contact_or_food_grade`, `pesticide_products_fifra`, `consumer_products_cpsc` — usually stated as market claims
- Customer industries served → contractual flow-down likelihood (semiconductor, pharma, and food customers impose audit regimes)
- Careers page → rough headcount signal, roles that imply operations (lab tech, CDL driver, EHS manager)
- Certificates of analysis, SDS libraries, and technical data sheets published on the site → **often directly downloadable, and an SDS library is the single richest chemical input available**

**Not reliable from a website — do not infer:**
- Employee count (marketing language inflates)
- Waste generation volumes
- On-site quantities
- Tank inventories
- Whether trucks are owned or contracted

The scan should output switches with `confidence`, and anything at medium or low goes to confirmation rather than being silently adopted.

**High-value addition:** if the site publishes an SDS library, offer to pull it. That single action can resolve chemical identity, hazard class, packing group, TSCA status, EHS listing, and TRI exposure — the hardest cluster in the whole switch set — with no user effort.

## 10.5 Layer 4 — Documents (one upload beats twenty questions)

Documents are the best switch source and the reason this product can serve SMBs at all. Each maps to a cluster:

| Document | Resolves |
|---|---|
| **SDS library / chemical inventory** | chemical identity, hazard classes, packing groups, EHS, TSCA, TRI, PSM/RMP thresholds, CR2K, Tier II |
| **Hazardous waste manifests** (6 months) | `hazwaste_generator_category` — measured, not guessed |
| **Air permit (ACDP / Title V / regional authority)** | air tier, monitoring, reporting, fee obligations |
| **NPDES / 1200-Z / discharge permit** | water obligations |
| **Payroll summary or headcount report** | `employee_count` band → many OSHA and leave thresholds |
| **Workers' comp policy or L&I account** | classification codes, which imply operations |
| **Fire department inspection report** | flammable quantities, permits held, prior findings |
| **DOT shipping papers / BOLs** | hazmat classes shipped, placardable status |
| **Facility site plan** | tanks, confined spaces, storage areas |
| **Certificates** (ISO, Responsible Care, NACD) | contractual obligations |

**Ask for documents, not answers.** "Upload your last six manifests" is a task a shipping clerk can do in five minutes. "What is your generator category?" is a question that produces a wrong answer from the same person.

## 10.6 Layer 5 — The direct questions

Only what survives all four layers above. Target: **6–8 questions, under three minutes.**

**Screen 1 — Confirm what we found** (not a question; a review)

```
Here's what we found about [Company]. Correct anything wrong.

  Facility            1234 NW Industrial, Portland OR 97210    [edit]
  Type                Chemical blending and repackaging         [edit]
  Certifications      ISO 9001:2015                             [edit]
  EPA ID              ORD000XXXXXX — Small Quantity Generator   [edit]
  Air permit          Simple ACDP, DEQ                          [edit]
  DOT number          USDOT 1234567, hazmat authority           [edit]
```

Correcting is far easier than answering, and the corrections carry more signal than the confirmations.

**Screen 2 — Facts we cannot look up (the real ask)**

1. **How many employees?** — bands: 1–10 / 11–19 / 20–24 / 25–49 / 50–99 / 100+
   *Drives a large number of OSHA, leave, and reporting thresholds. Not reliably derivable.*

2. **How many facilities, and where?** — addresses
   *Drives `entity_scope` multiplication and per-site jurisdiction. Website locations pages are often stale.*

3. **Who moves your product?** — our own trucks / common carrier / both / customer pickup
   *The question the failed shipping test silently assumed. Splits FMCSA, CDL, drug-and-alcohol testing, and driver qualification obligations.*

4. **Roughly how much hazardous waste do you ship per month?** — under 100 kg / 100–1,000 kg / over 1,000 kg / not sure
   *"Not sure" routes to manifest upload rather than dead-ending. Skip entirely if RCRAInfo already answered.*

5. **Check anything on site** — multi-select, one screen, ~12 switches at once:
   underground tanks · aboveground tanks over 1,320 gal of oil · boilers or pressure vessels · on-site laboratory · spray booth or spray finishing · welding or hot work · confined spaces · high-piled storage · refrigeration over 50 lb · outdoor work areas · respirator use · loading dock for bulk transfer

6. **Do any customers audit you or impose their own compliance requirements?** — yes / no / not sure
   *Contractual layer. Also the strongest channel signal in the whole product — a "yes" here identifies the audit-template issuer who is the distribution path.*

7. **What would you like to be sure about first?** — free text
   *Not a switch. Sets the first workspace question and tells you what they are actually afraid of.*

**Screen 3 — Documents**, with named requests and the value stated:

```
Upload these and we can determine the rest — no more questions.

  ☐ Your SDS binder or chemical list      → resolves ~12 requirements
  ☐ Last 6 hazardous waste manifests      → confirms generator category
  ☐ Your air permit                       → resolves reporting and fees
  ☐ Most recent fire inspection report    → resolves local permits

  Skip for now — you can add these any time
```

Skippable. Every skipped document leaves its switches `unknown`, and those requirements show as **undetermined**, never as not-applicable.

## 10.7 Progressive disclosure — do not front-load

Onboarding does not have to finish before the product is useful. Sequence:

1. **Signup:** company name, website, address. Three fields.
2. **Background:** website scan + public records run while they wait. ~30 seconds.
3. **Confirm screen:** review what was found. Corrections only.
4. **Seven questions.** Under three minutes.
5. **Document requests.** Skippable.
6. **Dashboard**, with a visible completeness meter: *"We can answer 34 of 47 requirement areas. Four documents would raise that to 45."*
7. **In-context asks.** When a question touches an unknown switch, ask it *then*, with the reason visible: *"To answer this I need to know if you have a spray booth."* Contextual questions get answered; onboarding-form questions get abandoned.

## 10.8 Volatile switches and re-asking

- `hazwaste_generator_category` is determined **monthly**. Set `expires_at`; re-prompt or re-derive from new manifests.
- `employee_count` crossing 10, 11, 20, 25, 50, or 100 changes obligations. Re-confirm annually and on any headcount change signal.
- `tri_reportable` and threshold switches shift with production volume. Re-confirm annually, ahead of reporting season.

Expired switches revert to `unknown`, not to their last value. A stale "false" is a false green.

## 10.9 Onboarding as a coverage report

The last onboarding screen is honest about limits, which is consistent with retiring the compliance score:

```
Based on what we know:
  38 requirements apply
  11 undetermined — we need more information
  Oregon OSHA · DEQ · DOT · OSFM · EPA covered and verified
  Local fire code — partial coverage for your jurisdiction

Top unresolved: process safety threshold, TRI status, tank inventory
```

That page tells the truth about what the product knows, states what would improve it, and gives the user a reason to upload documents — which is exactly the behaviour that makes every later answer better.

---

# PART 11 — OPEN DECISIONS

1. **Verification standard for launch.** Ship Oregon with the fact-class verification of §4.6, or hold for a full row-by-row pass? Fact-class is defensible and achievable; full pass delays launch by weeks.
2. **Do customers see `disputed` rows?** Showing them, labelled "verify with your regulator," is consistent with retiring the compliance score. Hiding them looks more confident and is less honest.
3. **Washington timing.** Immediately after Oregon while the process is fresh, or after Oregon has real customers and the process is validated? The divergence table argues for doing it while the OR/WA differences are top of mind.
4. **Local layer depth.** Local fire authority requirements vary by jurisdiction. Build for the top three metro fire authorities per state, or handle locally at runtime with a coverage disclaimer?
5. **Multi-site pricing.** Obligations multiply per site. A three-plant chemical company is three times the work at the same $99.
6. **Runtime temperature.** Checklist generation currently runs at default. Identification is a judgment call. Quality-affecting — decide before changing.
7. **Critic pass cost.** It adds a call to every answer. Always on, or only above a complexity threshold? Recommendation: always on, given the demonstrated failure mode.
8. **CFATS and other lapsed or changed programs.** A standing list of "programs whose status must be confirmed before publication" — models state lapsed programs as current with full confidence.
