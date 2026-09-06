import { describe, expect, it } from 'vitest'
import {
  decodeEntities,
  makeHrefRewriter,
  safeMediaUrl,
  safeUrl,
  sanitizeHtml,
} from '../src/sanitize'

describe('safeUrl', () => {
  it('accepts http(s), relative paths and fragments', () => {
    expect(safeUrl('https://mastodon.social/@gargron')).toBe('https://mastodon.social/@gargron')
    expect(safeUrl('http://example.com/a?b=c')).toBe('http://example.com/a?b=c')
    expect(safeUrl('/tags/rust')).toBe('/tags/rust')
    expect(safeUrl('#section')).toBe('#section')
  })

  it('rejects dangerous schemes', () => {
    expect(safeUrl('javascript:alert(1)')).toBeNull()
    expect(safeUrl('JaVaScRiPt:alert(1)')).toBeNull()
    expect(safeUrl(' javascript:alert(1)')).toBeNull()
    expect(safeUrl('java\tscript:alert(1)')).toBeNull()
    expect(safeUrl('java\nscript:alert(1)')).toBeNull()
    expect(safeUrl('&#106;avascript:alert(1)')).toBeNull()
    expect(safeUrl('data:text/html,<script>')).toBeNull()
    expect(safeUrl('vbscript:x')).toBeNull()
    expect(safeUrl('file:///etc/passwd')).toBeNull()
    expect(safeUrl('//evil.example/x')).toBeNull()
    expect(safeUrl('')).toBeNull()
  })
})

describe('safeMediaUrl', () => {
  it('only accepts absolute https', () => {
    expect(safeMediaUrl('https://files.example/a.png')).toBe('https://files.example/a.png')
    expect(safeMediaUrl('http://files.example/a.png')).toBeNull()
    expect(safeMediaUrl('data:image/png;base64,AAAA')).toBeNull()
    expect(safeMediaUrl('/relative.png')).toBeNull()
    expect(safeMediaUrl(null)).toBeNull()
  })
})

describe('decodeEntities', () => {
  it('decodes named and numeric entities', () => {
    expect(decodeEntities('&amp;&lt;&gt;&quot;')).toBe('&<>"')
    expect(decodeEntities('&#39;&#x27;')).toBe("''")
    expect(decodeEntities('a &hellip; b &mdash; c')).toBe('a … b — c')
    expect(decodeEntities('&notanentity; &amp')).toBe('&notanentity; &amp')
  })
})

