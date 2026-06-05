// SERVER-ONLY. Fetches a user-supplied URL and extracts Open Graph metadata.
// Hardened against SSRF: only http(s), public IPs only (DNS resolved and every
// address checked), capped redirects / size / time. Never import from a client
// component — only from inside server function handlers.
import dnsPromises from 'node:dns/promises'
import net from 'node:net'

export interface ScrapedMetadata {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  favicon: string | null
}

const MAX_BYTES = 1_000_000 // 1 MB of HTML is plenty for <head>
const TIMEOUT_MS = 8000
const MAX_REDIRECTS = 5
const USER_AGENT = 'TroveBot/1.0 (+https://trove.app link preview)'

function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0
}

function inV4Range(ip: string, base: string, bits: number): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (ipToLong(ip) & mask) === (ipToLong(base) & mask)
}

function isPrivateV4(ip: string): boolean {
  return (
    inV4Range(ip, '0.0.0.0', 8) || // "this" network
    inV4Range(ip, '10.0.0.0', 8) || // private
    inV4Range(ip, '100.64.0.0', 10) || // CGNAT
    inV4Range(ip, '127.0.0.0', 8) || // loopback
    inV4Range(ip, '169.254.0.0', 16) || // link-local (incl. cloud metadata)
    inV4Range(ip, '172.16.0.0', 12) || // private
    inV4Range(ip, '192.0.0.0', 24) || // IETF protocol assignments
    inV4Range(ip, '192.168.0.0', 16) || // private
    inV4Range(ip, '198.18.0.0', 15) || // benchmarking
    inV4Range(ip, '224.0.0.0', 4) || // multicast
    inV4Range(ip, '240.0.0.0', 4) // reserved
  )
}

function isBlockedIp(ip: string): boolean {
  const type = net.isIP(ip)
  if (type === 4) return isPrivateV4(ip)
  if (type === 6) {
    const lower = ip.toLowerCase()
    if (lower === '::1' || lower === '::') return true
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateV4(mapped[1])
    const first = parseInt(lower.split(':')[0] || '0', 16)
    if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
    if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
    return false
  }
  return true // not a parseable IP -> block
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) throw new Error('That address is not allowed.')
    return
  }
  const records = await dnsPromises.lookup(hostname, { all: true })
  if (records.length === 0) throw new Error('Could not resolve that host.')
  for (const r of records) {
    if (isBlockedIp(r.address)) throw new Error('That address is not allowed.')
  }
}

function normalizeUrl(raw: string): URL {
  const trimmed = raw.trim()
  // Explicit scheme://… — only http(s) allowed (reject file:, ftp:, gopher:, …).
  const scheme = trimmed.match(/^([a-z][a-z0-9+.-]*):\/\//i)
  if (scheme) {
    const s = scheme[1].toLowerCase()
    if (s !== 'http' && s !== 'https') {
      throw new Error('Only http(s) links are supported.')
    }
    return new URL(trimmed)
  }
  // No scheme (e.g. "example.com" or "example.com:8080/path") -> assume https.
  return new URL(`https://${trimmed}`)
}

async function readCappedHtml(res: Response): Promise<string> {
  const ct = res.headers.get('content-type') || ''
  if (!/text\/html|application\/xhtml/i.test(ct)) return ''
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Array<Uint8Array> = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.length
    if (received > MAX_BYTES) {
      await reader.cancel()
      break
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/** Scrape a URL's Open Graph / HTML metadata, following redirects safely. */
export async function scrapeUrl(rawUrl: string): Promise<ScrapedMetadata> {
  let target = normalizeUrl(rawUrl)

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (target.protocol !== 'http:' && target.protocol !== 'https:') {
      throw new Error('Only http(s) links are supported.')
    }
    await assertPublicHost(target.hostname)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(target.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml',
        },
      })
    } catch {
      throw new Error('Could not reach that link.')
    } finally {
      clearTimeout(timer)
    }

    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      target = new URL(location, target) // re-validated at top of next loop
      continue
    }

    const html = await readCappedHtml(res)
    return extractMetadata(target.toString(), html)
  }
  throw new Error('Too many redirects.')
}

const MAX_IMAGE_BYTES = 5_000_000
const IMAGE_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

/** Fetch a remote image safely (same SSRF guards as the scraper), or null.
 *  Used to cache scraped/preview images into our own storage. */
export async function fetchImageBytes(
  rawUrl: string,
): Promise<{ bytes: Buffer; contentType: string; ext: string } | null> {
  let target: URL
  try {
    target = normalizeUrl(rawUrl)
  } catch {
    return null
  }
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (target.protocol !== 'http:' && target.protocol !== 'https:')
        return null
      await assertPublicHost(target.hostname)

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch(target.toString(), {
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'user-agent': USER_AGENT },
        })
      } finally {
        clearTimeout(timer)
      }

      const loc = res.headers.get('location')
      if (res.status >= 300 && res.status < 400 && loc) {
        target = new URL(loc, target)
        continue
      }

      const ct = (res.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase()
      const ext = IMAGE_EXT[ct]
      if (!ext) return null

      const reader = res.body?.getReader()
      if (!reader) return null
      const chunks: Array<Uint8Array> = []
      let total = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.length
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel()
          return null
        }
        chunks.push(value)
      }
      return { bytes: Buffer.concat(chunks), contentType: ct, ext }
    }
    return null
  } catch {
    return null
  }
}

// ---------- HTML metadata parsing ----------

function attr(tag: string, name: string): string | null {
  const m = tag.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'),
  )
  return m ? (m[2] ?? m[3] ?? m[4] ?? null) : null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .trim()
}

function resolveUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString()
  } catch {
    return null
  }
}

function extractMetadata(finalUrl: string, html: string): ScrapedMetadata {
  const metas = Array.from(html.matchAll(/<meta\s+[^>]*>/gi), (m) => m[0])
  const getMeta = (keys: Array<string>): string | null => {
    for (const tag of metas) {
      const key = (attr(tag, 'property') || attr(tag, 'name'))?.toLowerCase()
      if (key && keys.includes(key)) {
        const content = attr(tag, 'content')
        if (content) return decodeEntities(content)
      }
    }
    return null
  }

  const rawTitle = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const title =
    getMeta(['og:title', 'twitter:title']) ||
    (rawTitle ? decodeEntities(rawTitle) : null)
  const description = getMeta([
    'og:description',
    'twitter:description',
    'description',
  ])
  const siteName = getMeta(['og:site_name'])
  let image = getMeta([
    'og:image',
    'og:image:url',
    'og:image:secure_url',
    'twitter:image',
    'twitter:image:src',
  ])
  if (image) image = resolveUrl(image, finalUrl)

  let favicon: string | null = null
  for (const tag of Array.from(
    html.matchAll(/<link\s+[^>]*>/gi),
    (m) => m[0],
  )) {
    const rel = attr(tag, 'rel')?.toLowerCase()
    if (rel && /(^|\s)(shortcut )?icon(\s|$)|apple-touch-icon/.test(rel)) {
      const href = attr(tag, 'href')
      if (href) {
        favicon = resolveUrl(href, finalUrl)
        break
      }
    }
  }
  if (!favicon) favicon = resolveUrl('/favicon.ico', finalUrl)

  return { url: finalUrl, title, description, image, siteName, favicon }
}
