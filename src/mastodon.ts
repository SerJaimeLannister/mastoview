import { CFG } from './config'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export type ApiErrorKind =
  | 'timeout' | 'unreachable' | 'rate-limited' | 'not-found' | 'gone'
  | 'forbidden' | 'too-large' | 'bad-response' | 'upstream'

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status = 502,
  ) {
    super(message)
  }
}

export interface Emoji {
  shortcode: string
  url: string
}

export interface AccountField {
  name: string
  value: string
  verified_at: string | null
}

export interface Account {
  id: string
  username: string
  acct: string
  display_name: string
  note: string
  url: string
  avatar: string
  created_at: string
  locked: boolean
  bot: boolean
  followers_count: number
  following_count: number
  statuses_count: number
  fields: AccountField[]
  emojis: Emoji[]
}

export interface MediaAttachment {
  id: string
  type: string
  url: string
  preview_url: string | null
  remote_url: string | null
  description: string | null
}

export interface PollOption {
  title: string
  votes_count: number
}

export interface Poll {
  options: PollOption[]
  votes_count: number
  voters_count: number
  expired: boolean
  expires_at: string | null
  emojis: Emoji[]
}

export interface Card {
  url: string
  title: string
  description: string
  provider_name: string
  type: string
  image: string | null
}

export interface Status {
  id: string
  uri: string
  url: string
  created_at: string
  content: string
  spoiler_text: string
  visibility: string
  sensitive: boolean
  in_reply_to_id: string | null
  account: Account
  reblog: Status | null
  media_attachments: MediaAttachment[]
  poll: Poll | null
  card: Card | null
  replies_count: number
  reblogs_count: number
  favourites_count: number
}

export interface InstanceInfo {
  domain: string
  title: string
  description: string
  version: string
  thumbnail: string | null
  users: number | null
  statuses: number | null
  peers: number | null
  activeMonth: number | null
}

export interface Page<T> {
  items: T[]
  nextMaxId: string | null
}

