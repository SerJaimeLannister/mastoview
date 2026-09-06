const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '\u00AB', raquo: '\u00BB', bull: '\u2022', middot: '\u00B7',
  copy: '\u00A9', reg: '\u00AE', trade: '\u2122', deg: '\u00B0',
  plusmn: '\u00B1', times: '\u00D7', divide: '\u00F7', minus: '\u2212',
  sup2: '\u00B2', sup3: '\u00B3', frac12: '\u00BD', frac14: '\u00BC', frac34: '\u00BE',
  cent: '\u00A2', pound: '\u00A3', euro: '\u20AC', yen: '\u00A5',
  sect: '\u00A7', para: '\u00B6', dagger: '\u2020', Dagger: '\u2021',
  prime: '\u2032', Prime: '\u2033', permil: '\u2030',
  larr: '\u2190', uarr: '\u2191', rarr: '\u2192', darr: '\u2193', harr: '\u2194',
  infin: '\u221E', ne: '\u2260', le: '\u2264', ge: '\u2265',
  agrave: '\u00E0', aacute: '\u00E1', acirc: '\u00E2', auml: '\u00E4',
  ccedil: '\u00E7', egrave: '\u00E8', eacute: '\u00E9', ecirc: '\u00EA', euml: '\u00EB',
  iuml: '\u00EF', ograve: '\u00F2', oacute: '\u00F3', ocirc: '\u00F4', ouml: '\u00F6',
  ugrave: '\u00F9', uacute: '\u00FA', ucirc: '\u00FB', uuml: '\u00FC',
  szlig: '\u00DF', ntilde: '\u00F1',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#[xX][0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, body: string) => {
    if (body.startsWith('#')) {
      const cp = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      if (!Number.isFinite(cp)) return ''
      if ((cp < 0x20 && cp !== 0x9 && cp !== 0xa && cp !== 0xd) || cp === 0x7f) return ''
      if (cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff)) return ''
      try {
        return String.fromCodePoint(cp)
      } catch {
        return ''
      }
    }
    return NAMED_ENTITIES[body] ?? m
  })
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function safeUrl(raw: string): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (t === '') return null
  if (/[\u0000-\u001f\u007f]/.test(t)) return null
  if (t.startsWith('#')) return t.length <= 128 ? t : null
  if (t.startsWith('/')) return t.startsWith('//') ? null : t
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return u.toString()
  } catch {
    return null
  }
}

export function safeMediaUrl(raw: string | null | undefined): string | null {
  if (!raw) return null
  const t = raw.trim()
  if (t === '' || /[\u0000-\u001f\u007f]/.test(t)) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:') return null
    return u.toString()
  } catch {
    return null
  }
}

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'cite', 'code', 'dd', 'del', 'dl', 'dt',
  'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'li', 'ol',
  'p', 'pre', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'u', 'ul',
])

const DROP_SUBTREE = new Set([
  'applet', 'audio', 'base', 'button', 'canvas', 'datalist', 'dialog', 'embed',
  'fieldset', 'form', 'frame', 'frameset', 'head', 'iframe', 'input', 'label',
  'legend', 'link', 'math', 'meta', 'noscript', 'object', 'option', 'output',
  'portal', 'script', 'select', 'slot', 'source', 'style', 'svg', 'template',
  'textarea', 'title', 'track', 'video', 'xmp',
])

const VOID_TAGS = new Set(['br', 'hr', 'img'])

export interface SanitizeOptions {
  rewriteHref?: (href: string) => string
}

interface RawAttr {
  name: string
  value: string
}