describe('sanitizeHtml', () => {
  it('preserves ordinary Mastodon content markup', () => {
    const html = '<p>hi <a href="https://x.example/a" rel="tag">#tag</a> <em>em</em> <strong>st</strong> <code>c</code></p>'
    expect(sanitizeHtml(html)).toBe(
      '<p>hi <a href="https://x.example/a" rel="nofollow noopener noreferrer">#tag</a> <em>em</em> <strong>st</strong> <code>c</code></p>',
    )
  })

  it('strips scripts, event handlers and javascript: urls', () => {
    const out = sanitizeHtml(
      '<p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://ok.example" onclick="steal()">ok</a><img src=x onerror=alert(1)><span onmouseover="y()" style="color:red">s</span></p>',
    )
    expect(out).not.toMatch(/<script/i)
    expect(out).not.toMatch(/onerror|onclick|onmouseover/i)
    expect(out).not.toMatch(/javascript:/i)
    expect(out).not.toMatch(/style=/)
    expect(out).toContain('href="https://ok.example/" rel="nofollow noopener noreferrer"')
    expect(out).toContain('<span>s</span>')
  })

  it('drops dangerous containers with their subtree', () => {
    const out = sanitizeHtml('<p>a<svg onload="x"><circle/></svg>b<iframe src="https://x"><p>inner</p></iframe>c</p>')
    expect(out).toBe('<p>abc</p>')
    expect(sanitizeHtml('<style>body{}</style><p>ok</p>')).toBe('<p>ok</p>')
    expect(sanitizeHtml('<object data="x"><param name="a">hidden</object>ok')).toBe('ok')
  })

  it('unwraps unknown-but-harmless tags while keeping text', () => {
    expect(sanitizeHtml('<figure><figcaption>cap</figcaption>text</figure>')).toBe('captext')
  })

  it('decodes entities in text and re-escapes on output', () => {
    expect(sanitizeHtml('<p>a &amp; b &lt; c &hellip;</p>')).toBe('<p>a &amp; b &lt; c …</p>')
  })

  it('decodes entities inside href before validating', () => {
    const out = sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>')
    expect(out).toBe('<a>x</a>')
  })

  it('rejects data: urls in href', () => {
    expect(sanitizeHtml('<a href="data:text/html,x">y</a>')).toBe('<a>y</a>')
  })

  it('balances unbalanced tags', () => {
    expect(sanitizeHtml('<p><b>bold')).toBe('<p><b>bold</b></p>')
    expect(sanitizeHtml('stray</b> text')).toBe('stray text')
    expect(sanitizeHtml('<p>a<b>b</p>c</b>')).toBe('<p>a<b>b</b></p>c')
  })

  it('prevents nested anchors', () => {
    const out = sanitizeHtml('<a href="https://a.example">x <a href="https://b.example">y</a> z</a>')
    expect(out.match(/<a /g)?.length).toBe(2)
    expect(out).toContain('</a><a href="https://b.example/"')
    expect(out.indexOf('<a ', out.indexOf('<a ') + 1)).toBeGreaterThan(out.indexOf('</a>'))
  })

  it('strips comments, doctypes, cdata and processing instructions', () => {
    expect(sanitizeHtml('a<!-- hidden <script>x</script> -->b')).toBe('ab')
    expect(sanitizeHtml('<!DOCTYPE html><p>x</p>')).toBe('<p>x</p>')
    expect(sanitizeHtml('<?php evil(); ?><p>x</p>')).toBe('<p>x</p>')
    expect(sanitizeHTMLUnterminated('<p>a')).toBe('<p>a</p>')
  })

  it('handles malformed attributes without emitting broken markup', () => {
    const out = sanitizeHtml('<p><a href="https://ok.example" <span>x</a></p>')
    expect(out).not.toMatch(/<a [^>]*</)
    expect(out).toBe('<p><a href="https://ok.example/" rel="nofollow noopener noreferrer">x</a></p>')
  })

  it('keeps https images only, with no handlers', () => {
    const out = sanitizeHtml('<p><img src="https://files.example/e.png" alt=":wave:" class="emojione"><img src="http://insecure.example/e.png"></p>')
    expect(out).toBe('<p><img src="https://files.example/e.png" alt=":wave:" loading="lazy" referrerpolicy="no-referrer"></p>')
  })

  it('supports href rewriting for the viewed instance', () => {
    const rw = makeHrefRewriter('mastodon.social')
    const out = sanitizeHtml(
      '<p><a href="https://mastodon.social/@gargron" class="u-url mention">@gargron</a> <a href="https://mastodon.social/@gargron/100">post</a> <a href="https://mastodon.social/tags/rust">#rust</a> <a href="https://other.example/@x">@x</a></p>',
      { rewriteHref: rw },
    )
    expect(out).toContain('href="/mastodon.social/@gargron"')
    expect(out).toContain('href="/mastodon.social/@gargron/100"')
    expect(out).toContain('href="/mastodon.social/tags/rust"')
    expect(out).toContain('href="https://other.example/@x"')
  })

  it('returns empty string for non-string input', () => {
    expect(sanitizeHtml(undefined as unknown as string)).toBe('')
    expect(sanitizeHtml('')).toBe('')
  })
})

function sanitizeHTMLUnterminated(s: string): string {
  return sanitizeHtml(s)
}
