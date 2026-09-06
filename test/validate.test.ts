import { describe, expect, it } from 'vitest'
import {
  validateDomain,
  validMaxId,
  validSearchQuery,
  validStatusId,
  validTag,
  validUsername,
} from '../src/validate'

describe('validateDomain', () => {
  it.each([
    'mastodon.social',
    'fosstodon.org',
    'Mastodon.Social',
    'sub.domain.example',
    'xn--eckwd4c7c.example',
    'instance.example.',
  ])('accepts %s', (d) => {
    expect(validateDomain(d)).toBeTruthy()
  })

  it.each([
    '',
    undefined,
    'localhost',
    'foo',
    '127.0.0.1',
    '10.0.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '0.0.0.0',
    'instance..com',
    '-bad.com',
    'bad-.com',
    'ba d.com',
    'bad.com:22',
    'bad.com/path',
    'bad@com',
    'user@bad.com',
    'javascript:x',
    'foo_bar.example',
    `long${'a'.repeat(250)}.com`,
  ])('rejects %s', (d) => {
    expect(validateDomain(d as string)).toBeNull()
  })

  it('normalizes case and trailing dot', () => {
    expect(validateDomain('Mastodon.Social.')).toBe('mastodon.social')
  })
})

describe('validUsername', () => {
  it('accepts local and qualified usernames', () => {
    expect(validUsername('gargron')).toBe('gargron')
    expect(validUsername('gargron@mastodon.social')).toBe('gargron@mastodon.social')
  })
  it('rejects junk', () => {
    expect(validUsername('../etc')).toBeNull()
    expect(validUsername('a b')).toBeNull()
    expect(validUsername('user@not_a_domain')).toBeNull()
    expect(validUsername('')).toBeNull()
    expect(validUsername('x'.repeat(65))).toBeNull()
  })
})

describe('validStatusId', () => {
  it('accepts alphanumeric ids', () => {
    expect(validStatusId('110000000000000001')).toBe(true)
    expect(validStatusId('abc123')).toBe(true)
  })
  it('rejects path fragments and long ids', () => {
    expect(validStatusId('1/../../admin')).toBe(false)
    expect(validStatusId('a.b')).toBe(false)
    expect(validStatusId('')).toBe(false)
    expect(validStatusId('x'.repeat(65))).toBe(false)
  })
})

describe('validTag', () => {
  it('accepts word-like tags', () => {
    expect(validTag('rust')).toBe(true)
    expect(validTag('100DaysToOffload')).toBe(true)
  })
  it('rejects others', () => {
    expect(validTag('')).toBe(false)
    expect(validTag('a/b')).toBe(false)
    expect(validTag('a b')).toBe(false)
    expect(validTag(`x${'y'.repeat(64)}`)).toBe(false)
  })
})

describe('validMaxId', () => {
  it('accepts numeric ids', () => {
    expect(validMaxId('12345')).toBe('12345')
    expect(validMaxId(undefined)).toBeNull()
  })
  it('rejects non-numeric', () => {
    expect(validMaxId('abc')).toBeNull()
    expect(validMaxId('1;DROP')).toBeNull()
    expect(validMaxId('')).toBeNull()
  })
})

describe('validSearchQuery', () => {
  it('normalizes whitespace and strips control characters', () => {
    expect(validSearchQuery('  rust   lang \u0000 ')).toBe('rust lang')
  })
  it('rejects empty and oversized', () => {
    expect(validSearchQuery('')).toBeNull()
    expect(validSearchQuery(undefined)).toBeNull()
    expect(validSearchQuery('x'.repeat(201))).toBeNull()
    expect(validSearchQuery('ok')).toBe('ok')
  })
})
