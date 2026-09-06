import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { CACHE_CONTROL } from './config'
import { STYLES } from './styles'
import { ApiError, MastodonClient, parseStatus, type FetchLike, type Page, type Status } from './mastodon'
import {
  accountCardList,
  accountHeaderView,
  errorView,
  hashtagList,
  instanceView,
  layout,
  paginationView,
  profileTabs,
  searchForm,
  statusView,
  timelineList,
} from './components'
import { plainText, truncate } from './html'
import { escapeHtml } from './sanitize'
import {
  validMaxId,
  validSearchQuery,
  validStatusId,
  validTag,
  validUsername,
  validateDomain,
} from './validate'

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
    readonly hint?: string,
    readonly domain?: string,
  ) {
    super(title)
  }
}

function toAppError(e: unknown, domain?: string): AppError {
  if (e instanceof AppError) return e
  if (e instanceof ApiError) {
    switch (e.kind) {
      case 'not-found':
        return new AppError(404, 'Not found', 'The instance reports that this resource does not exist.', 'It may have been deleted, or the address is wrong.', domain)
      case 'gone':
        return new AppError(410, 'Gone', 'The instance reports that this resource has been removed.', undefined, domain)
      case 'rate-limited':
        return new AppError(429, 'Rate limited', `The instance ${domain ? `${domain} ` : ''}is currently rate-limiting mastoview's requests.`, 'Public APIs apply rate limits. Wait a minute and try again.', domain)
      case 'timeout':
        return new AppError(504, 'Instance timed out', `The instance ${domain ? `${domain} ` : ''}took too long to answer.`, 'The instance may be under load. Try again shortly.', domain)
      case 'unreachable':
        return new AppError(502, 'Instance unreachable', `Could not connect to ${domain ?? 'the instance'}.`, 'Check the domain spelling. The instance may be down, blocking datacenter IPs, or not a Mastodon server.', domain)
      case 'forbidden':
        return new AppError(403, 'Request refused', `The instance ${domain ? `${domain} ` : ''}does not allow anonymous access to this feature.`, 'Some instances (including mastodon.social) require login for public timelines or search. Try another instance or browse hashtags instead.', domain)
      case 'too-large':
      case 'bad-response':
        return new AppError(502, 'Unsupported response', `The instance ${domain ? `${domain} ` : ''}returned a response mastoview could not safely use.`, 'This can happen with non-standard Mastodon-compatible servers.', domain)
      default:
        return new AppError(502, 'Instance error', `The instance ${domain ? `${domain} ` : ''}reported an error while answering.`, 'Try again shortly.', domain)
    }
  }
  console.error('[mastoview] unexpected error:', e)
  return new AppError(500, 'Something went wrong', 'An unexpected error occurred while rendering this page.')
}

function requireDomain(c: Context): string {
  const d = validateDomain(c.req.param('domain'))
  if (!d) {
    throw new AppError(400, 'Invalid instance domain', `"${truncate(c.req.param('domain') ?? '', 100)}" is not a valid instance domain.`, 'Domains look like mastodon.social or fosstodon.org.')
  }
  return d
}

function respond(body: string, status: number = 200, cacheControl: string = CACHE_CONTROL.none): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cacheControl },
  })
}

async function edgeCache(c: Context, next: Next): Promise<Response | void> {
  if (c.req.method !== 'GET' || typeof caches === 'undefined') return next()
  const key = new Request(c.req.url, { method: 'GET' })
  const hit = await caches.default.match(key)
  if (hit) {
    const res = new Response(hit.body, hit)
    res.headers.set('x-mastoview-cache', 'hit')
    return res
  }
  await next()
  const res = c.res
  if (res.status === 200 && !(res.headers.get('cache-control') ?? '').includes('no-store')) {
    try {
      c.executionCtx.waitUntil(caches.default.put(key, res.clone()))
    } catch {
      // no execution context available (e.g. tests)
    }
  }
  return c.res
}

