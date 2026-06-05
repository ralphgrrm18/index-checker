import { NextRequest } from 'next/server'

interface CCRecord {
  timestamp: string
  url: string
  status: string
}

// 6 key indexes covering the LLM training data window (2021–2025)
const CC_INDEXES = [
  { id: 'CC-MAIN-2024-51', name: 'Dec 2024', date: '2024-12' },
  { id: 'CC-MAIN-2024-10', name: 'Mar 2024', date: '2024-03' },
  { id: 'CC-MAIN-2023-50', name: 'Dec 2023', date: '2023-12' },
  { id: 'CC-MAIN-2023-23', name: 'Jun 2023', date: '2023-06' },
  { id: 'CC-MAIN-2023-06', name: 'Jan 2023', date: '2023-01' },
  { id: 'CC-MAIN-2022-27', name: 'Jul 2022', date: '2022-07' },
]

const LLM_MODELS = [
  { name: 'GPT-4', provider: 'OpenAI', cutoff: '2023-04' },
  { name: 'GPT-4o / GPT-4o mini', provider: 'OpenAI', cutoff: '2023-10' },
  { name: 'o1 / o3', provider: 'OpenAI', cutoff: '2023-10' },
  { name: 'LLaMA 2', provider: 'Meta', cutoff: '2023-07' },
  { name: 'LLaMA 3 / 3.1', provider: 'Meta', cutoff: '2023-12' },
  { name: 'Claude 3 Opus/Sonnet', provider: 'Anthropic', cutoff: '2023-08' },
  { name: 'Claude 3.5 Sonnet', provider: 'Anthropic', cutoff: '2024-04' },
  { name: 'Gemini 1.5 Pro', provider: 'Google', cutoff: '2023-11' },
  { name: 'Mistral / Mixtral', provider: 'Mistral AI', cutoff: '2023-09' },
  { name: 'Command R', provider: 'Cohere', cutoff: '2023-03' },
  { name: 'Phi-3 / Phi-4', provider: 'Microsoft', cutoff: '2023-10' },
  { name: 'Falcon', provider: 'TII', cutoff: '2022-12' },
]

// CC CDX API expects URL without scheme and without trailing slash on root
function toCCUrl(url: string): string {
  const { host, pathname, search } = new URL(url)
  const path = pathname === '/' ? '' : pathname
  return host + path + search
}

function fmtTimestamp(ts: string): string {
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`
}

async function checkCommonCrawl(url: string) {
  const ccUrl = toCCUrl(url)

  const results = await Promise.allSettled(
    CC_INDEXES.map(async (index) => {
      // limit=1 + matchType=exact is fast even for domains with thousands of records
      const cdxUrl = `https://index.commoncrawl.org/${index.id}-index?url=${ccUrl}&output=json&limit=1&matchType=exact&filter=statuscode:200`
      try {
        const res = await fetch(cdxUrl, { signal: AbortSignal.timeout(12000) })
        if (!res.ok) {
          const rateLimited = res.status === 504 || res.status === 429 || res.status === 503
          return { ...index, found: false, snapshots: 0, timedOut: false, rateLimited }
        }

        const text = await res.text()
        const records: CCRecord[] = text.trim().split('\n').filter(Boolean).flatMap(line => {
          try { return [JSON.parse(line)] } catch { return [] }
        })

        const lastCrawled = records[0]?.timestamp ? fmtTimestamp(records[0].timestamp) : undefined
        return { ...index, found: records.length > 0, snapshots: records.length, lastCrawled, status: records[0]?.status, timedOut: false, rateLimited: false }
      } catch (e: unknown) {
        const err = e as Error & { cause?: { code?: string } }
        const isRateLimit = err.cause?.code === 'UND_ERR_CONNECT_TIMEOUT'
        const isTimeout = !isRateLimit && (err.name === 'TimeoutError' || err.message.includes('timeout'))
        return { ...index, found: false, snapshots: 0, timedOut: isTimeout, rateLimited: isRateLimit }
      }
    })
  )

  const indexResults = results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { ...CC_INDEXES[i], found: false, snapshots: 0, timedOut: false, rateLimited: false }
  )

  const found = indexResults.filter(r => r.found)
  const timedOut = indexResults.filter(r => r.timedOut).length
  const rateLimited = indexResults.filter(r => r.rateLimited).length
  const totalSnapshots = found.reduce((sum, r) => sum + r.snapshots, 0)
  const dates = found.map(r => r.date).sort()

  return {
    found: found.length > 0,
    totalSnapshots,
    indexCount: found.length,
    timedOutCount: timedOut,
    rateLimitedCount: rateLimited,
    unavailable: rateLimited + timedOut === indexResults.length,
    indexes: indexResults,
    firstSeen: dates[0],
    lastSeen: dates[dates.length - 1],
  }
}

