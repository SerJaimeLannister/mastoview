import { CFG } from './config'

export function validateDomain(raw: string | undefined): string | null {
  if (!raw) return null
  const d = raw.trim().toLowerCase().replace(/\.$/, '')
  if (d.length < 4 || d.length > 253) return null
  if (!/^[a-z0-9.-]+$/.test(d)) return null
  if (!d.includes('.')) return null
  for (const label of d.split('.')) {
    if (label.length < 1 || label.length > 63) return null
    if (label.startsWith('-') || label.endsWith('-')) return null
    if (/^\d+$/.test(label)) return null
  }
  return d
}

export function validUsername(raw: string | undefined): string | null {
  if (!raw) return null
  const u = raw.trim()
  const m = /^([A-Za-z0-9_]{1,64})(?:@([A-Za-z0-9.-]{3,253}))?$/.exec(u)
  if (!m) return null
  if (m[2] !== undefined && !validateDomain(m[2])) return null
  return u
}

export function validStatusId(raw: string): boolean {
  return /^[A-Za-z0-9]{1,64}$/.test(raw)
}

export function validTag(raw: string): boolean {
  return raw.length >= 1 && raw.length <= 64 && /^[\p{L}\p{N}_]+$/u.test(raw)
}

export function validMaxId(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null
  return /^\d{1,32}$/.test(raw) ? raw : null
}

export function validSearchQuery(raw: string | undefined): string | null {
  if (!raw) return null
  const q = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (q.length < 1 || q.length > CFG.searchQueryMax) return null
  return q
}