function securityHeaders(c: Context, next: Next): Promise<void | Response> {
  return next().then(() => {
    c.res.headers.set('Content-Security-Policy', "default-src 'none'; style-src 'self'; img-src https:; media-src https:; script-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
    c.res.headers.set('X-Content-Type-Options', 'nosniff')
    c.res.headers.set('Referrer-Policy', 'no-referrer')
    c.res.headers.set('X-Frame-Options', 'DENY')
  })
}

const EXAMPLE_INSTANCES = ['mastodon.social', 'mastodon.online', 'fosstodon.org', 'hachyderm.io']

const HOME_BODY = `<h1>Read Mastodon without JavaScript</h1>
<p>mastoview is a read-only viewer for <a rel="nofollow noopener noreferrer" href="https://joinmastodon.org">Mastodon</a> instances. Every page is plain, server-rendered HTML: no scripts, no websockets, no client-side frameworks. It works with JavaScript, CSS, and images disabled.</p>
<form class="search-form" action="/go" method="get">
<label for="domain">Instance domain</label>
<input id="domain" type="text" name="domain" placeholder="mastodon.social" maxlength="253" autocomplete="off" required>
<button type="submit">Browse</button>
</form>
<h2>Try an instance</h2>
<ul class="tag-list">
${EXAMPLE_INSTANCES.map((d) => `<li><a href="/instance/${d}">${d}</a></li>`).join('\n')}
</ul>
<h2>What you can do</h2>
<ul>
<li>Browse the public, local and hashtag timelines of any instance.</li>
<li>Read profiles, posts, and full conversation threads.</li>
<li>Search posts, accounts, and hashtags.</li>
<li>Everything over plain links — bookmarkable, refreshable, script-free.</li>
</ul>`

const ABOUT_BODY = `<h1>About mastoview</h1>
<p>mastoview is a read-only web interface for Mastodon instances that renders entirely on the server. The HTML it returns is the whole interface: there is no JavaScript to download or run, no hydration, no websockets, and no browser-side API calls. It works in text browsers, with images off, and with CSS disabled.</p>
<h2>How it works</h2>
<p>When you open <code>/instance.example/public</code>, mastoview asks <code>instance.example</code> for its public timeline over the Mastodon REST API, sanitizes the response, and renders complete HTML documents. Only public, unauthenticated API endpoints are used. Content from instances is treated as untrusted: status HTML is re-written through a strict allowlist sanitizer before it is embedded.</p>
<h2>Routes</h2>
<ul>
<li><code>/</code> — this front page</li>
<li><code>/instance/:domain</code> — instance overview</li>
<li><code>/:domain/public</code> — public (federated) timeline</li>
<li><code>/:domain/local</code> — local timeline</li>
<li><code>/:domain/federated</code> — alias of the public timeline</li>
<li><code>/:domain/tags/:tag</code> — hashtag timeline</li>
<li><code>/:domain/@user</code> — profile</li>
<li><code>/:domain/@user/:id</code> — post with its thread</li>
<li><code>/:domain/search?q=…</code> — search</li>
</ul>
<h2>Privacy</h2>
<p>mastoview keeps no state: no database, no cookies, no accounts. Timeline pages may be cached at the edge for a short time to be gentle on instances. Media (avatars and images) is loaded directly from the instance that hosts it.</p>`

export function createApp(fetchFn: FetchLike = (input, init) => fetch(input, init)): Hono {
  const app = new Hono()

  app.use('*', edgeCache)
  app.use('*', securityHeaders)

  app.get('/', (c) => respond(layout({ title: 'mastoview — read Mastodon without JavaScript', body: HOME_BODY }), 200, CACHE_CONTROL.home))

  app.get('/about', (c) => respond(layout({ title: 'About — mastoview', body: ABOUT_BODY }), 200, CACHE_CONTROL.home))

  app.get('/healthz', (c) => {
    c.header('Cache-Control', CACHE_CONTROL.none)
    return c.text('ok\n')
  })

  app.get('/style.css', (c) => {
    c.header('Cache-Control', CACHE_CONTROL.css)
    return c.body(STYLES, 200, { 'Content-Type': 'text/css; charset=utf-8' })
  })

  app.get('/favicon.ico', (c) => c.body(null, 204))

  app.get('/go', (c) => {
    const d = validateDomain(c.req.query('domain'))
    if (!d) {
      throw new AppError(400, 'Invalid instance domain', 'That does not look like a valid instance domain.', 'Domains look like mastodon.social or fosstodon.org.')
    }
    c.header('Cache-Control', CACHE_CONTROL.none)
    return c.redirect(`/instance/${d}`, 302)
  })

  app.get('/instance/:domain', async (c) => {
    const domain = requireDomain(c)
    const api = new MastodonClient(domain, fetchFn)
    let info
    try {
      info = await api.instanceInfo()
    } catch (e) {
      throw toAppError(e, domain)
    }
    return respond(layout({ title: `${info.title} (${domain}) — mastoview`, domain, active: 'about', body: instanceView(info, domain) }), 200, CACHE_CONTROL.instance)
  })

  const timeline = (kind: 'public' | 'local') => async (c: Context): Promise<Response> => {
    const domain = requireDomain(c)
    const maxId = validMaxId(c.req.query('max_id'))
    if (c.req.query('max_id') !== undefined && maxId === null) {
      throw new AppError(400, 'Invalid pagination parameter', 'The max_id parameter must be a numeric post id.')
    }
    const api = new MastodonClient(domain, fetchFn)
    let page: Page<Status>
    try {
      page = await api.timeline(kind, { maxId })
    } catch (e) {
      throw toAppError(e, domain)
    }
    const body = `<h1>${kind === 'local' ? 'Local timeline' : 'Public timeline'}</h1>
<p class="page-desc">${kind === 'local' ? `Public posts from accounts on ${domain} only.` : `All public posts known to ${domain}, including posts federated from other instances.`}</p>
${timelineList(page.items, domain)}
${paginationView(c.req.path, page.nextMaxId)}`
    return respond(layout({ title: `${domain} — ${kind === 'local' ? 'local' : 'public'} timeline — mastoview`, domain, active: kind, body }), 200, CACHE_CONTROL.timeline)
  }

  app.get('/:domain/public', timeline('public'))
  app.get('/:domain/local', timeline('local'))
  app.get('/:domain/federated', (c) => {
    const d = requireDomain(c)
    c.header('Cache-Control', CACHE_CONTROL.none)
    return c.redirect(`/${d}/public`, 301)
  })

  app.get('/:domain', (c) => {
    const d = requireDomain(c)
    c.header('Cache-Control', CACHE_CONTROL.none)
    return c.redirect(`/instance/${d}`, 302)
  })

  app.get('/:domain/tags/:tag', async (c) => {
    const domain = requireDomain(c)
    const tag = c.req.param('tag')
    if (!validTag(tag)) {
      throw new AppError(400, 'Invalid hashtag', 'Hashtags consist of letters, digits, and underscores.', undefined, domain)
    }
    const maxId = validMaxId(c.req.query('max_id'))
    if (c.req.query('max_id') !== undefined && maxId === null) {
      throw new AppError(400, 'Invalid pagination parameter', 'The max_id parameter must be a numeric post id.', undefined, domain)
    }
    const api = new MastodonClient(domain, fetchFn)
    let page: Page<Status>
    try {
      page = await api.timeline('tag', { tag, maxId })
    } catch (e) {
      throw toAppError(e, domain)
    }
    const body = `<h1>#${escapeHtml(tag)}</h1>
<p class="page-desc">Public posts tagged #${escapeHtml(tag)} known to ${escapeHtml(domain)}.</p>
${timelineList(page.items, domain)}
${paginationView(c.req.path, page.nextMaxId)}`
    return respond(layout({ title: `#${tag} — ${domain} — mastoview`, domain, body }), 200, CACHE_CONTROL.timeline)
  })

  app.get('/:domain/search', async (c) => {
    const domain = requireDomain(c)
    const q = validSearchQuery(c.req.query('q'))
    if (!q) {
      const body = `<h1>Search</h1>
<p class="page-desc">Search public posts, accounts, and hashtags on ${escapeHtml(domain)}. Search terms are sent to the instance you are browsing.</p>
${searchForm(domain, c.req.query('q') ?? '')}`
      return respond(layout({ title: `Search — ${domain} — mastoview`, domain, active: 'search', body }), 200, CACHE_CONTROL.search)
    }
    const api = new MastodonClient(domain, fetchFn)
    let results
    try {
      results = await api.search(q)
    } catch (e) {
      throw toAppError(e, domain)
    }
    const empty =
      results.statuses.length === 0 && results.accounts.length === 0 && results.hashtags.length === 0
    const body = `<h1>Search</h1>
${searchForm(domain, q)}
${empty ? '<p class="empty">No results. Note that some instances limit public search.</p>' : ''}
${results.statuses.length ? `<h2>Posts (${results.statuses.length})</h2>${timelineList(results.statuses, domain)}` : ''}
${results.accounts.length ? `<h2>Accounts (${results.accounts.length})</h2>${accountCardList(results.accounts, domain)}` : ''}
${results.hashtags.length ? `<h2>Hashtags (${results.hashtags.length})</h2>${hashtagList(results.hashtags, domain)}` : ''}`
    return respond(layout({ title: `“${q}” — search on ${domain} — mastoview`, domain, active: 'search', body }), 200, CACHE_CONTROL.search)
  })

  app.get('/:domain/:handle', async (c) => {
    const domain = requireDomain(c)
    const rawHandle = c.req.param('handle')
    if (!rawHandle.startsWith('@')) {
      throw new AppError(404, 'Page not found', `There is no mastoview page for “/${domain}/${rawHandle}”.`, 'Try the public timeline or search instead.', domain)
    }
    const username = validUsername(rawHandle.slice(1))
    if (!username) {
      throw new AppError(400, 'Invalid username', 'Usernames consist of letters, digits, and underscores, optionally followed by @domain.', undefined, domain)
    }
    const qtab = c.req.query('tab')
    const tab = qtab === 'replies' || qtab === 'media' ? qtab : 'posts'
    const maxId = validMaxId(c.req.query('max_id'))
    if (c.req.query('max_id') !== undefined && maxId === null) {
      throw new AppError(400, 'Invalid pagination parameter', 'The max_id parameter must be a numeric post id.', undefined, domain)
    }
    const api = new MastodonClient(domain, fetchFn)
    let account
    try {
      account = await api.account(username)
    } catch (e) {
      if (e instanceof ApiError && e.kind === 'not-found') {
        throw new AppError(404, 'Account not found', `No account @${username} is known on ${domain}.`, 'Remote profiles must already be known to this instance. Try searching for the account on the instance.', domain)
      }
      throw toAppError(e, domain)
    }
    let page: Page<Status> = { items: [], nextMaxId: null }
    let warn = ''
    try {
      page = await api.accountStatuses(account.id, { maxId, tab })
    } catch (e) {
      warn = '<p class="warning">Posts could not be loaded from the instance right now.</p>'
    }
    const body = `${accountHeaderView(account, domain)}
${profileTabs(domain, account.acct, tab)}
${warn}
${timelineList(page.items, domain)}
${paginationView(`/${domain}/@${encodeURIComponent(account.acct)}?tab=${tab}`, page.nextMaxId)}`
    return respond(layout({ title: `@${account.acct} — ${domain} — mastoview`, domain, body }), 200, CACHE_CONTROL.profile)
  })

  app.get('/:domain/:handle/:statusId', async (c) => {
    const domain = requireDomain(c)
    const rawHandle = c.req.param('handle')
    if (!rawHandle.startsWith('@')) {
      throw new AppError(404, 'Page not found', `There is no mastoview page for this address.`, 'Try the public timeline or search instead.', domain)
    }
    const username = validUsername(rawHandle.slice(1))
    if (!username) {
      throw new AppError(400, 'Invalid username', 'Usernames consist of letters, digits, and underscores, optionally followed by @domain.', undefined, domain)
    }
    const statusId = c.req.param('statusId')
    if (!validStatusId(statusId)) {
      throw new AppError(400, 'Invalid post id', 'Post ids are alphanumeric.', undefined, domain)
    }
    const api = new MastodonClient(domain, fetchFn)
    const [statusRes, contextRes] = await Promise.allSettled([
      api.status(statusId),
      api.context(statusId),
    ])
    if (statusRes.status === 'rejected') {
      const e = statusRes.reason
      if (e instanceof ApiError && (e.kind === 'not-found' || e.kind === 'gone')) {
        throw new AppError(404, 'Post not found', `The post ${statusId} does not exist on ${domain} (or is not public).`, 'It may have been deleted, or it was never federated to this instance.', domain)
      }
      throw toAppError(e, domain)
    }
    const status = statusRes.value
    const ctx = contextRes.status === 'fulfilled' ? contextRes.value : { ancestors: [], descendants: [] }
    const ctxWarn = contextRes.status === 'rejected' ? '<p class="warning">Replies could not be loaded right now.</p>' : ''
    const ancestors = ctx.ancestors.map((s) => statusView(s, domain)).join('\n')
    const descendants = ctx.descendants.map((s) => statusView(s, domain)).join('\n')
    const preview = truncate(plainText((status.reblog ?? status).content), 80)
    const body = `<h1 class="thread-title">Thread</h1>
${ancestors ? `<section aria-label="Earlier in this thread">${ancestors}</section>` : ''}
${statusView(status, domain, { highlight: true })}
${ctxWarn}
${descendants ? `<section aria-label="Replies">${descendants}</section>` : ''}`
    return respond(layout({ title: preview ? `${preview} — ${domain} — mastoview` : `Post on ${domain} — mastoview`, domain, body }), 200, CACHE_CONTROL.status)
  })

  app.notFound((c) => {
    c.header('Cache-Control', CACHE_CONTROL.none)
    return respond(
      errorView({ status: 404, title: 'Page not found', detail: 'There is no mastoview page at this address.', hint: 'Check the URL, or start from an instance page such as /instance/mastodon.social.' }),
      404,
    )
  })

  app.onError((err, c) => {
    const e = toAppError(err)
    if (!(err instanceof AppError) && !(err instanceof ApiError)) {
      console.error('[mastoview] handler error:', err)
    }
    c.header('Cache-Control', CACHE_CONTROL.none)
    return respond(errorView(e), e.status)
  })

  return app
}
