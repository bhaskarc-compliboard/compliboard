# Golden document 05 — Safety Data Sheet, supplier document, any industry

Case id: 05-sds-supplier
Render as: PDF, 4 pages, the standard 16-section SDS layout with numbered section headings.
Company context to scan under: Cascade Specialty Chemicals, LLC · chemical distribution · Portland, Oregon (same company as cases 01 and 02).

No planted gaps. This is somebody else's document. The scan must recognise it as a supplier document, not judge it, and not invent facts about the company from it beyond what is clearly marked inferred.

---

## DOCUMENT TEXT

SAFETY DATA SHEET
Sodium Hydroxide Solution, 50%
According to OSHA Hazard Communication Standard, 29 CFR 1910.1200
Revision date: March 18, 2024 · Version 4.1 · Supersedes version 4.0 (August 2, 2021)

SECTION 1. IDENTIFICATION
Product identifier: Sodium Hydroxide Solution, 50% (w/w)
Synonyms: Caustic soda solution, lye solution, NaOH 50%
Recommended use: Industrial pH adjustment, cleaning, chemical manufacturing
Supplier: Northwest Alkali Products, Inc., 7200 N Lombard Street, Portland, Oregon 97203 · Telephone (503) 555-0140
Emergency telephone: CHEMTREC 1-800-424-9300 (24 hours)

SECTION 2. HAZARD IDENTIFICATION
Classification: Skin corrosion, Category 1A (H314); Serious eye damage, Category 1 (H318); Corrosive to metals, Category 1 (H290)
Signal word: DANGER
Hazard statements: H290 May be corrosive to metals. H314 Causes severe skin burns and eye damage.
Precautionary statements: P260 Do not breathe mist or vapours. P280 Wear protective gloves, protective clothing, eye protection and face protection. P301+P330+P331 If swallowed: rinse mouth, do NOT induce vomiting. P303+P361+P353 If on skin (or hair): take off immediately all contaminated clothing, rinse skin with water. P305+P351+P338 If in eyes: rinse cautiously with water for several minutes; remove contact lenses if present and easy to do; continue rinsing. P310 Immediately call a poison center or doctor. P390 Absorb spillage to prevent material damage. P406 Store in a corrosion-resistant container with a resistant inner liner.
Pictograms: Corrosion

SECTION 3. COMPOSITION / INFORMATION ON INGREDIENTS
Sodium hydroxide, CAS 1310-73-2, 48–52%. Water, CAS 7732-18-5, 48–52%.

SECTION 4. FIRST-AID MEASURES
Eyes: Immediately flush with plenty of water for at least 30 minutes, lifting the eyelids. Get medical attention immediately. Skin: Immediately flush with plenty of water for at least 30 minutes while removing contaminated clothing and shoes. Get medical attention immediately. Inhalation: Move to fresh air. If breathing is difficult, give oxygen. Get medical attention. Ingestion: Do not induce vomiting. Rinse mouth, give water to drink if the person is conscious. Get medical attention immediately.

SECTION 5. FIRE-FIGHTING MEASURES
The product is not flammable. Contact with aluminium, zinc, tin and their alloys generates hydrogen gas, which is flammable. Use extinguishing media appropriate to surrounding materials. Wear self-contained breathing apparatus and full protective clothing.

SECTION 6. ACCIDENTAL RELEASE MEASURES
Evacuate unnecessary personnel. Wear the protective equipment in Section 8. Contain the spill with inert absorbent (sand, vermiculite). Neutralise carefully with dilute acid if trained to do so. Do not allow to enter drains or waterways. Collect into a suitable corrosion-resistant container for disposal.

SECTION 7. HANDLING AND STORAGE
Handling: Avoid contact with skin, eyes and clothing. Do not breathe mist. Add caustic to water slowly, never water to caustic. Storage: Store in a cool, dry, well-ventilated area in the original corrosion-resistant container (polyethylene, lined steel, or stainless steel). Keep away from acids, aluminium, zinc, tin, organic halogens and nitro compounds. Keep containers closed. Solution may freeze below 54°F (12°C).

