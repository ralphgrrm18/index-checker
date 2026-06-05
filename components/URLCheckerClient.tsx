'use client'

import { useState, useCallback, useEffect } from 'react'

interface IndexResult {
  id: string
  name: string
  date: string
  found: boolean
  snapshots: number
  lastCrawled?: string
  status?: string
}

interface CheckData {
  url: string
  checkedAt: string
  commonCrawl: {
    found: boolean
    totalSnapshots: number
    indexCount: number
    timedOutCount: number
    rateLimitedCount: number
    unavailable: boolean
    indexes: IndexResult[]
    firstSeen?: string
    lastSeen?: string
  }
  wayback: {
    found: boolean
    totalSnapshots: number
    firstSnapshot?: string
    lastSnapshot?: string
    recentSnapshots: Array<{ timestamp: string; status: string }>
  }
  urlHealth: {
    accessible: boolean
    statusCode?: number
    redirectUrl?: string
    robotsDirectives: string[]
    noindex: boolean
    nofollow: boolean
    nosnippet?: boolean
    canonicalUrl?: string
    error?: string
    seoMeta: {
      title?: string
      description?: string
      ogTitle?: string
      ogDescription?: string
      ogImage?: string
    }
  }
  sitemap: {
    found: boolean
    inSitemap: boolean
    sitemapUrl: string | null
    isSitemapIndex?: boolean
    lastmod?: string
    changefreq?: string
    priority?: string
  }
  googleIndex: {
    configured: boolean
    indexed?: boolean | null
    exactMatch?: boolean
    totalResults?: number
    topResult?: string
    error?: string
  }
  robotsTxt: {
    found: boolean
    blockedByGoogle: boolean
    blockedByBing: boolean
    blockedByYahoo: boolean
    blockedByDuckDuckGo: boolean
    blockedByAI: boolean
    rules: string[]
  }
  llmCoverage: {
    models: Array<{
      name: string
      provider: string
      likely: boolean
      confidence: 'high' | 'medium' | 'low'
      reason: string
    }>
  }
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
      ok ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
         : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {label}
    </span>
  )
}

function Card({ title, children, icon }: { title: string; children: React.ReactNode; icon: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        <span>{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</span>
      <span className="text-xs font-medium text-zinc-500">{label}</span>
      {sub && <span className="text-xs text-zinc-400 mt-0.5">{sub}</span>}
    </div>
  )
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
      {children}
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </a>
  )
}

interface SubmitResult {
  url: string
  submittedAt: string
  anyAccepted: boolean
  engines: Array<{ name: string; status: number; accepted: boolean }>
}