async function checkWayback(url: string) {
  try {
    // Fast availability check first
    const availUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`
    const availRes = await fetch(availUrl, { signal: AbortSignal.timeout(8000) })

    if (!availRes.ok) return { found: false, totalSnapshots: 0, recentSnapshots: [] }

    const avail = await availRes.json()
    const snapshot = avail?.archived_snapshots?.closest

    if (!snapshot?.available) return { found: false, totalSnapshots: 0, recentSnapshots: [] }

    // Also get a few recent snapshots from CDX
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=5&fl=timestamp,statuscode&collapse=timestamp:6&fastLatest=true`
    let recentSnapshots: Array<{ timestamp: string; status: string }> = []
    let firstSnapshot: string | undefined
    let lastSnapshot: string | undefined

    try {
      const cdxRes = await fetch(cdxUrl, { signal: AbortSignal.timeout(10000) })
      if (cdxRes.ok) {
        const data = await cdxRes.json()
        if (Array.isArray(data) && data.length > 1) {
          const records = data.slice(1).map((row: string[]) => ({
            timestamp: fmtTimestamp(row[0]),
            status: row[1],
          }))
          const sorted = [...records].sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          firstSnapshot = sorted[0]?.timestamp
          lastSnapshot = sorted[sorted.length - 1]?.timestamp
          recentSnapshots = records
        }
      }
    } catch { /* CDX timed out, use availability data */ }

    const ts = snapshot.timestamp
    if (!firstSnapshot) firstSnapshot = fmtTimestamp(ts)
    if (!lastSnapshot) lastSnapshot = fmtTimestamp(ts)

    return {
      found: true,
      totalSnapshots: recentSnapshots.length || 1,
      firstSnapshot,
      lastSnapshot,
      recentSnapshots,
      archiveUrl: snapshot.url,
    }
  } catch {
    return { found: false, totalSnapshots: 0, recentSnapshots: [] }
  }
}

async function checkURLHealth(url: string) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IndexChecker/1.0)' },
      redirect: 'follow',
    })

    const robotsHeader = res.headers.get('x-robots-tag') ?? ''
    let metaRobots = ''
    let canonicalUrl = ''

    let seoMeta: { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string } = {}
    const ct = res.headers.get('content-type') ?? ''
    if (ct.includes('text/html')) {
      const html = await res.text()
      metaRobots = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1] ?? ''
      canonicalUrl = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? ''
      const getMeta = (prop: string, val: string) =>
        html.match(new RegExp(`<meta[^>]+${prop}=["']${val}["'][^>]*content=["']([^"']+)["']`, 'i'))?.[1]
        ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*${prop}=["']${val}["']`, 'i'))?.[1]
      seoMeta = {
        title: html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim(),
        description: getMeta('name', 'description'),
        ogTitle: getMeta('property', 'og:title'),
        ogDescription: getMeta('property', 'og:description'),
        ogImage: getMeta('property', 'og:image'),
      }
    }

    const directives = [robotsHeader, metaRobots].filter(Boolean)
    const all = directives.join(',').toLowerCase()

    return {
      accessible: true,
      statusCode: res.status,
      redirectUrl: res.redirected ? res.url : undefined,
      robotsDirectives: directives,
      noindex: all.includes('noindex'),
      nofollow: all.includes('nofollow'),
      nosnippet: all.includes('nosnippet'),
      canonicalUrl: canonicalUrl || undefined,
      seoMeta,
    }
  } catch (e: unknown) {
    return {
      accessible: false,
      robotsDirectives: [],
      noindex: false,
      nofollow: false,
      nosnippet: false,
      error: e instanceof Error ? e.message : 'Unreachable',
      seoMeta: {},
    }
  }
}

