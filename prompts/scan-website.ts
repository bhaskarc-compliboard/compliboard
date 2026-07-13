/**
 * WEBSITE SCAN PROMPT
 * Reads a company's website (plus public directories via web search)
 * and builds the company profile used everywhere else.
 *
 * NOTE: this route calls the Anthropic API directly with fetch, because it
 * uses the web_search tool. askAI() does not support tools yet. When we add
 * tool support (the requirements engine will need it too), this route folds in.
 */
export const CERT_LIST = [
  'ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 22000',
  'FDA Registered', 'USDA Organic', 'cGMP', 'HACCP',
  'SEMI', 'SQF', 'BRC', 'NSF', 'UL Listed',
]

export const EXTRACTION_PROMPT = (siteText: string, url: string, industry: string) => `
You are extracting compliance-relevant business information for a company.

COMPANY WEBSITE URL: ${url}
INDUSTRY (user-selected): ${industry}

WEBSITE CONTENT:
${siteText}

Your job: extract factual information ONLY from what is explicitly stated in the website content above, or from well-known public business directories (LinkedIn, D&B, Buzzfile, ZoomInfo) about this specific company.

CRITICAL RULES:
- Only include certifications explicitly mentioned on their website
- For operations fields: true = confirmed on site, false = explicitly not applicable, null = unknown/not mentioned
- Never guess or infer ownership, gender, ethnicity, or political attributes
- If the site content is thin, rely more on public directory sources
- Return ONLY valid JSON, no explanation, no markdown, no preamble

Return this exact JSON shape:
{
  "certifications": [],
  "chemicals": [],
  "customers": [],
  "multiple_locations": false,
  "city": null,
  "state": null,
  "operations": {
    "repackaging": null,
    "hazmat_drivers": null,
    "onsite_chemical_storage": null,
    "liquor_license": null,
    "food_truck": null,
    "catering": null,
    "controlled_substances": null,
    "perc_solvents": null,
    "fda_manufacturing": null,
    "own_vehicles": null
  }
}

Known certifications to look for: ${CERT_LIST.join(', ')}

Fill in what you find. Use null for anything not mentioned or not applicable to this industry.
`
