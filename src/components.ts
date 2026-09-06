import {
  escapeHtml,
  makeHrefRewriter,
  safeMediaUrl,
  safeUrl,
  sanitizeHtml,
} from './sanitize'
import { plainText, renderEmojiText, timeTag, truncate } from './html'
import type { Account, Card, InstanceInfo, MediaAttachment, Poll, Status } from './mastodon'

export function layout(o: {
  title: string
  domain?: string
  active?: 'public' | 'local' | 'search' | 'about'
  body: string
}): string {
  const d = o.domain
  const link = (href: string, label: string, key?: string) => {
    const cur = key && key === o.active ? ' aria-current="page"' : ''
    return `<a href="${escapeHtml(href)}"${cur}>${escapeHtml(label)}</a>`
  }
  const nav = d
    ? link(`/instance/${d}`, 'About', 'about') +
      link(`/${d}/public`, 'Public', 'public') +
      link(`/${d}/local`, 'Local', 'local') +
      link(`/${d}/search`, 'Search', 'search')
    : link('/about', 'About')
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="mastoview — a JavaScript-free, read-only Mastodon reader${d ? ` for ${d}` : ''}">
<title>${escapeHtml(o.title)}</title>
<link rel="icon" href="data:,">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
<nav aria-label="Site navigation">
<a class="brand" href="/">mastoview</a>${d ? `<span class="crumb">/</span><a class="crumb-domain" href="/instance/${escapeHtml(d)}">${escapeHtml(d)}</a>` : ''}${nav}
</nav>
</header>
<main id="main">
${o.body}
</main>
<footer class="site-footer">
<p>mastoview — a read-only, JavaScript-free Mastodon reader. These pages are plain HTML; no scripts are served or executed. <a href="/about">About</a></p>
</footer>
</body>
</html>`
}

function avatarView(a: Account): string {
  const url = safeMediaUrl(a.avatar)
  if (url) {
    return `<img class="avatar" src="${escapeHtml(url)}" alt="" width="32" height="32" loading="lazy" referrerpolicy="no-referrer">`
  }
  const ch = (a.display_name || a.username || '?').trim().charAt(0).toUpperCase() || '?'
  return `<span class="avatar avatar-fallback" aria-hidden="true">${escapeHtml(ch)}</span>`
}

export function accountLinkInline(a: Account, domain: string): string {
  const name = plainText(a.display_name || a.username) || a.username
  return `<a href="/${domain}/@${escapeHtml(a.acct)}">${escapeHtml(truncate(name, 60))}</a>`
}

function authorBlock(a: Account, domain: string): string {
  const name = renderEmojiText(a.display_name || a.username, a.emojis) || escapeHtml(a.username)
  const badges = [
    a.bot ? '<span class="badge">bot</span>' : '',
    a.locked ? '<span class="badge">locked</span>' : '',
  ].filter(Boolean).join(' ')
  return `${avatarView(a)}<a class="author" href="/${domain}/@${escapeHtml(a.acct)}"><span class="name">${name}</span> <span class="acct">@${escapeHtml(a.acct)}</span></a>${badges ? ` ${badges}` : ''}`
}

function attachmentView(att: MediaAttachment): string {
  if (att.type === 'image') {
    const src = safeMediaUrl(att.preview_url || att.url)
    if (!src) return ''
    const full = safeMediaUrl(att.url) || src
    const alt = att.description ? escapeHtml(truncate(att.description, 1000)) : ''
    const cap = att.description ? `<figcaption>${escapeHtml(truncate(att.description, 300))}</figcaption>` : ''
    return `<figure class="media"><a href="${escapeHtml(full)}"><img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer"></a>${cap}</figure>`
  }
  const url = safeMediaUrl(att.url) || safeMediaUrl(att.remote_url)
  if (!url) return ''
  const label = att.description ? truncate(att.description, 120) : `${att.type} attachment`
  return `<p class="media-link">[${escapeHtml(att.type)}] <a href="${escapeHtml(url)}" rel="nofollow noopener noreferrer">${escapeHtml(label)}</a></p>`
}

function mediaViews(s: Status): string {
  const items = s.media_attachments.map(attachmentView).join('')
  if (!items) return ''
  if (s.sensitive) {
    return `<details class="cw"><summary>Sensitive media (select to reveal)</summary>${items}</details>`
  }
  return items
}

