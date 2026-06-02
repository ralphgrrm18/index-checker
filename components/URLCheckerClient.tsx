'use client'

import { useState, useCallback } from 'react'

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
    canonicalUrl?: string
    error?: string
  }
  robotsTxt: {
    found: boolean
    blockedByGoogle: boolean
    blockedByBing: boolean
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

export default function URLCheckerClient() {
  const [inputUrl, setInputUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CheckData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async (urlToCheck?: string) => {
    const target = urlToCheck ?? inputUrl.trim()
    if (!target) return

    // Auto-add https:// if missing
    const normalized = target.startsWith('http') ? target : `https://${target}`

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const res = await fetch(`/api/check?url=${encodeURIComponent(normalized)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Check failed')
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }, [inputUrl])

  const encodedUrl = data?.url ? encodeURIComponent(data.url) : ''
  const rawUrl = data?.url ?? ''

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
          URL Index Checker
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xl mx-auto">
          Check if a URL has been indexed by Google, Bing, Common Crawl (LLM training data), and the Wayback Machine.
        </p>
      </div>

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
              <p className="text-xs text-zinc-500 mb-3">
                Google doesn't expose a free indexation API. Use the <code className="text-xs bg-zinc-100 dark:bg-zinc-800 px-1 rounded">site:</code> operator to check manually.
              </p>
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
    </div>
  )
}
