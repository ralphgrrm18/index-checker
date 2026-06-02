import { NextRequest } from 'next/server'

const INDEX_NOW_ENGINES = [
  { name: 'Bing', url: 'https://www.bing.com/indexnow' },
  { name: 'Yandex', url: 'https://yandex.com/indexnow' },
]

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, key, keyLocation } = body as { url?: string; key?: string; keyLocation?: string }

  if (!url || !key) {
    return Response.json({ error: 'url and key are required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(key)) {
    return Response.json({ error: 'Invalid IndexNow key format' }, { status: 400 })
  }

  const params = new URLSearchParams({ url, key })
  if (keyLocation) params.set('keyLocation', keyLocation)

  const results = await Promise.allSettled(
    INDEX_NOW_ENGINES.map(async (engine) => {
      const res = await fetch(`${engine.url}?${params.toString()}`, {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'IndexChecker/1.0' },
      })
      const accepted = res.status === 200 || res.status === 202
      return { name: engine.name, status: res.status, accepted }
    })
  )

  const engineResults = results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { name: INDEX_NOW_ENGINES[i].name, status: 0, accepted: false }
  )

  const anyAccepted = engineResults.some(r => r.accepted)

  return Response.json({ url, submittedAt: new Date().toISOString(), anyAccepted, engines: engineResults })
}
