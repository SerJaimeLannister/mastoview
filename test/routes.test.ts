import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/routes'
import { boostedStatus, fixtureAccount, maliciousStatus, richStatus } from './fixtures'

const requestedUrls: string[] = []

let apiOverrides: Record<string, () => Response> = {}

const apiJson = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
    ...init,
  })

const stubFetch = async (input: string): Promise<Response> => {
  requestedUrls.push(input)
  const url = new URL(input)
  if (apiOverrides[url.pathname]) return apiOverrides[url.pathname]()
  switch (url.pathname) {
    case '/api/v1/timelines/public':
      return apiJson([maliciousStatus, richStatus], {
        headers: { link: '<https://mastodon.social/api/v1/timelines/public?max_id=99>; rel="next"' },
      })
    case '/api/v1/timelines/tag/rust':
      return apiJson([richStatus])
    case '/api/v1/accounts/lookup':
      if (url.searchParams.get('acct') === 'alice') return apiJson(fixtureAccount)
      return apiJson({ error: 'Record not found' }, { status: 404 })
    case '/api/v1/accounts/1/statuses':
      return apiJson([boostedStatus, richStatus], {
        headers: { link: '<https://mastodon.social/api/v1/accounts/1/statuses?max_id=77>; rel="next"' },
      })
    case '/api/v1/statuses/110000000000000001':
      return apiJson(maliciousStatus)
    case '/api/v1/statuses/110000000000000001/context':
      return apiJson({ ancestors: [richStatus], descendants: [boostedStatus] })
    case '/api/v2/instance':
      return apiJson({
        domain: 'mastodon.social',
        title: 'Mastodon',
        version: '4.2.0',
        description: 'The original instance',
        usage: { users: { active_month: 1000 } },
        thumbnail: { url: 'https://files.mastodon.social/site.png' },
      })
    case '/api/v2/search':
      if (url.searchParams.get('type') === 'statuses') return apiJson({ statuses: [richStatus] })
      if (url.searchParams.get('type') === 'accounts') return apiJson({ accounts: [fixtureAccount] })
      return apiJson({ hashtags: [{ name: 'rust' }] })
    default:
      return apiJson({ error: 'not found' }, { status: 404 })
  }
}

const app = createApp(stubFetch)

