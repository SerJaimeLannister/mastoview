export const CFG = {
  userAgent: 'mastoview/0.1 (read-only, JavaScript-free Mastodon reader)',
  apiTimeoutMs: 8000,
  maxResponseBytes: 2_000_000,
  timelineLimit: 20,
  maxStatuses: 40,
  searchQueryMax: 200,
} as const

export const CACHE_CONTROL = {
  home: 'public, s-maxage=3600',
  instance: 'public, s-maxage=600, stale-while-revalidate=1800',
  timeline: 'public, s-maxage=120, stale-while-revalidate=600',
  profile: 'public, s-maxage=120, stale-while-revalidate=600',
  status: 'public, s-maxage=60, stale-while-revalidate=300',
  search: 'public, s-maxage=300, stale-while-revalidate=900',
  css: 'public, max-age=86400, s-maxage=86400',
  none: 'no-store',
} as const
