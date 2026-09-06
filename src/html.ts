import { decodeEntities, escapeHtml, safeMediaUrl } from './sanitize'
import type { Emoji } from './mastodon'

export { escapeHtml }

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

export function renderEmojiText(text: string, emojis: Emoji[]): string {
  let out = escapeHtml(text)
  for (const e of emojis) {
    const url = safeMediaUrl(e.url)
    if (!url) continue
    out = out.replaceAll(
      `:${e.shortcode}:`,
      `<img class="emoji" src="${escapeHtml(url)}" alt=":${escapeHtml(e.shortcode)}:" title=":${escapeHtml(e.shortcode)}:" width="16" height="16" loading="lazy" referrerpolicy="no-referrer">`,
    )
  }
  return out
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function fmtUTC(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}

export function timeTag(iso: string): string {
  const fmt = fmtUTC(iso)
  if (!fmt) return `<time>${escapeHtml(truncate(iso, 40))}</time>`
  return `<time datetime="${escapeHtml(iso)}">${fmt}</time>`
}

export function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
