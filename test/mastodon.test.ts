import { describe, expect, it } from 'vitest'
import {
  MastodonClient,
  ApiError,
  parseAccount,
  parseInstance,
  parseStatus,
  parseStatuses,
  nextMaxId,
  type FetchLike,
} from '../src/mastodon'
import { maliciousStatus, richStatus, fixtureAccount } from './fixtures'

const json = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })

describe('parseAccount', () => {
  it('parses a well-formed account', () => {
    const a = parseAccount({ ...fixtureAccount })
    expect(a?.acct).toBe('alice')
    expect(a?.fields).toHaveLength(1)
  })
  it('rejects malformed accounts', () => {
    expect(parseAccount(null)).toBeNull()
    expect(parseAccount({})).toBeNull()
    expect(parseAccount({ id: '1' })).toBeNull()
    expect(parseAccount({ id: 42, username: 'x' })).toBeNull()
  })
  it('caps and coerces fields defensively', () => {
    const a = parseAccount({ id: '1', username: 'x', followers_count: 'lots', note: 123, fields: null })
    expect(a?.followers_count).toBe(0)
    expect(a?.note).toBe('')
    expect(a?.fields).toEqual([])
  })
})

describe('parseStatus / parseStatuses', () => {
  it('drops statuses without an account and dedupes ids', () => {
    const out = parseStatuses([
      { id: '1', account: { id: '9', username: 'u' } },
      { id: '1', account: { id: '9', username: 'u' } },
      { id: '2', account: null },
      'nonsense',
      null,
    ])
    expect(out).toHaveLength(1)
    expect(out[0]?.id).toBe('1')
  })

  it('keeps boosts but tolerates unparsable reblogs', () => {
    const boosted = parseStatus({ ...richStatus, reblog: maliciousStatus })
    expect(boosted?.reblog?.id).toBe(maliciousStatus.id)
    const broken = parseStatus({ ...richStatus, reblog: { id: 'x' } })
    expect(broken?.reblog).toBeNull()
  })

  it('tolerates non-string content and odd poll shapes', () => {
    const s = parseStatus({ id: '1', account: { id: '2', username: 'u' }, content: { deep: true }, poll: { options: [] } })
    expect(s?.content).toBe('')
    expect(s?.poll).toBeNull()
  })
})

describe('parseInstance', () => {
  it('parses v2 shape', () => {
    const info = parseInstance(
      { domain: 'x.example', title: 'X', version: '4.2.0', usage: { users: { active_month: 5 } }, thumbnail: { url: 'https://x.example/t.png' } },
      'x.example',
    )
    expect(info?.activeMonth).toBe(5)
    expect(info?.thumbnail).toBe('https://x.example/t.png')
    expect(info?.users).toBeNull()
  })
  it('parses v1 shape', () => {
    const info = parseInstance(
      { uri: 'x.example', title: 'X', short_description: 'hello', stats: { user_count: 10, status_count: 20, domain_count: 30 } },
      'x.example',
    )
    expect(info?.users).toBe(10)
    expect(info?.description).toBe('hello')
  })
  it('rejects junk', () => {
    expect(parseInstance({}, 'x.example')).toBeNull()
    expect(parseInstance('nope', 'x.example')).toBeNull()
  })
})

describe('nextMaxId', () => {
  it('extracts max_id from the next link', () => {
    const link = '<https://x.example/api/v1/timelines/public?max_id=109999>; rel="next", <https://x.example?min_id=1>; rel="prev"'
    expect(nextMaxId(link)).toBe('109999')
  })
  it('returns null for missing or malformed headers', () => {
    expect(nextMaxId(null)).toBeNull()
    expect(nextMaxId('<notaurl>; rel="next"')).toBeNull()
    expect(nextMaxId('<https://x.example>; rel="prev"')).toBeNull()
    expect(nextMaxId('<https://x.example?max_id=abc>; rel="next"')).toBeNull()
  })
})

function clientWith(handler: FetchLike, timeoutMs = 1000): MastodonClient {
  return new MastodonClient('mastodon.social', handler, timeoutMs)
}