export interface SearchResults {
  statuses: Status[]
  accounts: Account[]
  hashtags: string[]
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null
const int = (v: unknown): number => num(v) ?? 0

function parseEmojis(v: unknown): Emoji[] {
  if (!Array.isArray(v)) return []
  const out: Emoji[] = []
  for (const e of v.slice(0, 64)) {
    if (!isObj(e)) continue
    const shortcode = str(e.shortcode)
    const url = str(e.url)
    if (/^[a-zA-Z0-9_]{1,64}$/.test(shortcode) && url) out.push({ shortcode, url })
  }
  return out
}

export function parseAccount(v: unknown): Account | null {
  if (!isObj(v)) return null
  const id = str(v.id)
  const username = str(v.username)
  if (!id || !username) return null
  const fields: AccountField[] = []
  if (Array.isArray(v.fields)) {
    for (const f of v.fields.slice(0, 16)) {
      if (!isObj(f)) continue
      fields.push({
        name: str(f.name).slice(0, 128),
        value: str(f.value).slice(0, 1024),
        verified_at: str(f.verified_at) || null,
      })
    }
  }
  return {
    id,
    username,
    acct: str(v.acct) || username,
    display_name: str(v.display_name).slice(0, 128),
    note: str(v.note).slice(0, 8000),
    url: str(v.url),
    avatar: str(v.avatar),
    created_at: str(v.created_at),
    locked: v.locked === true,
    bot: v.bot === true,
    followers_count: int(v.followers_count),
    following_count: int(v.following_count),
    statuses_count: int(v.statuses_count),
    fields,
    emojis: parseEmojis(v.emojis),
  }
}

function parseAttachment(v: unknown): MediaAttachment | null {
  if (!isObj(v)) return null
  const id = str(v.id)
  const url = str(v.url)
  const remote = str(v.remote_url)
  if (!id || (!url && !remote)) return null
  return {
    id,
    type: str(v.type) || 'unknown',
    url,
    preview_url: str(v.preview_url) || null,
    remote_url: remote || null,
    description: str(v.description).slice(0, 1500) || null,
  }
}

function parsePoll(v: unknown): Poll | null {
  if (!isObj(v) || !Array.isArray(v.options)) return null
  const options: PollOption[] = []
  for (const o of v.options.slice(0, 12)) {
    if (!isObj(o)) continue
    options.push({ title: str(o.title).slice(0, 200), votes_count: int(o.votes_count) })
  }
  if (options.length === 0) return null
  return {
    options,
    votes_count: int(v.votes_count),
    voters_count: int(v.voters_count),
    expired: v.expired === true,
    expires_at: str(v.expires_at) || null,
    emojis: parseEmojis(v.emojis),
  }
}

function parseCard(v: unknown): Card | null {
  if (!isObj(v)) return null
  const url = str(v.url)
  const title = str(v.title)
  if (!url || !title) return null
  return {
    url,
    title: title.slice(0, 300),
    description: str(v.description).slice(0, 600),
    provider_name: str(v.provider_name).slice(0, 128),
    type: str(v.type) || 'link',
    image: str(v.image) || null,
  }
}

export function parseStatus(v: unknown, depth = 0): Status | null {
  if (!isObj(v)) return null
  const id = str(v.id)
  const account = parseAccount(v.account)
  if (!id || !account) return null
  const reblog = depth < 2 && v.reblog != null ? parseStatus(v.reblog, depth + 1) : null
  const media = Array.isArray(v.media_attachments)
    ? v.media_attachments.slice(0, 8).map(parseAttachment).filter((m): m is MediaAttachment => m !== null)
    : []
  return {
    id,
    uri: str(v.uri),
    url: str(v.url),
    created_at: str(v.created_at),
    content: str(v.content).slice(0, 20000),
    spoiler_text: str(v.spoiler_text).slice(0, 500),
    visibility: str(v.visibility) || 'public',
    sensitive: v.sensitive === true,
    in_reply_to_id: str(v.in_reply_to_id) || null,
    account,
    reblog,
    media_attachments: media,
    poll: parsePoll(v.poll),
    card: parseCard(v.card),
    replies_count: int(v.replies_count),
    reblogs_count: int(v.reblogs_count),
    favourites_count: int(v.favourites_count),
  }
}

export function parseStatuses(v: unknown): Status[] {
  if (!Array.isArray(v)) return []
  const out: Status[] = []
  const seen = new Set<string>()
  for (const item of v.slice(0, CFG.maxStatuses)) {
    const s = parseStatus(item)
    if (s && !seen.has(s.id)) {
      seen.add(s.id)
      out.push(s)
    }
  }
  return out
}

export function parseInstance(v: unknown, domain: string): InstanceInfo | null {
  if (!isObj(v)) return null
  const title = str(v.title).trim()
  if (!title) return null
  const thumb = isObj(v.thumbnail) ? str(v.thumbnail.url) : str(v.thumbnail)
  const stats = isObj(v.stats) ? v.stats : null
  const usageUsers = isObj(v.usage) && isObj(v.usage.users) ? v.usage.users : null
  return {
    domain: str(v.domain) || str(v.uri) || domain,
    title: title.slice(0, 200),
    description: (str(v.short_description) || str(v.description)).slice(0, 2000),
    version: str(v.version).slice(0, 100),
    thumbnail: thumb || null,
    users: stats ? num(stats.user_count) : null,
    statuses: stats ? num(stats.status_count) : null,
    peers: stats ? num(stats.domain_count) : null,
    activeMonth: usageUsers ? num(usageUsers.active_month) : null,
  }
}

export function nextMaxId(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  const m = /<([^>]+)>;\s*rel="next"/.exec(linkHeader)
  if (!m) return null
  try {
    const id = new URL(m[1]).searchParams.get('max_id')
    return id && /^\d{1,32}$/.test(id) ? id : null
  } catch {
    return null
  }
}

export class MastodonClient {
  constructor(
    readonly domain: string,
    private fetchFn: FetchLike,
  private timeoutMs: number = CFG.apiTimeoutMs,
  ) {}