const NO_SCRIPT = /<script|<\s*script/i
const INLINE_HANDLER = /\son[a-z]+\s*=\s*["']/i
const JS_URL = /javascript:/i

async function getHtml(path: string): Promise<{ res: Response; body: string }> {
  const res = await app.request(path)
  const body = res.status === 204 || !res.headers.get('content-type')?.includes('text/html') ? '' : await res.text()
  return { res, body }
}

function expectSafeHtml(res: Response, body: string): void {
  expect(res.headers.get('content-security-policy')).toContain("script-src 'none'")
  expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  expect(res.headers.get('referrer-policy')).toBe('no-referrer')
  expect(body).not.toMatch(NO_SCRIPT)
  expect(body).not.toMatch(INLINE_HANDLER)
  expect(body).not.toMatch(JS_URL)
}

beforeEach(() => {
  requestedUrls.length = 0
  apiOverrides = {}
})

describe('static and utility routes', () => {
  it('serves the landing page with an instance form', async () => {
    const { res, body } = await getHtml('/')
    expect(res.status).toBe(200)
    expect(body).toContain('action="/go"')
    expect(body).toContain('mastodon.social')
    expectSafeHtml(res, body)
  })

  it('serves the stylesheet', async () => {
    const res = await app.request('/style.css')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/css')
    expect(res.headers.get('cache-control')).toContain('max-age=86400')
  })

  it('serves healthz', async () => {
    const res = await app.request('/healthz')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok\n')
  })
})

describe('instance routing and validation', () => {
  it('redirects /go to the instance page', async () => {
    const res = await app.request('/go?domain=Mastodon.Social')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/instance/mastodon.social')
  })

  it('rejects invalid domains with a 400 page', async () => {
    const { res, body } = await getHtml('/go?domain=not_a_domain')
    expect(res.status).toBe(400)
    expect(body).toContain('Invalid instance domain')
    const { res: r2, body: b2 } = await getHtml('/127.0.0.1/public')
    expect(r2.status).toBe(400)
    expect(b2).toContain('Invalid instance domain')
  })

  it('renders the instance landing page', async () => {
    const { res, body } = await getHtml('/instance/mastodon.social')
    expect(res.status).toBe(200)
    expect(body).toContain('Mastodon')
    expect(body).toContain('Public timeline')
    expect(body).toContain('1,000')
    expect(res.headers.get('cache-control')).toContain('s-maxage=600')
    expectSafeHtml(res, body)
  })

  it('redirects /:domain to the instance page and /federated to /public', async () => {
    const r1 = await app.request('/mastodon.social')
    expect(r1.status).toBe(302)
    expect(r1.headers.get('location')).toBe('/instance/mastodon.social')
    const r2 = await app.request('/mastodon.social/federated')
    expect(r2.status).toBe(301)
    expect(r2.headers.get('location')).toBe('/mastodon.social/public')
  })
})

describe('timelines', () => {
  it('renders the public timeline with sanitized statuses and pagination', async () => {
    const { res, body } = await getHtml('/mastodon.social/public')
    expect(res.status).toBe(200)
    expect(body).toContain('<article class="status"')
    expect(body).toContain('href="/mastodon.social/@gargron"')
    expect(body).not.toContain('<script')
    expect(body).toContain('href="/mastodon.social/public?max_id=99"')
    expect(res.headers.get('cache-control')).toContain('s-maxage=120')
    expectSafeHtml(res, body)
  })

  it('requests local=true for the local timeline', async () => {
    const { res } = await getHtml('/mastodon.social/local')
    expect(res.status).toBe(200)
    expect(requestedUrls.some((u) => u.includes('local=true'))).toBe(true)
  })

  it('passes max_id through to the API', async () => {
    const { res } = await getHtml('/mastodon.social/public?max_id=55')
    expect(res.status).toBe(200)
    expect(requestedUrls.some((u) => u.includes('max_id=55'))).toBe(true)
  })

  it('rejects malformed max_id', async () => {
    const { res, body } = await getHtml('/mastodon.social/public?max_id=evil')
    expect(res.status).toBe(400)
    expect(body).toContain('Invalid pagination parameter')
  })

  it('renders hashtag timelines', async () => {
    const { res, body } = await getHtml('/mastodon.social/tags/rust')
    expect(res.status).toBe(200)
    expect(body).toContain('<h1>#rust</h1>')
    expectSafeHtml(res, body)
  })

  it('rejects invalid hashtags', async () => {
    const { res } = await getHtml('/mastodon.social/tags/a%2Fb')
    expect(res.status).toBe(400)
  })
})

describe('profiles and threads', () => {
  it('renders a profile with header, tabs, posts and pagination', async () => {
    const { res, body } = await getHtml('/mastodon.social/@alice')
    expect(res.status).toBe(200)
    expect(body).toContain('@alice')
    expect(body).toContain('<dt>Posts</dt><dd>56</dd>')
    expect(body).toContain('Boosted by')
    expect(body).toContain('aria-current="page">Posts</a>')
    expect(body).toContain('max_id=77')
    expectSafeHtml(res, body)
  })

  it('passes the tab through to the API', async () => {
    const { res } = await getHtml('/mastodon.social/@alice?tab=media')
    expect(res.status).toBe(200)
    expect(requestedUrls.some((u) => u.includes('only_media=true'))).toBe(true)
    expect(requestedUrls.some((u) => u.includes('exclude_replies'))).toBe(false)
  })

  it('shows a friendly 404 for unknown accounts', async () => {
    const { res, body } = await getHtml('/mastodon.social/@ghost')
    expect(res.status).toBe(404)
    expect(body).toContain('Account not found')
  })

  it('renders a thread: ancestors, highlighted post, descendants', async () => {
    const { res, body } = await getHtml('/mastodon.social/@alice/110000000000000001')
    expect(res.status).toBe(200)
    const highlighted = body.indexOf('status-highlight')
    const ancestor = body.indexOf('id="status-110000000000000002"')
    const descendant = body.indexOf('Boosted by')
    expect(ancestor).toBeGreaterThan(-1)
    expect(highlighted).toBeGreaterThan(ancestor)
    expect(descendant).toBeGreaterThan(highlighted)
    expect(body).toContain('Thread')
    expectSafeHtml(res, body)
  })

  it('still renders a status when context fails', async () => {
    apiOverrides['/api/v1/statuses/110000000000000001/context'] = () => apiJson({}, { status: 500 })
    const { res, body } = await getHtml('/mastodon.social/@alice/110000000000000001')
    expect(res.status).toBe(200)
    expect(body).toContain('Replies could not be loaded')
  })

  it('shows a friendly 404 for deleted statuses', async () => {
    const { res, body } = await getHtml('/mastodon.social/@alice/999999')
    expect(res.status).toBe(404)
    expect(body).toContain('Post not found')
  })

  it('rejects malformed status ids', async () => {
    const { res } = await getHtml('/mastodon.social/@alice/a.b')
    expect(res.status).toBe(400)
  })
})

describe('search', () => {
  it('renders an empty search form without q', async () => {
    const { res, body } = await getHtml('/mastodon.social/search')
    expect(res.status).toBe(200)
    expect(body).toContain('action="/mastodon.social/search"')
    expect(requestedUrls).toHaveLength(0)
  })

  it('renders statuses, accounts and hashtags for a query', async () => {
    const { res, body } = await getHtml('/mastodon.social/search?q=rust+lang')
    expect(res.status).toBe(200)
    expect(body).toContain('Posts (1)')
    expect(body).toContain('Accounts (1)')
    expect(body).toContain('Hashtags (1)')
    expect(body).toContain('href="/mastodon.social/tags/rust"')
    expect(requestedUrls.filter((u) => u.includes('/api/v2/search')).length).toBe(3)
    expectSafeHtml(res, body)
  })

  it('renders an empty state when nothing matches', async () => {
    apiOverrides['/api/v2/search'] = () => apiJson({ statuses: [], accounts: [], hashtags: [] })
    const { res, body } = await getHtml('/mastodon.social/search?q=zzz')
    expect(res.status).toBe(200)
    expect(body).toContain('No results')
  })
})

describe('API failure mapping to error pages', () => {
  it('renders a 429 page when rate limited', async () => {
    apiOverrides['/api/v1/timelines/public'] = () => apiJson({}, { status: 429 })
    const { res, body } = await getHtml('/mastodon.social/public')
    expect(res.status).toBe(429)
    expect(body).toContain('Rate limited')
    expect(body).toContain('Back to mastodon.social')
  })

  it('renders a 502 page for unreachable instances', async () => {
    const unreachable = createApp(async () => {
      throw new TypeError('fetch failed')
    })
    const res = await unreachable.request('/dead.instance.example/public')
    expect(res.status).toBe(502)
    expect(await res.text()).toContain('Instance unreachable')
  })

  it('renders a 502 page for non-JSON responses', async () => {
    apiOverrides['/api/v1/timelines/public'] = () =>
      new Response('<html>gateway</html>', { headers: { 'content-type': 'text/html' } })
    const { res, body } = await getHtml('/mastodon.social/public')
    expect(res.status).toBe(502)
    expect(body).toContain('Unsupported response')
  })

  it('renders 404 for unknown routes', async () => {
    const { res, body } = await getHtml('/definitely/not/a/route')
    expect(res.status).toBe(404)
    expect(body).toContain('Page not found')
    expect(body).not.toMatch(/at \w+ \(/)
  })
})
