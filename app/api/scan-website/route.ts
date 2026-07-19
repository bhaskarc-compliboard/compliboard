import { NextRequest, NextResponse } from 'next/server'
import { EXTRACTION_PROMPT } from '@/prompts/scan-website'

const SUBPAGES = [
  'products', 'services', 'about', 'quality', 'about-us', 'capabilities',
  'what-we-do', 'our-products', 'chemicals', 'certifications',
  'locations', 'facilities', 'who-we-are', 'company', 'manufacturing',
]

async function fetchPageText(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CompliBoard/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000)
  } catch {
    return ''
  }
}

async function fetchSiteContent(rawUrl: string): Promise<string> {
  let base = rawUrl.trim()
  if (!base.startsWith('http')) base = 'https://' + base
  base = base.replace(/\/$/, '')

  // Fetch homepage first — always required
  const home = await fetchPageText(base)
  if (!home) return ''

  const pages: string[] = [`[Homepage]\n${home}`]

  // Fetch all subpages in parallel — each page gets up to 10s to respond
  const results = await Promise.allSettled(
    SUBPAGES.map(sub => fetchPageText(`${base}/${sub}`))
  )

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value && result.value.length > 200) {
      pages.push(`[/${SUBPAGES[i]}]\n${result.value}`)
    }
  })

  return pages.join('\n\n---\n\n')
}

export async function POST(request: NextRequest) {
  try {
    const { url, industry } = await request.json()
    if (!url || url.trim().length < 4) {
      return NextResponse.json({ success: false, reason: 'no_url' })
    }

    // Fetch site content server-side
    const siteText = await fetchSiteContent(url)
    if (!siteText || siteText.length < 100) {
      return NextResponse.json({ success: false, reason: 'empty_site' })
    }

    // Call Claude with web search enabled
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        temperature: 0.1, // extraction is a judgment task — consistency matters more than variety here
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [
          {
            role: 'user',
            content: EXTRACTION_PROMPT(siteText, url, industry),
          },
        ],
      }),
    })

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text()
      console.error('Anthropic error:', err)
      return NextResponse.json({ success: false, reason: 'claude_error' })
    }

    const anthropicData = await anthropicRes.json()

    // Extract the text content from the response
    const textBlock = anthropicData.content
      ?.filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('')

    if (!textBlock) {
      return NextResponse.json({ success: false, reason: 'no_response' })
    }

    // Parse JSON — strip any accidental markdown fences
    const clean = textBlock.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    return NextResponse.json({ success: true, data: extracted })
  } catch (err) {
    console.error('Scan error:', err)
    return NextResponse.json({ success: false, reason: 'parse_error' })
  }
}