  private async get(
    path: string,
    params: Record<string, string | undefined> = {},
  ): Promise<{ body: unknown; link: string | null }> {
    const url = new URL(`https://${this.domain}${path}`)
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v)
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let res: Response
    try {
      res = await this.fetchFn(url.toString(), {
        signal: controller.signal,
        redirect: 'manual',
        headers: { accept: 'application/json', 'user-agent': CFG.userAgent },
      })
    } catch (e) {
      console.error('[mastoview] fetch error:', e)
      if (controller.signal.aborted) {
        throw new ApiError('timeout', `Request to ${this.domain} timed out`, 504)
      }
      throw new ApiError('unreachable', `Could not connect to ${this.domain}`)
    } finally {
      clearTimeout(timer)
    }
    if (res.status >= 300 && res.status < 400) {
      throw new ApiError('bad-response', `${this.domain} tried to redirect an API request`)
    }
    if (res.status === 404) throw new ApiError('not-found', `${this.domain} has no such resource`, 404)
    if (res.status === 410) throw new ApiError('gone', `The resource on ${this.domain} is gone`, 410)
    if (res.status === 429) throw new ApiError('rate-limited', `${this.domain} is rate limiting requests`, 429)
    if (res.status === 401 || res.status === 403 || res.status === 422) {
      throw new ApiError('forbidden', `${this.domain} refused the request (${res.status})`)
    }
    if (!res.ok) throw new ApiError('upstream', `${this.domain} returned HTTP ${res.status}`)
    const len = Number(res.headers.get('content-length') ?? NaN)
    if (Number.isFinite(len) && len > CFG.maxResponseBytes) {
      throw new ApiError('too-large', `${this.domain} returned an oversized response`)
    }
    const text = await res.text()
    if (text.length > CFG.maxResponseBytes) {
      throw new ApiError('too-large', `${this.domain} returned an oversized response`)
    }
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new ApiError('bad-response', `${this.domain} returned a non-JSON response`)
    }
    return { body, link: res.headers.get('link') }
  }

  private async statusPage(
    path: string,
    params: Record<string, string | undefined>,
  ): Promise<Page<Status>> {
    const { body, link } = await this.get(path, params)
    const items = parseStatuses(body)
    const next = nextMaxId(link) ?? (items.length > 0 ? items[items.length - 1].id : null)
    return { items, nextMaxId: next }
  }

  async instanceInfo(): Promise<InstanceInfo> {
    try {
      const { body } = await this.get('/api/v2/instance')
      const parsed = parseInstance(body, this.domain)
      if (parsed) return parsed
    } catch (e) {
      if (!(e instanceof ApiError) || !['not-found', 'gone', 'bad-response'].includes(e.kind)) throw e
    }
    const { body } = await this.get('/api/v1/instance')
    const parsed = parseInstance(body, this.domain)
    if (!parsed) throw new ApiError('bad-response', `${this.domain} returned unsupported instance data`)
    return parsed
  }

  async timeline(
    kind: 'public' | 'local' | 'tag',
    opts: { tag?: string; maxId?: string | null } = {},
  ): Promise<Page<Status>> {
    const path =
      kind === 'tag' && opts.tag
        ? `/api/v1/timelines/tag/${encodeURIComponent(opts.tag)}`
        : '/api/v1/timelines/public'
    return this.statusPage(path, {
      limit: String(CFG.timelineLimit),
      local: kind === 'local' ? 'true' : undefined,
      max_id: opts.maxId ?? undefined,
    })
  }

  async account(acct: string): Promise<Account> {
    const { body } = await this.get('/api/v1/accounts/lookup', { acct })
    const a = parseAccount(body)
    if (!a) throw new ApiError('bad-response', `${this.domain} returned unsupported account data`)
    return a
  }

  async accountStatuses(
    id: string,
    opts: { maxId?: string | null; tab?: 'posts' | 'replies' | 'media' } = {},
  ): Promise<Page<Status>> {
    return this.statusPage(`/api/v1/accounts/${encodeURIComponent(id)}/statuses`, {
      limit: String(CFG.timelineLimit),
      max_id: opts.maxId ?? undefined,
      exclude_replies: opts.tab === 'posts' ? 'true' : undefined,
      only_media: opts.tab === 'media' ? 'true' : undefined,
    })
  }

  async status(id: string): Promise<Status> {
    const { body } = await this.get(`/api/v1/statuses/${encodeURIComponent(id)}`)
    const s = parseStatus(body)
    if (!s) throw new ApiError('not-found', 'Post not found', 404)
    return s
  }

  async context(id: string): Promise<{ ancestors: Status[]; descendants: Status[] }> {
    const { body } = await this.get(`/api/v1/statuses/${encodeURIComponent(id)}/context`)
    if (!isObj(body)) return { ancestors: [], descendants: [] }
    return { ancestors: parseStatuses(body.ancestors), descendants: parseStatuses(body.descendants) }
  }

  async search(q: string): Promise<SearchResults> {
    const [s, a, h] = await Promise.allSettled([
      this.get('/api/v2/search', { q, type: 'statuses', limit: '20' }),
      this.get('/api/v2/search', { q, type: 'accounts', limit: '10' }),
      this.get('/api/v2/search', { q, type: 'hashtags', limit: '10' }),
    ])
    if (s.status === 'rejected' && a.status === 'rejected' && h.status === 'rejected') {
      throw s.reason instanceof ApiError ? s.reason : new ApiError('upstream', 'Search failed')
    }
    const statuses = s.status === 'fulfilled' && isObj(s.value.body) ? parseStatuses(s.value.body.statuses) : []
    const accounts =
      a.status === 'fulfilled' && isObj(a.value.body) && Array.isArray(a.value.body.accounts)
        ? a.value.body.accounts.map(parseAccount).filter((x): x is Account => x !== null)
        : []
    const hashtags: string[] = []
    if (h.status === 'fulfilled' && isObj(h.value.body) && Array.isArray(h.value.body.hashtags)) {
      for (const t of h.value.body.hashtags.slice(0, 30)) {
        if (isObj(t) && /^[\p{L}\p{N}_]{1,64}$/u.test(str(t.name))) hashtags.push(str(t.name))
      }
    }
    return { statuses, accounts, hashtags }
  }
}