async function checkRobotsTxt(url: string) {
  try {
    const { protocol, host, pathname } = new URL(url)
    const robotsUrl = `${protocol}//${host}/robots.txt`
    const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(6000) })

    if (!res.ok) return { found: false, blockedByGoogle: false, blockedByBing: false, blockedByAI: false, rules: [] }

    const text = await res.text()
    const path = pathname || '/'

    const isBlocked = (ua: string): boolean => {
      const lines = text.split('\n')
      let active = false
      for (const line of lines) {
        const t = line.trim().toLowerCase()
        if (t.startsWith('user-agent:')) {
          const agent = t.replace('user-agent:', '').trim()
          active = agent === ua || agent === '*'
        } else if (active && t.startsWith('disallow:')) {
          const p = t.replace('disallow:', '').trim()
          if (p && path.startsWith(p)) return true
        }
      }
      return false
    }

    const rules = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).slice(0, 25)

    return {
      found: true,
      blockedByGoogle: isBlocked('googlebot'),
      blockedByBing: isBlocked('bingbot'),
      blockedByYahoo: isBlocked('slurp'),
      blockedByDuckDuckGo: isBlocked('duckduckbot'),
      blockedByAI: isBlocked('gptbot') || isBlocked('claudebot') || isBlocked('anthropic-ai') || isBlocked('google-extended'),
      rules,
    }
  } catch {
    return { found: false, blockedByGoogle: false, blockedByBing: false, blockedByYahoo: false, blockedByDuckDuckGo: false, blockedByAI: false, rules: [] }
  }
}