SECTION 8. EXPOSURE CONTROLS / PERSONAL PROTECTION
Exposure limits: Sodium hydroxide — OSHA PEL 2 mg/m³ (TWA); ACGIH TLV 2 mg/m³ (ceiling); NIOSH REL 2 mg/m³ (ceiling). Engineering controls: Local exhaust ventilation where mist may be generated; emergency eyewash and safety shower within 10 seconds of work areas. Eye and face protection: Chemical splash goggles and face shield. Skin protection: Neoprene, nitrile or butyl rubber gloves, chemical-resistant apron or suit, rubber boots. Respiratory protection: Where mist exceeds exposure limits, a NIOSH-approved respirator with particulate filter.

SECTION 9. PHYSICAL AND CHEMICAL PROPERTIES
Appearance: Clear, colourless to slightly turbid liquid. Odour: Odourless. pH: 14. Freezing point: 54°F (12°C). Boiling point: 293°F (145°C). Specific gravity: 1.52 at 68°F (20°C). Solubility in water: Complete. Vapour pressure: 1.5 mm Hg at 68°F.

SECTION 10. STABILITY AND REACTIVITY
Stable under recommended storage conditions. Reacts violently with acids. Reacts with aluminium, zinc, tin, brass and bronze to produce hydrogen. Absorbs carbon dioxide from the air. Hazardous decomposition: none under normal use.

SECTION 11. TOXICOLOGICAL INFORMATION
Acute effects: Severe burns to skin, eyes and mucous membranes on contact; ingestion causes severe burns to the mouth, throat and stomach, possibly perforation. Chronic effects: Repeated exposure to mist may cause dermatitis and damage to the respiratory tract. Carcinogenicity: Not listed by IARC, NTP or OSHA.

SECTION 12. ECOLOGICAL INFORMATION
Harmful to aquatic life through pH change. Do not release to the environment. Rapidly neutralised in the environment; does not bioaccumulate.

SECTION 13. DISPOSAL CONSIDERATIONS
Dispose of in accordance with federal, state and local regulations. Unneutralised product is a corrosive hazardous waste (RCRA D002).

SECTION 14. TRANSPORT INFORMATION
UN number: UN1824. Proper shipping name: Sodium hydroxide solution. Hazard class: 8. Packing group: II. DOT reportable quantity (RQ): 1,000 lb (sodium hydroxide).

SECTION 15. REGULATORY INFORMATION
TSCA: Listed. CERCLA RQ: 1,000 lb. SARA 311/312 hazard categories: Skin corrosion, Serious eye damage, Corrosive to metals. California Proposition 65: Not listed.

SECTION 16. OTHER INFORMATION
Prepared by: Northwest Alkali Products, Regulatory Affairs. Revision date: March 18, 2024. Changes from version 4.0: Section 8 updated to current ACGIH TLV; Section 14 packing group corrected. Disclaimer: The information in this SDS is believed to be accurate as of the revision date. It is the user's responsibility to determine suitability for their use.

---

## ANSWER KEY

Run three times. Passes when every "must" holds in all three.

Identity (must):
- kind: supplier_document
- issuer: Northwest Alkali Products (the supplier), not the company under scan
- agency: OSHA (HazCom) is the natural label; DOT may appear from section 14 and is acceptable. The label string identical across runs.
- site: company-wide or unassigned; the scan must not invent a site from the supplier's Portland address
- doc_date: revised March 18, 2024, kind "revised"

Status (must): not_judged (or the equivalent the schema uses for supplier documents). Never "compliant", never gaps_found.

Gaps (must): none. Any gap is a false finding, including a gap about the SDS's own content.

Deadlines (must): none. An SDS sets no deadline for the company. A line noting that HazCom requires the SDS to be readily accessible is fine as an expected-missing or a note, not as a deadline.

Conditions (must): none.

Facts (must not): no fact whose subject is the supplier (its name, address, phone, CHEMTREC number, revision history) or the chemical's own properties (classification, hazard statements, exposure limits, physical data, transport class). Those are facts about the document, not about the company, and the prompt's rule is that only facts about the company that would change what applies to it are proposed. Any such fact fails the run, whatever its basis.

Facts (acceptable, not required): a fact about the company drawn from holding this SDS, such as "the company holds an SDS for sodium hydroxide 50%" or "the company may store or handle sodium hydroxide 50%". The SDS does not say either, so such a fact must carry basis: inferred; the same fact with basis: read fails the run.

Summary (must, in some words): this is the supplier's document, kept for the company's Hazard Communication program; nothing in it is the company's to fix; what matters is that it is the current version and is available to employees.

Freshness: the revision is from 2024; a nudge that a newer SDS revision may exist is acceptable, not required.