function pollView(p: Poll): string {
  const total = p.votes_count > 0 ? p.votes_count : p.options.reduce((n, o) => n + o.votes_count, 0)
  const rows = p.options
    .map((o) => {
      const pct = total > 0 ? Math.round((o.votes_count / total) * 100) : 0
      return `<li><span class="poll-bar"><progress max="100" value="${pct}"></progress> <span class="poll-pct">${pct}%</span></span> <span class="poll-title">${renderEmojiText(o.title, p.emojis)}</span></li>`
    })
    .join('')
  const closes = p.expires_at
    ? ` · ${p.expired ? 'ended' : 'closes'} ${timeTag(p.expires_at)}`
    : ''
  return `<div class="poll">
<ul>${rows}</ul>
<p class="poll-meta">${total} vote${total === 1 ? '' : 's'}${p.voters_count > 0 ? ` · ${p.voters_count} voter${p.voters_count === 1 ? '' : 's'}` : ''}${closes}</p>
</div>`
}

function cardView(cd: Card): string {
  const url = safeUrl(cd.url) ?? '#'
  const img = safeMediaUrl(cd.image)
  return `<aside class="link-card">
<p class="link-card-title"><a href="${escapeHtml(url)}" rel="nofollow noopener noreferrer">${escapeHtml(cd.title)}</a>${cd.provider_name ? ` — ${escapeHtml(cd.provider_name)}` : ''}</p>
${cd.description ? `<p class="link-card-desc">${escapeHtml(cd.description)}</p>` : ''}
${img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}
</aside>`
}

function statusBody(s: Status, domain: string): string {
  const content = sanitizeHtml(s.content, { rewriteHref: makeHrefRewriter(domain) })
  const parts = [
    content ? `<div class="content">${content}</div>` : '<p class="content content-empty">(no text content)</p>',
    mediaViews(s),
    s.poll ? pollView(s.poll) : '',
    s.card ? cardView(s.card) : '',
  ]
  return parts.filter(Boolean).join('\n')
}

export function statusView(s: Status, domain: string, opts: { highlight?: boolean } = {}): string {
  const target = s.reblog ?? s
  const profileHref = `/${domain}/@${target.account.acct}`
  const statusHref = `${profileHref}/${target.id}`
  const cw = target.spoiler_text
    ? `<details class="cw"><summary><strong>Content warning:</strong> ${escapeHtml(target.spoiler_text)} <span class="cw-hint">(select to reveal)</span></summary>${statusBody(target, domain)}</details>`
    : statusBody(target, domain)
  const visibility =
    target.visibility && target.visibility !== 'public'
      ? ` <span class="badge">${escapeHtml(target.visibility)}</span>`
      : ''
  const boosted = s.reblog
    ? `<p class="context-line">Boosted by ${accountLinkInline(s.account, domain)}</p>`
    : ''
  const original = target.url
    ? ` · <a rel="nofollow noopener noreferrer" href="${escapeHtml(target.url)}">original</a>`
    : ''
  return `<article class="status${opts.highlight ? ' status-highlight' : ''}" id="status-${escapeHtml(target.id)}">
${boosted}<header class="status-header">${authorBlock(target.account, domain)}${visibility}<a class="permalink" href="${escapeHtml(statusHref)}">${timeTag(target.created_at)}</a></header>
${cw}
<footer class="status-meta"><span>${target.replies_count} repl${target.replies_count === 1 ? 'y' : 'ies'}</span> · <span>${target.reblogs_count} boost${target.reblogs_count === 1 ? '' : 's'}</span> · <span>${target.favourites_count} favourite${target.favourites_count === 1 ? '' : 's'}</span>${original}</footer>
</article>`
}

export function timelineList(statuses: Status[], domain: string): string {
  if (statuses.length === 0) {
    return '<p class="empty">No posts to show. The instance may be empty, or nothing public is available right now.</p>'
  }
  return statuses.map((s) => statusView(s, domain)).join('\n')
}

export function paginationView(hrefBase: string, nextMaxId: string | null): string {
  if (!nextMaxId) return ''
  const sep = hrefBase.includes('?') ? '&' : '?'
  return `<nav class="pagination" aria-label="Pagination"><a rel="next" href="${escapeHtml(`${hrefBase}${sep}max_id=${encodeURIComponent(nextMaxId)}`)}">Older posts</a></nav>`
}

export function accountHeaderView(a: Account, domain: string): string {
  const rw = makeHrefRewriter(domain)
  const note = sanitizeHtml(a.note, { rewriteHref: rw })
  const fields = a.fields.length
    ? `<dl class="fields">${a.fields
        .map(
          (f) =>
            `<div><dt>${escapeHtml(f.name)}</dt><dd>${sanitizeHtml(f.value, { rewriteHref: rw }) || '<span class="dim">(empty)</span>'}</dd></div>`,
        )
        .join('')}</dl>`
    : ''
  const name = renderEmojiText(a.display_name || a.username, a.emojis) || escapeHtml(a.username)
  const badges = [
    a.bot ? '<span class="badge">bot</span>' : '',
    a.locked ? '<span class="badge">locked</span>' : '',
  ].filter(Boolean).join(' ')
  return `<header class="profile">
<h1>${name}${badges ? ` ${badges}` : ''}</h1>
<p class="acct">@${escapeHtml(a.acct)}</p>
${note ? `<div class="note content">${note}</div>` : ''}
${fields}
<dl class="stats">
<div><dt>Posts</dt><dd>${a.statuses_count}</dd></div>
<div><dt>Following</dt><dd>${a.following_count}</dd></div>
<div><dt>Followers</dt><dd>${a.followers_count}</dd></div>
</dl>
<p class="profile-meta">Joined ${timeTag(a.created_at)}${a.url ? ` · <a rel="nofollow noopener noreferrer" href="${escapeHtml(a.url)}">Original profile</a>` : ''}</p>
</header>`
}