describe('MastodonClient error mapping', () => {
  const withStatus = (status: number, body = '{}'): FetchLike => async () => json(body, { status })

  it.each([
    [404, 'not-found'],
    [429, 'rate-limited'],
    [410, 'gone'],
    [500, 'upstream'],
  ])('maps HTTP %d to a typed ApiError', async (status, kind) => {
    const c = clientWith(withStatus(status))
    await expect(c.status('1')).rejects.toMatchObject({ kind })
  })

  it('maps network failures to unreachable', async () => {
    const c = clientWith(async () => {
      throw new TypeError('fetch failed')
    })
    await expect(c.status('1')).rejects.toMatchObject({ kind: 'unreachable' })
  })

  it('maps timeouts', async () => {
    const c = clientWith(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
        }),
      15,
    )
    await expect(c.status('1')).rejects.toMatchObject({ kind: 'timeout' })
  })

  it('rejects non-JSON bodies', async () => {
    const c = clientWith(async () => new Response('<html>not json</html>', { headers: { 'content-type': 'text/html' } }))
    await expect(c.status('1')).rejects.toMatchObject({ kind: 'bad-response' })
  })

  it('rejects oversized responses early via content-length', async () => {
    const c = clientWith(async () =>
      json({}, { headers: { 'content-length': String(50_000_000) } }),
    )
    await expect(c.status('1')).rejects.toMatchObject({ kind: 'too-large' })
  })
})

describe('MastodonClient happy paths', () => {
  it('timeline parses items and Link header pagination', async () => {
    const seen: string[] = []
    const c = clientWith(async (url) => {
      seen.push(url)
      return json([maliciousStatus, richStatus], { headers: { link: '<https://mastodon.social/api/v1/timelines/public?max_id=99>; rel="next"' } })
    })
    const page = await c.timeline('local', { maxId: '5' })
    expect(page.items).toHaveLength(2)
    expect(page.nextMaxId).toBe('99')
    expect(seen[0]).toContain('local=true')
    expect(seen[0]).toContain('max_id=5')
    expect(seen[0]).toContain('limit=20')
    expect(seen[0]).toContain('https://mastodon.social/api/v1/timelines/public')
  })

  it('tag timeline hits the tag endpoint', async () => {
    const seen: string[] = []
    const c = clientWith(async (url) => {
      seen.push(url)
      return json([])
    })
    await c.timeline('tag', { tag: 'rust lang' })
    expect(seen[0]).toContain('/api/v1/timelines/tag/rust%20lang')
  })

  it('context parses ancestors and descendants', async () => {
    const c = clientWith(async () => json({ ancestors: [maliciousStatus], descendants: [richStatus] }))
    const ctx = await c.context('42')
    expect(ctx.ancestors).toHaveLength(1)
    expect(ctx.descendants).toHaveLength(1)
  })

  it('status 404 raises not-found', async () => {
    const c = clientWith(async () => json({}, { status: 404 }))
    await expect(c.status('42')).rejects.toBeInstanceOf(ApiError)
  })

  it('search merges three typed queries and parses hashtags', async () => {
    const urls: string[] = []
    const c = clientWith(async (url) => {
      urls.push(url)
      if (url.includes('type=statuses')) return json({ statuses: [richStatus] })
      if (url.includes('type=accounts')) return json({ accounts: [fixtureAccount] })
      return json({ hashtags: [{ name: 'rust' }, { name: '../bad' }, { name: 'ok_tag' }] })
    })
    const res = await c.search('rust')
    expect(res.statuses).toHaveLength(1)
    expect(res.accounts).toHaveLength(1)
    expect(res.hashtags).toEqual(['rust', 'ok_tag'])
    expect(urls.every((u) => u.includes('/api/v2/search'))).toBe(true)
  })

  it('search throws when the instance refuses all types', async () => {
    const c = clientWith(async () => json({}, { status: 401 }))
    await expect(c.search('rust')).rejects.toMatchObject({ kind: 'forbidden' })
  })
})