export function sanitizeHtml(input: string, opts: SanitizeOptions = {}): string {
  if (typeof input !== 'string' || input.length === 0) return ''
  const n = input.length
  let out = ''
  let i = 0
  let skipTag: string | null = null
  let skipDepth = 0
  const stack: string[] = []

  const emitText = (chunk: string) => {
    if (skipTag !== null || chunk === '') return
    out += escapeHtml(decodeEntities(chunk))
  }

  const closeUpTo = (name: string) => {
    const idx = stack.lastIndexOf(name)
    if (idx === -1) return
    while (stack.length > idx) out += `</${stack.pop()}>`
  }

  while (i < n) {
    const lt = input.indexOf('<', i)
    if (lt === -1) {
      emitText(input.slice(i))
      break
    }
    emitText(input.slice(i, lt))
    i = lt

    if (input.startsWith('<!--', i)) {
      const end = input.indexOf('-->', i + 4)
      i = end === -1 ? n : end + 3
      continue
    }
    if (input.startsWith('<!', i) || input.startsWith('<?', i)) {
      const end = input.indexOf('>', i + 2)
      i = end === -1 ? n : end + 1
      continue
    }
    if (input.startsWith('</', i)) {
      const nameMatch = /^<\/\s*([a-zA-Z][a-zA-Z0-9:-]*)/.exec(input.slice(i, i + 80))
      if (!nameMatch) {
        emitText('<')
        i += 1
        continue
      }
      const name = nameMatch[1].toLowerCase()
      const gt = input.indexOf('>', i)
      i = gt === -1 ? n : gt + 1
      if (skipTag !== null) {
        if (name === skipTag) {
          skipDepth -= 1
          if (skipDepth <= 0) skipTag = null
        }
        continue
      }
      if (ALLOWED_TAGS.has(name) && !VOID_TAGS.has(name)) closeUpTo(name)
      continue
    }

    const openMatch = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(input.slice(i, i + 80))
    if (!openMatch) {
      emitText('<')
      i += 1
      continue
    }
    const name = openMatch[1].toLowerCase()
    let j = i + openMatch[0].length
    let selfClosing = false
    let malformed = false
    const attrs: RawAttr[] = []

    while (j < n) {
      while (j < n && /\s/.test(input[j])) j++
      if (j >= n) {
        malformed = true
        break
      }
      const ch = input[j]
      if (ch === '>') {
        j++
        break
      }
      if (ch === '/') {
        if (input[j + 1] === '>') {
          selfClosing = true
          j += 2
          break
        }
        j++
        continue
      }
      const nameMatch = /^[^\s=/>]+/.exec(input.slice(j, j + 200))
      if (!nameMatch) {
        malformed = true
        break
      }
      const attrName = nameMatch[0]
      j += attrName.length
      while (j < n && /\s/.test(input[j])) j++
      let value = ''
      if (j < n && input[j] === '=') {
        j++
        while (j < n && /\s/.test(input[j])) j++
        if (j < n && (input[j] === '"' || input[j] === "'")) {
          const q = input[j]
          const endQ = input.indexOf(q, j + 1)
          if (endQ === -1) {
            malformed = true
            break
          }
          value = input.slice(j + 1, endQ)
          j = endQ + 1
        } else {
          const vMatch = /^[^\s>]*/.exec(input.slice(j, j + 2000))
          value = vMatch ? vMatch[0] : ''
          j += value.length
        }
      }
      attrs.push({ name: attrName.toLowerCase(), value })
    }

    if (malformed) {
      const gt = input.indexOf('>', j)
      i = gt === -1 ? n : gt + 1
      continue
    }
    i = j

    if (skipTag !== null) {
      if (name === skipTag && !selfClosing) skipDepth++
      continue
    }
    if (DROP_SUBTREE.has(name)) {
      if (!selfClosing && !VOID_TAGS.has(name)) {
        skipTag = name
        skipDepth = 1
      }
      continue
    }
    if (!ALLOWED_TAGS.has(name)) continue

    if (name === 'a' && stack.includes('a')) closeUpTo('a')

    let tag = `<${name}`
    const findAttr = (wanted: string) => attrs.find((a) => a.name === wanted)?.value
    if (name === 'a') {
      const href = safeUrl(decodeEntities(findAttr('href') ?? ''))
      if (href) {
        const final = opts.rewriteHref ? opts.rewriteHref(href) : href
        tag += ` href="${escapeHtml(final)}" rel="nofollow noopener noreferrer"`
      }
      const title = decodeEntities(findAttr('title') ?? '').slice(0, 200)
      if (title) tag += ` title="${escapeHtml(title)}"`
    } else if (name === 'abbr') {
      const title = decodeEntities(findAttr('title') ?? '').slice(0, 200)
      if (title) tag += ` title="${escapeHtml(title)}"`
    } else if (name === 'img') {
      const src = safeMediaUrl(decodeEntities(findAttr('src') ?? ''))
      if (!src) continue
      const alt = decodeEntities(findAttr('alt') ?? '').slice(0, 500)
      tag += ` src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer"`
    }
    tag += '>'
    out += tag
    if (!selfClosing && !VOID_TAGS.has(name)) stack.push(name)
  }

  while (stack.length) out += `</${stack.pop()}>`
  return out
}

export function makeHrefRewriter(domain: string): (href: string) => string {
  const host = domain.toLowerCase()
  return (href) => {
    try {
      const u = new URL(href)
      if (u.hostname !== host) return href
      let m = /^\/@([A-Za-z0-9_]+)\/([0-9]+)\/?$/.exec(u.pathname)
      if (m) return `/${domain}/@${m[1]}/${m[2]}`
      m = /^\/@([A-Za-z0-9_]+)\/?$/.exec(u.pathname)
      if (m) return `/${domain}/@${m[1]}`
      m = /^\/tags\/([A-Za-z0-9_]+)\/?$/.exec(u.pathname)
      if (m) return `/${domain}/tags/${m[1]}`
      return href
    } catch {
      return href
    }
  }
}