export function profileTabs(domain: string, acct: string, active: string): string {
  const tabs: Array<[string, string]> = [
    ['posts', 'Posts'],
    ['replies', 'Posts and replies'],
    ['media', 'Media'],
  ]
  const links = tabs
    .map(([key, label]) => {
      const cur = key === active ? ' aria-current="page"' : ''
      return `<a href="/${domain}/@${escapeHtml(acct)}?tab=${key}"${cur}>${label}</a>`
    })
    .join('')
  return `<nav class="tabs" aria-label="Profile timelines">${links}</nav>`
}

export function accountCardList(accounts: Account[], domain: string): string {
  if (accounts.length === 0) return '<p class="empty">No matching accounts.</p>'
  const items = accounts
    .map((a) => {
      const name = renderEmojiText(a.display_name || a.username, a.emojis) || escapeHtml(a.username)
      return `<li>${avatarView(a)} <a href="/${domain}/@${escapeHtml(a.acct)}"><span class="name">${name}</span> <span class="acct">@${escapeHtml(a.acct)}</span></a></li>`
    })
    .join('')
  return `<ul class="account-list">${items}</ul>`
}

export function hashtagList(tags: string[], domain: string): string {
  if (tags.length === 0) return '<p class="empty">No matching hashtags.</p>'
  const items = tags.map((t) => `<li><a href="/${domain}/tags/${encodeURIComponent(t)}">#${escapeHtml(t)}</a></li>`).join('')
  return `<ul class="tag-list">${items}</ul>`
}

export function instanceView(info: InstanceInfo, domain: string): string {
  const stats: string[] = []
  if (info.users !== null) stats.push(`<div><dt>Users</dt><dd>${info.users.toLocaleString('en-US')}</dd></div>`)
  if (info.activeMonth !== null) stats.push(`<div><dt>Active this month</dt><dd>${info.activeMonth.toLocaleString('en-US')}</dd></div>`)
  if (info.statuses !== null) stats.push(`<div><dt>Posts</dt><dd>${info.statuses.toLocaleString('en-US')}</dd></div>`)
  if (info.peers !== null) stats.push(`<div><dt>Federated peers</dt><dd>${info.peers.toLocaleString('en-US')}</dd></div>`)
  return `<h1>${escapeHtml(info.title)}</h1>
<p class="page-desc">${escapeHtml(domain)}${info.version ? ` · Mastodon-compatible, version ${escapeHtml(info.version)}` : ''}</p>
${info.description ? `<div class="content">${escapeHtml(info.description)}</div>` : ''}
${stats.length ? `<dl class="stats">${stats.join('')}</dl>` : ''}
<nav class="instance-links" aria-label="Browse">
<a href="/${escapeHtml(domain)}/public">Public timeline</a>
<a href="/${escapeHtml(domain)}/local">Local timeline</a>
<a href="/${escapeHtml(domain)}/search">Search</a>
<a rel="nofollow noopener noreferrer" href="https://${escapeHtml(domain)}">Open ${escapeHtml(domain)} directly</a>
</nav>
${searchForm(domain, '')}`
}

export function searchForm(domain: string, q: string): string {
  return `<form class="search-form" action="/${escapeHtml(domain)}/search" method="get" role="search">
<label for="q">Search ${escapeHtml(domain)}</label>
<input id="q" type="search" name="q" value="${escapeHtml(q)}" maxlength="200" placeholder="posts, people, hashtags">
<button type="submit">Search</button>
</form>`
}

export function errorView(e: {
  status: number
  title: string
  detail: string
  hint?: string
  domain?: string
}): string {
  const back = e.domain
    ? `<p><a href="/instance/${escapeHtml(e.domain)}">Back to ${escapeHtml(e.domain)}</a> · <a href="/">mastoview home</a></p>`
    : '<p><a href="/">mastoview home</a></p>'
  return layout({
    title: `${e.status} ${e.title} — mastoview`,
    domain: e.domain,
    body: `<article class="error">
<h1>${e.status} — ${escapeHtml(e.title)}</h1>
<p>${escapeHtml(e.detail)}</p>
${e.hint ? `<p class="hint">${escapeHtml(e.hint)}</p>` : ''}
${back}
</article>`,
  })
}
