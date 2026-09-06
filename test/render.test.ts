import { describe, expect, it } from 'vitest'
import {
  accountHeaderView,
  errorView,
  layout,
  paginationView,
  statusView,
  timelineList,
} from '../src/components'
import { parseStatus } from '../src/mastodon'
import { boostedStatus, fixtureAccount, maliciousStatus, richStatus } from './fixtures'

const D = 'mastodon.social'
const malicious = parseStatus(maliciousStatus)!
const rich = parseStatus(richStatus)!
const boosted = parseStatus(boostedStatus)!

const NO_SCRIPT = /<script|<\s*script/i
const INLINE_HANDLER = /\son[a-z]+\s*=\s*["']/i
const JS_URL = /javascript:/i

describe('layout', () => {
  it('renders a semantic document without any script tags', () => {
    const html = layout({ title: 'Test & <safe>', body: '<p>hello</p>' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<main id="main">')
    expect(html).toContain('<header class="site-header">')
    expect(html).toContain('<footer class="site-footer">')
    expect(html).toContain('<a class="skip-link" href="#main">')
    expect(html).toContain('<title>Test &amp; &lt;safe&gt;</title>')
    expect(html).not.toMatch(NO_SCRIPT)
  })
})

describe('statusView', () => {
  it('renders the malicious fixture safely', () => {
    const html = statusView(malicious, D)
    expect(html).toContain('<article class="status"')
    expect(html).toMatch(/<time datetime="2026-01-02T03:04:05\.000Z">2026-01-02 03:04 UTC<\/time>/)
    expect(html).not.toMatch(NO_SCRIPT)
    expect(html).not.toMatch(INLINE_HANDLER)
    expect(html).not.toMatch(JS_URL)
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('onerror')
    expect(html).toContain('styled &amp; safe')
  })

  it('rewrites instance links to internal routes', () => {
    const html = statusView(malicious, D)
    expect(html).toContain('href="/mastodon.social/@gargron"')
    expect(html).toContain('href="/mastodon.social/tags/rust"')
    expect(html).toContain('rel="nofollow noopener noreferrer"')
  })

  it('renders content warnings as JS-free details', () => {
    const html = statusView(rich, D)
    expect(html).toContain('<details class="cw">')
    expect(html).toContain('<summary><strong>Content warning:</strong> mild peril')
  })

  it('renders polls with native progress elements', () => {
    const html = statusView(rich, D)
    expect(html).toContain('<progress max="100" value="75"></progress>')
    expect(html).toContain('<span class="poll-pct">75%</span>')
    expect(html).toContain('100 votes')
  })

  it('renders media with alt text and non-image media as links', () => {
    const html = statusView(rich, D)
    expect(html).toContain('alt="A cat wearing a tiny hat"')
    expect(html).toContain('loading="lazy"')
    expect(html).toMatch(/\[video\] <a href="https:\/\/files\.mastodon\.social\/media\/2\.mp4"/)
  })

  it('renders link preview cards without embedding raw card html', () => {
    const html = statusView(rich, D)
    expect(html).toContain('class="link-card"')
    expect(html).toContain('Rust is neat')
    expect(html).toContain('alt=""')
  })

  it('shows unlisted visibility as a badge', () => {
    expect(statusView(rich, D)).toContain('<span class="badge">unlisted</span>')
  })

  it('renders boosts with attribution and the original post', () => {
    const html = statusView(boosted, D)
    expect(html).toContain('Boosted by <a href="/mastodon.social/@alice">Alice')
    expect(html).toContain('id="status-110000000000000001"')
    expect(html).not.toContain('<script')
  })

  it('keeps counts readable without any styling', () => {
    const html = statusView(malicious, D)
    expect(html).toContain('3 replies')
    expect(html).toContain('5 boosts')
    expect(html).toContain('7 favourites')
  })
})

describe('accountHeaderView', () => {
  it('sanitizes the note and fields, keeps stats', () => {
    const html = accountHeaderView(fixtureAccount, D)
    expect(html).toContain('@alice')
    expect(html).toContain('href="/mastodon.social/tags/rust"')
    expect(html).toContain('<dt>Posts</dt><dd>56</dd>')
    expect(html).toContain('<dt>Followers</dt><dd>12</dd>')
    expect(html).not.toMatch(NO_SCRIPT)
    expect(html).not.toMatch(INLINE_HANDLER)
  })
})

describe('timelineList and paginationView', () => {
  it('lists statuses and shows an empty notice', () => {
    expect(timelineList([malicious], D)).toContain('<article')
    expect(timelineList([], D)).toContain('No posts to show')
  })
  it('renders older-posts links with max_id', () => {
    expect(paginationView(`/${D}/public`, '99')).toContain(`href="/${D}/public?max_id=99"`)
    expect(paginationView(`/${D}/@alice?tab=media`, '99')).toContain(`max_id=99`)
    expect(paginationView(`/${D}/public`, null)).toBe('')
  })
})

describe('errorView', () => {
  it('renders a friendly page without stack traces', () => {
    const html = errorView({ status: 504, title: 'Instance timed out', detail: 'x took too long', hint: 'try later', domain: D })
    expect(html).toContain('504 — Instance timed out')
    expect(html).toContain('Back to mastodon.social')
    expect(html).not.toMatch(/at \w+ \(/)
  })
})