function SubmitForIndexing({ targetUrl, noindex, blockedByGoogle, blockedByBing }: {
  targetUrl: string
  noindex: boolean
  blockedByGoogle: boolean
  blockedByBing: boolean
}) {
  const [key, setKey] = useState('')
  const [keyLocation, setKeyLocation] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)

  // Persist key in localStorage
  useEffect(() => {
    const saved = localStorage.getItem('indexnow_key')
    if (saved) setKey(saved)
  }, [])

  const saveKey = (v: string) => {
    setKey(v)
    if (v) localStorage.setItem('indexnow_key', v)
    else localStorage.removeItem('indexnow_key')
  }

  const submit = async () => {
    if (!key.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl, key: key.trim(), keyLocation: keyLocation.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Submission failed')
      setResult(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const host = (() => { try { return new URL(targetUrl).hostname } catch { return '' } })()
  const gscUrl = `https://search.google.com/search-console/inspect?resource_id=${encodeURIComponent(targetUrl)}&id=${encodeURIComponent(targetUrl)}`

  const hasBlocker = noindex || blockedByGoogle || blockedByBing

  return (
    <Card title="Request Indexing" icon="📡">
      {hasBlocker && (
        <div className="mb-4 px-3 py-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-xs text-yellow-700 dark:text-yellow-400 space-y-1">
          {noindex && <p>⚠ <strong>noindex</strong> directive detected — crawlers will visit but won&apos;t add this URL to their index.</p>}
          {blockedByGoogle && <p>⚠ <strong>Googlebot is blocked</strong> by robots.txt — Google won&apos;t crawl this URL.</p>}
          {blockedByBing && <p>⚠ <strong>Bingbot is blocked</strong> by robots.txt — Bing won&apos;t crawl this URL.</p>}
        </div>
      )}

      {/* Google */}
      <div className="mb-4">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2">Google</p>
        <p className="text-xs text-zinc-500 mb-2">
          Google has no public ping API. Use Search Console to request indexing directly.
        </p>
        <ExternalLink href={gscUrl}>
          Open URL Inspection in Search Console
        </ExternalLink>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
        {/* IndexNow — Bing + Yandex */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">IndexNow <span className="font-normal text-zinc-400">(Bing, Yandex)</span></p>
          <button
            onClick={() => setShowHelp(h => !h)}
            className="text-xs text-blue-500 hover:underline"
          >
            {showHelp ? 'Hide setup guide' : 'How to set up?'}
          </button>
        </div>

        {showHelp && (
          <div className="mb-3 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs text-zinc-500 space-y-1.5">
            <p><strong className="text-zinc-700 dark:text-zinc-300">1.</strong> Generate any random string as your key (e.g. <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">a1b2c3d4e5f6g7h8</code>)</p>
            <p><strong className="text-zinc-700 dark:text-zinc-300">2.</strong> Create a text file at <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">https://{host || 'yoursite.com'}/<em>yourkey</em>.txt</code> containing just the key on one line.</p>
            <p><strong className="text-zinc-700 dark:text-zinc-300">3.</strong> Paste the key below and submit. Bing and Yandex will crawl the URL within minutes.</p>
            <p className="text-zinc-400">Alternatively, host the key at a custom location and fill in the Key Location field.</p>
          </div>
        )}

        <div className="space-y-2">
          <input
            type="text"
            value={key}
            onChange={e => saveKey(e.target.value)}
            placeholder="IndexNow API key"
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
          <input
            type="text"
            value={keyLocation}
            onChange={e => setKeyLocation(e.target.value)}
            placeholder={`Key location (optional, e.g. https://${host || 'yoursite.com'}/mykey.txt)`}
            className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={submit}
            disabled={loading || !key.trim()}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
          >
            {loading ? 'Submitting…' : 'Submit to Bing & Yandex via IndexNow'}
          </button>
        </div>

        {error && (
          <p className="mt-2 text-xs text-red-500">{error}</p>
        )}

        {result && (
          <div className="mt-3 space-y-1.5">
            {result.engines.map(e => (
              <div key={e.name} className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">{e.name}</span>
                <StatusBadge
                  ok={e.accepted}
                  label={e.accepted ? `Accepted (HTTP ${e.status})` : e.status === 403 ? 'Key not found (403)' : e.status === 422 ? 'URL/key mismatch (422)' : e.status === 429 ? 'Rate limited (429)' : `HTTP ${e.status || 'error'}`}
                />
              </div>
            ))}
            {result.anyAccepted && (
              <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                Submission accepted — crawlers will visit this URL shortly.
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

function SingleChecker() {
  const [inputUrl, setInputUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CheckData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<string[]>([])

  const check = useCallback(async (urlToCheck?: string) => {
    const target = urlToCheck ?? inputUrl.trim()
    if (!target) return

    // Auto-add https:// if missing
    const normalized = target.startsWith('http') ? target : `https://${target}`

    setLoading(true)
    setError(null)
    setData(null)

    window.history.replaceState({}, '', `?url=${encodeURIComponent(normalized)}`)

    try {
      const res = await fetch(`/api/check?url=${encodeURIComponent(normalized)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Check failed')
      setData(json)
      setHistory(prev => {
        const updated = [normalized, ...prev.filter(u => u !== normalized)].slice(0, 8)
        localStorage.setItem('url_check_history', JSON.stringify(updated))
        return updated
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }, [inputUrl])

  useEffect(() => {
    const saved: string[] = JSON.parse(localStorage.getItem('url_check_history') || '[]')
    setHistory(saved)
    const params = new URLSearchParams(window.location.search)
    const urlParam = params.get('url')
    if (urlParam) {
      setInputUrl(urlParam)
      check(urlParam)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const encodedUrl = data?.url ? encodeURIComponent(data.url) : ''
  const rawUrl = data?.url ?? ''

  return (
    <>
      {/* Search form */}
      <form
        onSubmit={e => { e.preventDefault(); check() }}
        className="flex gap-2 mb-8"
      >
        <input
          type="text"
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          placeholder="https://example.com/page"
          className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading || !inputUrl.trim()}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? 'Checking…' : 'Check'}
        </button>
      </form>

      {history.length > 0 && !data && !loading && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span className="text-xs text-zinc-400 shrink-0">Recent:</span>
          {history.map(h => (
            <button
              key={h}
              onClick={() => { setInputUrl(h); check(h) }}
              className="px-2.5 py-1 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 truncate max-w-[220px]"
            >
              {h.replace(/^https?:\/\//, '')}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-20 text-zinc-400">
          <div className="w-8 h-8 border-2 border-zinc-200 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm">Running checks across crawl indexes…</p>
        </div>
      )}

      {data && !loading && (
        <div className="space-y-4">
          {/* URL summary bar */}
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-500">
            <span className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-xs">{data.url}</span>
            <span>·</span>
            <span>Checked {new Date(data.checkedAt).toLocaleTimeString()}</span>
            {data.urlHealth.noindex && (
              <span className="ml-auto px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-medium">
                noindex detected
              </span>
            )}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Google */}
            <Card title="Google Search" icon="🔍">
              {data.googleIndex?.configured ? (
                <div className="mb-3">
                  {data.googleIndex.error === 'quota' ? (
                    <StatusBadge ok={false} label="API credits exhausted — try later" />
                  ) : data.googleIndex.error === 'auth' ? (
                    <StatusBadge ok={false} label="Invalid Serper API key" />
                  ) : data.googleIndex.indexed === null || data.googleIndex.indexed === undefined ? (
                    <StatusBadge ok={false} label="Index check failed" />
                  ) : data.googleIndex.indexed && data.googleIndex.exactMatch ? (
                    <StatusBadge ok label="Indexed — found in Google results" />
                  ) : data.googleIndex.indexed ? (
                    <StatusBadge ok={false} label="Exact URL not found (pages under this path are indexed)" />
                  ) : (
                    <StatusBadge ok={false} label="Not indexed — not found in Google results" />
                  )}
                  {typeof data.googleIndex.totalResults === 'number' && !data.googleIndex.error && (
                    <p className="text-xs text-zinc-400 mt-2">
                      Live <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">site:</code> query via Google (Serper) · {data.googleIndex.totalResults} match{data.googleIndex.totalResults === 1 ? '' : 'es'} returned
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-500 mb-3">
                  Live index check not configured. Use the <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">site:</code> operator to check manually.
                </p>
              )}
              <div className="flex flex-col gap-2">
                <ExternalLink href={`https://www.google.com/search?q=site%3A${encodeURIComponent(rawUrl.replace(/^https?:\/\//, ''))}`}>
                  Check site: on Google
                </ExternalLink>
                <ExternalLink href="https://search.google.com/search-console">
                  URL Inspection (Search Console)
                </ExternalLink>
              </div>
              {data.robotsTxt.found && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <StatusBadge ok={!data.robotsTxt.blockedByGoogle} label={data.robotsTxt.blockedByGoogle ? 'Blocked by robots.txt' : 'Not blocked in robots.txt'} />
                </div>
              )}
            </Card>

            {/* Bing */}
            <Card title="Bing Search" icon="🌐">
              <p className="text-xs text-zinc-500 mb-3">
                Check Bing's index using the <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">site:</code> operator, or use Bing Webmaster Tools for verified sites.
              </p>
              <div className="flex flex-col gap-2">
                <ExternalLink href={`https://www.bing.com/search?q=site%3A${encodeURIComponent(rawUrl.replace(/^https?:\/\//, ''))}`}>
                  Check site: on Bing
                </ExternalLink>
                <ExternalLink href="https://www.bing.com/webmasters">
                  Bing Webmaster Tools
                </ExternalLink>
              </div>
              {data.robotsTxt.found && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <StatusBadge ok={!data.robotsTxt.blockedByBing} label={data.robotsTxt.blockedByBing ? 'Blocked by robots.txt' : 'Not blocked in robots.txt'} />
                </div>
              )}
            </Card>

            {/* Yahoo */}
            <Card title="Yahoo Search" icon="🟣">
              <p className="text-xs text-zinc-500 mb-3">
                Yahoo&apos;s web search is powered by Bing&apos;s index. If Bing has indexed this URL, it will appear in Yahoo results too.
              </p>
              <div className="flex flex-col gap-2">
                <ExternalLink href={`https://search.yahoo.com/search?p=site%3A${encodeURIComponent(rawUrl.replace(/^https?:\/\//, ''))}`}>
                  Check site: on Yahoo
                </ExternalLink>
              </div>
              {data.robotsTxt.found && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Slurp (Yahoo bot)</span>
                    <StatusBadge ok={!data.robotsTxt.blockedByYahoo} label={data.robotsTxt.blockedByYahoo ? 'Blocked' : 'Allowed'} />
                  </div>
                  <p className="text-xs text-zinc-400">Note: Yahoo primarily uses Bing&apos;s index, so Bingbot access matters most.</p>
                </div>
              )}
            </Card>

            {/* DuckDuckGo */}
            <Card title="DuckDuckGo" icon="🦆">
              <p className="text-xs text-zinc-500 mb-3">
                DuckDuckGo sources results primarily from Bing, plus its own crawler (DuckDuckBot). No public indexation API is available.
              </p>
              <div className="flex flex-col gap-2">
                <ExternalLink href={`https://duckduckgo.com/?q=site%3A${encodeURIComponent(rawUrl.replace(/^https?:\/\//, ''))}`}>
                  Check site: on DuckDuckGo
                </ExternalLink>
              </div>
              {data.robotsTxt.found && (
                <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">DuckDuckBot</span>
                    <StatusBadge ok={!data.robotsTxt.blockedByDuckDuckGo} label={data.robotsTxt.blockedByDuckDuckGo ? 'Blocked' : 'Allowed'} />
                  </div>
                </div>
              )}
            </Card>

            {/* Common Crawl */}
            <Card title="Common Crawl" icon="🕷️">
              {data.commonCrawl.unavailable ? (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                    <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400">Rate limited</span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    The CC CDX API is temporarily rate-limiting this IP. Results will be available when deployed (each request uses a different server IP). Retry in a minute.
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex gap-5">
                      <Stat label="Snapshots" value={data.commonCrawl.totalSnapshots} />
                      <Stat label="CC Indexes" value={`${data.commonCrawl.indexCount} / 6`} />
                    </div>
                    <StatusBadge ok={data.commonCrawl.found} label={data.commonCrawl.found ? 'Found' : 'Not found'} />
                  </div>

                  {data.commonCrawl.found && (
                    <div className="text-xs text-zinc-500 mb-3 space-y-0.5">
                      {data.commonCrawl.firstSeen && <p>First seen: <span className="text-zinc-700 dark:text-zinc-300">{data.commonCrawl.firstSeen}</span></p>}
                      {data.commonCrawl.lastSeen && <p>Last seen: <span className="text-zinc-700 dark:text-zinc-300">{data.commonCrawl.lastSeen}</span></p>}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1 mt-2">
                    {data.commonCrawl.indexes.map(idx => (
                      <div
                        key={idx.id}
                        title={idx.found ? `Found — status ${idx.status}, crawled ${idx.lastCrawled}` : (idx as IndexResult & { rateLimited?: boolean; timedOut?: boolean }).rateLimited ? 'Rate limited' : 'Not found'}
                        className={`px-1.5 py-1 rounded text-center text-xs ${
                          idx.found
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : (idx as IndexResult & { rateLimited?: boolean }).rateLimited
                              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {idx.name}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>

            {/* Wayback Machine */}
            <Card title="Wayback Machine" icon="📼">
              <div className="flex items-start justify-between mb-4">
                <Stat
                  label="Snapshots"
                  value={data.wayback.totalSnapshots}
                  sub={data.wayback.firstSnapshot ? `since ${data.wayback.firstSnapshot}` : undefined}
                />
                <StatusBadge ok={data.wayback.found} label={data.wayback.found ? 'Archived' : 'Not archived'} />
              </div>

              {data.wayback.recentSnapshots.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-400 mb-1.5">Recent snapshots</p>
                  {data.wayback.recentSnapshots.map((s, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <ExternalLink href={`https://web.archive.org/web/${s.timestamp.replace(/-/g, '')}000000*/${rawUrl}`}>
                        {s.timestamp}
                      </ExternalLink>
                      <span className={`text-xs px-1.5 rounded ${
                        s.status === '200' ? 'text-green-600 dark:text-green-400' : 'text-zinc-400'
                      }`}>
                        HTTP {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* URL Health */}
            <Card title="URL Health" icon="🩺">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Accessible</span>
                  <StatusBadge ok={data.urlHealth.accessible} label={
                    data.urlHealth.accessible ? `HTTP ${data.urlHealth.statusCode}` : 'Unreachable'
                  } />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">noindex directive</span>
                  <StatusBadge ok={!data.urlHealth.noindex} label={data.urlHealth.noindex ? 'Present (blocks indexing)' : 'Not set'} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">nofollow directive</span>
                  <StatusBadge ok={!data.urlHealth.nofollow} label={data.urlHealth.nofollow ? 'Present' : 'Not set'} />
                </div>
                {data.urlHealth.redirectUrl && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs text-zinc-400">Redirects to</p>
                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate mt-0.5">{data.urlHealth.redirectUrl}</p>
                  </div>
                )}
                {data.urlHealth.canonicalUrl && (
                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <p className="text-xs text-zinc-400">Canonical URL</p>
                    <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400 truncate mt-0.5">{data.urlHealth.canonicalUrl}</p>
                  </div>
                )}
                {data.urlHealth.error && (
                  <p className="text-xs text-red-500 mt-1">{data.urlHealth.error}</p>
                )}
              </div>
            </Card>

            {/* robots.txt */}
            <Card title="robots.txt" icon="🤖">
              {data.robotsTxt.found ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Googlebot</span>
                    <StatusBadge ok={!data.robotsTxt.blockedByGoogle} label={data.robotsTxt.blockedByGoogle ? 'Blocked' : 'Allowed'} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Bingbot</span>
                    <StatusBadge ok={!data.robotsTxt.blockedByBing} label={data.robotsTxt.blockedByBing ? 'Blocked' : 'Allowed'} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Slurp (Yahoo)</span>
                    <StatusBadge ok={!data.robotsTxt.blockedByYahoo} label={data.robotsTxt.blockedByYahoo ? 'Blocked' : 'Allowed'} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">DuckDuckBot</span>
                    <StatusBadge ok={!data.robotsTxt.blockedByDuckDuckGo} label={data.robotsTxt.blockedByDuckDuckGo ? 'Blocked' : 'Allowed'} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">AI crawlers (GPTBot, ClaudeBot…)</span>
                    <StatusBadge ok={!data.robotsTxt.blockedByAI} label={data.robotsTxt.blockedByAI ? 'Blocked' : 'Allowed'} />
                  </div>
                  {data.robotsTxt.rules.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600">
                        View rules ({data.robotsTxt.rules.length})
                      </summary>
                      <pre className="mt-2 text-xs bg-zinc-50 dark:bg-zinc-800 rounded p-2 overflow-x-auto max-h-32 text-zinc-600 dark:text-zinc-400">
                        {data.robotsTxt.rules.join('\n')}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-xs text-zinc-500">robots.txt not found or inaccessible</span>
                </div>
              )}
            </Card>

            {/* SEO & Social Preview */}
            <Card title="SEO & Social Preview" icon="🏷️">
              {data.urlHealth.seoMeta && Object.values(data.urlHealth.seoMeta).some(Boolean) ? (
                <div className="space-y-3">
                  {(data.urlHealth.seoMeta.title || data.urlHealth.seoMeta.ogTitle) && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-0.5">Title</p>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-snug">
                        {data.urlHealth.seoMeta.ogTitle || data.urlHealth.seoMeta.title}
                      </p>
                      {data.urlHealth.seoMeta.ogTitle && data.urlHealth.seoMeta.title && data.urlHealth.seoMeta.ogTitle !== data.urlHealth.seoMeta.title && (
                        <p className="text-xs text-zinc-400 mt-0.5">HTML title: {data.urlHealth.seoMeta.title}</p>
                      )}
                    </div>
                  )}
                  {(data.urlHealth.seoMeta.description || data.urlHealth.seoMeta.ogDescription) && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-0.5">Description</p>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {data.urlHealth.seoMeta.ogDescription || data.urlHealth.seoMeta.description}
                      </p>
                    </div>
                  )}
                  {data.urlHealth.seoMeta.ogImage && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">OG Image</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={data.urlHealth.seoMeta.ogImage}
                        alt="Open Graph preview"
                        className="rounded-lg w-full object-cover max-h-40 border border-zinc-200 dark:border-zinc-700"
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-zinc-400">
                  {data.urlHealth.accessible ? 'No meta tags found.' : 'Page not accessible.'}
                </p>
              )}
            </Card>

            {/* Sitemap */}
            <Card title="Sitemap.xml" icon="🗺️">
              {data.sitemap.found ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Listed in sitemap</span>
                    <StatusBadge ok={data.sitemap.inSitemap} label={data.sitemap.inSitemap ? 'Found' : 'Not listed'} />
                  </div>
                  {data.sitemap.isSitemapIndex && (
                    <p className="text-xs text-zinc-400">Site uses a sitemap index — child sitemaps not checked.</p>
                  )}
                  {data.sitemap.inSitemap && (
                    <div className="space-y-2 pt-1">
                      {data.sitemap.lastmod && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Last modified</span>
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">{data.sitemap.lastmod}</span>
                        </div>
                      )}
                      {data.sitemap.changefreq && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Change frequency</span>
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">{data.sitemap.changefreq}</span>
                        </div>
                      )}
                      {data.sitemap.priority && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-zinc-500">Priority</span>
                          <span className="text-xs text-zinc-700 dark:text-zinc-300">{data.sitemap.priority}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {data.sitemap.sitemapUrl && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <ExternalLink href={data.sitemap.sitemapUrl}>View sitemap.xml</ExternalLink>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                  <span className="text-xs text-zinc-500">No sitemap.xml found</span>
                </div>
              )}
            </Card>
          </div>

          {/* LLM Coverage — full width */}
          <Card title="LLM Training Data Coverage" icon="🧠">
            <p className="text-xs text-zinc-400 mb-4">
              {data.commonCrawl.unavailable
                ? 'CC CDX unavailable — using Wayback Machine archival date as proxy. High-confidence results require CC data.'
                : 'Based on Common Crawl indexes vs. each model\'s training data cutoff.'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {data.llmCoverage.models.map(m => {
                const dotColor = m.likely
                  ? m.confidence === 'high' ? 'bg-green-500' : 'bg-yellow-400'
                  : 'bg-zinc-300 dark:bg-zinc-600'
                const cardBg = m.likely
                  ? m.confidence === 'high'
                    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                    : 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900'
                return (
                  <div key={m.name} className={`px-3 py-2.5 rounded-lg border ${cardBg}`} title={m.reason}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{m.name}</p>
                        <p className="text-xs text-zinc-400">{m.provider}</p>
                      </div>
                      <span className={`shrink-0 w-2 h-2 rounded-full ${dotColor}`} />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {m.likely
                        ? m.confidence === 'high' ? '✓ Likely included' : '~ Possibly included'
                        : '✗ Likely not included'}
                    </p>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Request Indexing */}
          <SubmitForIndexing
            targetUrl={data.url}
            noindex={data.urlHealth.noindex}
            blockedByGoogle={data.robotsTxt.blockedByGoogle}
            blockedByBing={data.robotsTxt.blockedByBing}
          />

          {/* Backlinks section */}
          <Card title="Backlink Checkers" icon="🔗">
            <p className="text-xs text-zinc-500 mb-3">
              Backlink data requires third-party crawl databases. These tools offer free tiers:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <ExternalLink href={`https://ahrefs.com/backlink-checker?input=${encodedUrl}`}>Ahrefs Free Backlink Checker</ExternalLink>
              <ExternalLink href={`https://moz.com/link-explorer?site=${encodedUrl}`}>Moz Link Explorer</ExternalLink>
              <ExternalLink href={`https://semrush.com/analytics/backlinks/?target=${encodedUrl}&targetType=url`}>SEMrush Backlink Checker</ExternalLink>
              <ExternalLink href={`https://majestic.com/reports/site-explorer?IndexDataSource=F&oq=${encodedUrl}`}>Majestic Site Explorer</ExternalLink>
            </div>
          </Card>
        </div>
      )}
    </>
  )
}

interface BulkRow {
  url: string
  status: 'pending' | 'checking' | 'done' | 'error'
  data?: CheckData
  error?: string
}

type Tone = 'good' | 'bad' | 'warn' | 'neutral'
interface Cell { tone: Tone; label: string }

function BulkBadge({ tone, label }: Cell) {
  const cls = {
    good: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    bad: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    warn: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    neutral: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  }[tone]
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>
}

// Google column. When the Programmable Search API is configured we report FACTUAL index
// status (actually in Google's SERP or not). Otherwise we fall back to the crawlability
// heuristic ("No blockers" = nothing prevents indexing, but not proof it's indexed).
function googleCell(d: CheckData): Cell {
  const gi = d.googleIndex
  if (gi?.configured) {
    if (gi.error === 'quota') return { tone: 'neutral', label: 'quota hit' }
    if (gi.error === 'auth') return { tone: 'neutral', label: 'bad API key' }
    if (gi.indexed === null || gi.indexed === undefined) return { tone: 'neutral', label: 'check failed' }
    if (gi.indexed && gi.exactMatch) return { tone: 'good', label: 'indexed' }
    if (gi.indexed) return { tone: 'warn', label: 'path indexed' }
    return { tone: 'bad', label: 'not indexed' }
  }
  // Heuristic fallback (no API key configured)
  if (!d.urlHealth.accessible) return { tone: 'neutral', label: 'unreachable' }
  if (d.robotsTxt.found && d.robotsTxt.blockedByGoogle) return { tone: 'bad', label: 'robots blocked' }
  if (d.urlHealth.noindex) return { tone: 'bad', label: 'noindex' }
  if (d.urlHealth.nosnippet) return { tone: 'warn', label: 'No blockers · no AI' }
  return { tone: 'good', label: 'No blockers' }
}

// Most recent date the URL was seen in any crawl/archive source — a proxy for "still indexed".
// CC lastSeen is "YYYY-MM"; Wayback lastSnapshot is "YYYY-MM-DD" — lexical max works for both.
function lastSeen(d: CheckData): string | undefined {
  const dates = [d.commonCrawl.lastSeen, d.wayback.lastSnapshot].filter(Boolean) as string[]
  return dates.length ? dates.sort()[dates.length - 1] : undefined
}

function bingCell(d: CheckData): Cell {
  if (!d.urlHealth.accessible) return { tone: 'neutral', label: 'unreachable' }
  if (d.robotsTxt.found && d.robotsTxt.blockedByBing) return { tone: 'bad', label: 'robots blocked' }
  if (d.urlHealth.noindex) return { tone: 'bad', label: 'noindex' }
  return { tone: 'good', label: 'No blockers' }
}

// LLM training-data coverage for a provider, aggregated across that provider's models.
function llmCell(d: CheckData, provider: string): Cell {
  const subset = d.llmCoverage.models.filter(m => m.provider === provider)
  if (subset.length === 0) return { tone: 'neutral', label: 'n/a' }
  const likely = subset.filter(m => m.likely)
  if (likely.some(m => m.confidence === 'high')) return { tone: 'good', label: 'likely' }
  if (likely.length > 0) return { tone: 'warn', label: 'maybe' }
  return { tone: 'neutral', label: 'unlikely' }
}

function BulkChecker() {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<BulkRow[]>([])
  const [running, setRunning] = useState(false)

  const parseUrls = (raw: string): string[] => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const line of raw.split(/[\n,]/)) {
      const t = line.trim()
      if (!t) continue
      const normalized = t.startsWith('http') ? t : `https://${t}`
      if (!seen.has(normalized)) { seen.add(normalized); out.push(normalized) }
    }
    return out
  }

  const runBulk = useCallback(async () => {
    const urls = parseUrls(text).slice(0, 50) // cap to keep it sane
    if (urls.length === 0) return

    setRunning(true)
    const initial: BulkRow[] = urls.map(url => ({ url, status: 'pending' }))
    setRows(initial)

    const CONCURRENCY = 3
    let cursor = 0

    const worker = async () => {
      while (cursor < urls.length) {
        const i = cursor++
        const url = urls[i]
        setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'checking' } : r))
        try {
          const res = await fetch(`/api/check?url=${encodeURIComponent(url)}`)
          const json = await res.json()
          if (!res.ok) throw new Error(json.error || 'Check failed')
          setRows(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'done', data: json } : r))
        } catch (e: unknown) {
          setRows(prev => prev.map((r, idx) => idx === i
            ? { ...r, status: 'error', error: e instanceof Error ? e.message : 'Error' }
            : r))
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker))
    setRunning(false)
  }, [text])

  const doneCount = rows.filter(r => r.status === 'done' || r.status === 'error').length
  const urlCount = parseUrls(text).length

  const exportCsv = () => {
    const header = ['URL', 'HTTP', 'Google', 'Bing Search', 'Gemini (Google)', 'OpenAI', 'Last seen']
    const lines = rows.filter(r => r.data).map(r => {
      const d = r.data!
      return [
        d.url,
        d.urlHealth.accessible ? d.urlHealth.statusCode ?? '' : 'unreachable',
        googleCell(d).label,
        bingCell(d).label,
        llmCell(d, 'Google').label,
        llmCell(d, 'OpenAI').label,
        lastSeen(d) ?? '',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const csv = [header.join(','), ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'index-check-results.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div className="mb-6">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={6}
          placeholder={'One URL per line (or comma-separated)\nhttps://example.com/page-1\nhttps://example.com/page-2'}
          className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono resize-y"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-zinc-400">
            {urlCount > 0 ? `${urlCount} URL${urlCount === 1 ? '' : 's'}${urlCount > 50 ? ' (first 50 will be checked)' : ''}` : 'Up to 50 URLs'}
          </span>
          <div className="flex gap-2">
            {rows.some(r => r.data) && !running && (
              <button
                onClick={exportCsv}
                className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-sm font-medium rounded-lg transition-colors"
              >
                Export CSV
              </button>
            )}
            <button
              onClick={runBulk}
              disabled={running || urlCount === 0}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {running ? `Checking… (${doneCount}/${rows.length})` : 'Check all'}
            </button>
          </div>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs text-zinc-500">
                <th className="px-3 py-2.5 font-medium">URL</th>
                <th className="px-3 py-2.5 font-medium">HTTP</th>
                <th className="px-3 py-2.5 font-medium">Google</th>
                <th className="px-3 py-2.5 font-medium">Bing Search</th>
                <th className="px-3 py-2.5 font-medium">Gemini</th>
                <th className="px-3 py-2.5 font-medium">OpenAI</th>
                <th className="px-3 py-2.5 font-medium">Last seen</th>
                <th className="px-3 py-2.5 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const d = r.data
                return (
                  <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
                    <td className="px-3 py-2.5 max-w-[220px]">
                      <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 truncate block" title={r.url}>
                        {r.url.replace(/^https?:\/\//, '')}
                      </span>
                    </td>
                    {r.status === 'pending' && <td colSpan={7} className="px-3 py-2.5 text-xs text-zinc-400">Queued…</td>}
                    {r.status === 'checking' && <td colSpan={7} className="px-3 py-2.5 text-xs text-zinc-400">Checking…</td>}
                    {r.status === 'error' && <td colSpan={7} className="px-3 py-2.5 text-xs text-red-500">{r.error}</td>}
                    {r.status === 'done' && d && (
                      <>
                        <td className="px-3 py-2.5">
                          <BulkBadge {...(d.urlHealth.accessible
                            ? { tone: 'good', label: `${d.urlHealth.statusCode}` }
                            : { tone: 'bad', label: 'down' })} />
                        </td>
                        <td className="px-3 py-2.5"><BulkBadge {...googleCell(d)} /></td>
                        <td className="px-3 py-2.5"><BulkBadge {...bingCell(d)} /></td>
                        <td className="px-3 py-2.5"><BulkBadge {...llmCell(d, 'Google')} /></td>
                        <td className="px-3 py-2.5"><BulkBadge {...llmCell(d, 'OpenAI')} /></td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-400">
                          {lastSeen(d) ?? <span className="text-zinc-400">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <a
                            href={`/?url=${encodeURIComponent(r.url)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                          >
                            Details ↗
                          </a>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.some(r => r.data) && (
        <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
          <strong>Google</strong>: when a Serper API key is configured, <code>indexed</code> / <code>not indexed</code> is a factual live <code>site:</code> check against Google&apos;s actual results (<code>path indexed</code> = the exact URL isn&apos;t found but pages under it are). Without a key it falls back to <code>No blockers</code> — nothing stops indexing, but not proof it&apos;s indexed. <strong>Bing Search</strong>: <code>No blockers</code> only (no public Bing index API); use the <em>Details</em> link for a <code>site:</code> lookup. <strong>Gemini</strong> / <strong>OpenAI</strong> estimate training-data inclusion from Common Crawl vs. each model&apos;s cutoff. <strong>Last seen</strong> is the most recent Common Crawl / Wayback sighting.
        </p>
      )}
    </>
  )
}

export default function URLCheckerClient() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          URL Index Checker
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xl mx-auto">
          Check if a URL has been indexed by Google, Bing, Common Crawl (LLM training data), and the Wayback Machine.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <button
            onClick={() => setMode('single')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === 'single'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Single URL
          </button>
          <button
            onClick={() => setMode('bulk')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              mode === 'bulk'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Bulk URLs
          </button>
        </div>
      </div>

      {mode === 'single' ? <SingleChecker /> : <BulkChecker />}
    </div>
  )
}