async function checkSitemap(url: string) {
  try {
    const { protocol, host } = new URL(url)
    const base = `${protocol}//${host}`

    let sitemapUrl = `${base}/sitemap.xml`
    try {
      const robotsRes = await fetch(`${base}/robots.txt`, { signal: AbortSignal.timeout(5000) })
      if (robotsRes.ok) {
        const txt = await robotsRes.text()
        const m = txt.match(/^Sitemap:\s*(.+)$/mi)
        if (m) sitemapUrl = m[1].trim()
      }
    } catch { /* use default */ }

    const res = await fetch(sitemapUrl, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { found: false, inSitemap: false, sitemapUrl }

    const xml = await res.text()
    if (xml.includes('<sitemapindex')) {
      return { found: true, inSitemap: false, sitemapUrl, isSitemapIndex: true }
    }

    const normalizedTarget = url.replace(/\/$/, '')
    for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
      const locMatch = block[1].match(/<loc>([^<]+)<\/loc>/)
      if (!locMatch) continue
      const loc = decodeURIComponent(locMatch[1].trim()).replace(/\/$/, '')
      if (loc === normalizedTarget) {
        return {
          found: true,
          inSitemap: true,
          sitemapUrl,
          lastmod: block[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim(),
          changefreq: block[1].match(/<changefreq>([^<]+)<\/changefreq>/)?.[1]?.trim(),
          priority: block[1].match(/<priority>([^<]+)<\/priority>/)?.[1]?.trim(),
        }
      }
    }

    return { found: true, inSitemap: false, sitemapUrl }
  } catch {
    return { found: false, inSitemap: false, sitemapUrl: null }
  }
}

// Factual Google index check via the Serper.dev SERP API (real live Google results, works
// for any URL). Requires SERPER_API_KEY. Degrades gracefully to { configured: false }.
// Google retired "Search the entire web" Programmable Search engines for new accounts
// (Jan 20, 2026), so a third-party SERP API is now the viable path for arbitrary URLs.
async function checkGoogleIndex(url: string) {
  const key = process.env.SERPER_API_KEY
  if (!key) return { configured: false as const }

  const { host, pathname, search } = new URL(url)
  const bare = host + (pathname === '/' ? '' : pathname) + search

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: `site:${bare}`, num: 10 }),
      signal: AbortSignal.timeout(10000),
    })
    if (res.status === 429) return { configured: true as const, indexed: null, error: 'quota' as const }
    if (res.status === 401 || res.status === 403) return { configured: true as const, indexed: null, error: 'auth' as const }
    if (!res.ok) return { configured: true as const, indexed: null, error: `http_${res.status}` }

    const json = await res.json()
    const organic: Array<{ link?: string }> = json.organic ?? []
    const norm = (u: string) => u.replace(/\/$/, '').toLowerCase()
    const target = norm(url)
    const exactMatch = organic.some(it => it.link && norm(it.link) === target)

    return {
      configured: true as const,
      indexed: organic.length > 0,
      exactMatch,
      totalResults: organic.length,
      topResult: organic[0]?.link,
    }
  } catch {
    return { configured: true as const, indexed: null, error: 'timeout' as const }
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return Response.json({ error: 'URL parameter required' }, { status: 400 })

  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
  } catch {
    return Response.json({ error: 'Invalid URL — must start with http:// or https://' }, { status: 400 })
  }

  const [ccRes, wbRes, healthRes, robotsRes, sitemapRes, gIndexRes] = await Promise.allSettled([
    checkCommonCrawl(url),
    checkWayback(url),
    checkURLHealth(url),
    checkRobotsTxt(url),
    checkSitemap(url),
    checkGoogleIndex(url),
  ])

  const cc = ccRes.status === 'fulfilled' ? ccRes.value
    : { found: false, totalSnapshots: 0, indexCount: 0, timedOutCount: 0, rateLimitedCount: 6, unavailable: true, indexes: [], firstSeen: undefined, lastSeen: undefined }
  const wayback = wbRes.status === 'fulfilled' ? wbRes.value
    : { found: false, totalSnapshots: 0, recentSnapshots: [] }
  const health = healthRes.status === 'fulfilled' ? healthRes.value
    : { accessible: false, robotsDirectives: [], noindex: false, nofollow: false, nosnippet: false }
  const robots = robotsRes.status === 'fulfilled' ? robotsRes.value
    : { found: false, blockedByGoogle: false, blockedByBing: false, blockedByYahoo: false, blockedByDuckDuckGo: false, blockedByAI: false, rules: [] }
  const sitemap = sitemapRes.status === 'fulfilled' ? sitemapRes.value
    : { found: false, inSitemap: false, sitemapUrl: null }
  const googleIndex = gIndexRes.status === 'fulfilled' ? gIndexRes.value
    : { configured: false as const }

  // For LLM coverage: prefer CC data; fall back to Wayback first-seen date when CC is unavailable
  const waybackFirstDate = (wayback as { firstSnapshot?: string }).firstSnapshot?.slice(0, 7) // "YYYY-MM"
  const ccUnavailable = cc.unavailable

  const llmCoverage = LLM_MODELS.map(llm => {
    const ccMatch = !ccUnavailable && (cc.indexes ?? []).find((idx: { found: boolean; date: string; name: string }) => idx.found && idx.date <= llm.cutoff)

    if (ccMatch) {
      return { name: llm.name, provider: llm.provider, likely: true, confidence: 'high' as const,
        reason: `In Common Crawl from ${ccMatch.name} (before ${llm.cutoff} cutoff)` }
    }

    // Fallback: Wayback Machine as proxy
    const wbEarlyEnough = waybackFirstDate && waybackFirstDate <= llm.cutoff
    if (ccUnavailable && wbEarlyEnough) {
      return { name: llm.name, provider: llm.provider, likely: true, confidence: 'medium' as const,
        reason: `First archived ${waybackFirstDate} (before ${llm.cutoff} cutoff) — CC unavailable to confirm` }
    }
    if (ccUnavailable) {
      return { name: llm.name, provider: llm.provider, likely: false, confidence: 'low' as const,
        reason: 'CC rate-limited; Wayback shows URL appeared after training cutoff or not found' }
    }

    return { name: llm.name, provider: llm.provider, likely: false, confidence: 'high' as const,
      reason: cc.found ? `Only in CC after ${llm.cutoff} training cutoff` : 'Not found in Common Crawl' }
  })

  return Response.json({ url, checkedAt: new Date().toISOString(), commonCrawl: cc, wayback, urlHealth: health, robotsTxt: robots, sitemap, googleIndex, llmCoverage: { models: llmCoverage } })
}
