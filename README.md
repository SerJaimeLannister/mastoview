# mastoview

A **read-only, JavaScript-free web client for Mastodon**, rendered entirely on the server.

Every page mastoview returns is a complete, ordinary HTML document. There is no JavaScript to download or execute: no SPA, no hydration, no websockets, no browser-side API calls. The site works with JavaScript **disabled**, with **CSS disabled**, and with **images disabled**. You can read it with `curl`, a text browser, or a screen reader.

```
curl https://your-domain.example/fosstodon.org/public
```

returns the actual timeline HTML — not a shell waiting for scripts.

## Why JavaScript-free?

- **It works everywhere**: text browsers, terminal browsers, old devices, strict security setups, screen readers.
- **It is fast**: one HTML request per page. No bundle, no waterfall, no client-side rendering.
- **It is private by design**: no client-side tracking surface, no cookies, no accounts, no state.
- **It is a statement**: social reading does not require an application runtime. The content is the interface.

## Architecture

mastoview runs as a single [Cloudflare Worker](https://workers.cloudflare.com/) written in TypeScript with [Hono](https://hono.dev/) for routing:

```
Browser ──GET /:domain/public──▶ Worker (Hono)
                                   │
                                   │ server-side fetch (public API only)
                                   ▼
                              https://:domain/api/v1/timelines/public
                                   │
                                   │ parse → validate → sanitize
                                   ▼
                              server-rendered HTML ◀── edge cache (Cache API)
```

- **`src/mastodon.ts`** — API client. Strict timeouts, response-size caps, redirect refusal, typed error mapping (`timeout`, `unreachable`, `rate-limited`, `not-found`, `forbidden`, `bad-response`, …). Defensive parsers reject malformed objects instead of crashing.
- **`src/sanitize.ts`** — a self-contained HTML sanitizer (no DOM dependency): allowlist tokenizer that re-serializes status HTML, validates every URL scheme, drops dangerous subtrees (`script`, `svg`, `iframe`, `math`, …), balances tags, and rewrites instance links to internal routes.
- **`src/components.ts`** / **`src/html.ts`** — server-side templates (layout, status, author, avatar, media, content warning, poll, link preview, timestamp, pagination, error page).
- **`src/routes.ts`** — all routes, error pages, edge-cache middleware, security headers.
- **`src/styles.ts`** — the single small stylesheet, served from `/style.css` (typography-first, monospace, ~5 KB).
- **`src/validate.ts`** — domain/username/tag/id/query validation (SSRF-aware domain checks).

There is **no database and no state**: the worker is a pure function of the URL.

## Supported routes

| Route | Page |
| --- | --- |
| `/` | Landing page with instance picker |
| `/about` | About this service |
| `/go?domain=…` | Redirect helper for the front-page form |
| `/instance/:domain` | Instance overview (title, description, stats, links) |
| `/:domain/public` | Public (federated) timeline |
| `/:domain/local` | Local timeline |
| `/:domain/federated` | Alias → 301 to `/:domain/public` |
| `/:domain/tags/:tag` | Hashtag timeline |
| `/:domain/@user` | Profile (tabs: posts, posts+replies, media) |
| `/:domain/@user/:id` | Single post with its conversation thread |
| `/:domain/search?q=…` | Search posts, accounts, hashtags |

Pagination is plain links (`?max_id=…`) derived from the Mastodon `Link` response header. The instance is always explicit in the URL — mastoview is a viewer *for* an instance, not a mixed feed.

## Mastodon API usage

mastoview only calls public, unauthenticated endpoints:

- `GET /api/v2/instance` (falls back to `/api/v1/instance`)
- `GET /api/v1/timelines/public` (with `local=true` for the local timeline)
- `GET /api/v1/timelines/tag/:tag`
- `GET /api/v1/accounts/lookup?acct=…`, `GET /api/v1/accounts/:id/statuses`
- `GET /api/v1/statuses/:id`, `GET /api/v1/statuses/:id/context`
- `GET /api/v2/search` (per type; merged client-side)

Instances differ. Some (including `mastodon.social`) require login for public timelines or search; mastoview maps refusals (`401/403/422`) to a readable "Request refused" page. Rate limits (`429`), outages, timeouts, deleted posts, and malformed responses each get their own error page. Nothing is hard-coded to a specific instance.

## Local development

Requires Node.js 18+:

```
npm install
npm run dev        # wrangler dev on http://localhost:8787
npm test           # vitest test suite
npm run typecheck  # tsc --noEmit
```

Then open <http://localhost:8787/> or:

```
curl -s http://localhost:8787/fosstodon.org/public | less
```

(`fosstodon.org`, `hachyderm.io`, and `mas.to` allow anonymous timeline access; `mastodon.social` does not.)

## Cloudflare deployment

```
npm run deploy     # wrangler deploy
```

Configuration lives in `wrangler.toml` (`name`, `main`, `compatibility_date`). No bindings, secrets, or databases are required. After deploying, set your production host in `/healthz`-style checks: `curl https://your-domain.example/healthz` → `ok`.

## Security considerations

- **Mastodon instances are untrusted input.** Status HTML is never injected raw: it passes through an allowlist sanitizer that decodes entities, re-escapes text, strips all attributes except validated `href`/`src`/`alt`/`title`, and forbids inline handlers, styles, and unknown schemes. `javascript:`, `data:`, and protocol-relative URLs are rejected; media sources must be absolute `https:`.
- **Not an open proxy.** The worker only fetches `https://<validated-domain>/api/v1|2/...` paths. Domains are validated (DNS-label syntax, no IPs, no userinfo/port/path tricks), redirects are refused, and no arbitrary user-supplied URL is ever fetched.
- **SSRF-aware**: private/loopback/all-numeric (IPv4) labels rejected; `localhost` impossible (a dot is mandatory).
- **Hardened responses**: `Content-Security-Policy: default-src 'none'; script-src 'none'; …`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`. The CSP itself forbids scripts even if a bug let one through.
- **Timeouts & size limits**: 8 s upstream timeout; 2 MB response cap (checked via `Content-Length` and body length).
- **No stack traces** in user-facing error pages; failures are logged server-side only.

## Caching strategy

All pages are public and stateless, so caching is safe by construction (no cookies, no auth):

- Successful (200) HTML pages are stored in Cloudflare's edge cache (`caches.default`) keyed by full URL, including pagination and search queries.
- Each route sets its own `Cache-Control` (timelines `s-maxage=120, stale-while-revalidate=600`; instance pages 10 min; posts 60 s; CSS 1 day). TTLs are grouped in `src/config.ts` (`CACHE_CONTROL`) for easy tuning.
- Error pages are never cached (`no-store`). Hits are flagged with `x-mastoview-cache: hit`.
- Since nothing user-specific exists, there is no risk of caching private data.

## Current limitations (MVP)

- Read-only: no posting, boosting, favouriting, following, auth, OAuth, or notifications.
- No media proxying — images load directly from instances (with `referrerpolicy=no-referrer`).
- No instance-side "trending" pages; search lacks pagination.
- Instances that disable anonymous timelines/search (e.g. `mastodon.social`) show a "Request refused" page — that is their policy, not a bug.
- Non-image media (video/audio) renders as links rather than embeds, to keep pages light.
- One status thread depth per page (no infinite conversation trees).

## Future possibilities

The backend is deliberately structured for additive enhancement: per-instance custom emoji, an RSS/Atom feed route, media proxying with size caps, "latest posts" link-rel navigation, authenticated reading via OAuth (carefully excluded from cache), light progressive enhancement (e.g. `<details>`-free CW toggles), per-user layout preferences via URL params, and trending/instance directories — all without ever making JavaScript a requirement.

## License

MIT
