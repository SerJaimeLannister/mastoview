import type { Status, Account } from '../src/mastodon'

export const fixtureAccount: Account = {
  id: '1',
  username: 'alice',
  acct: 'alice',
  display_name: 'Alice &amp; Friends :blobcat:',
  note: '<p>Just testing. <a href="https://mastodon.social/tags/rust" rel="tag">#rust</a></p>',
  url: 'https://mastodon.social/@alice',
  avatar: 'https://files.mastodon.social/avatars/000/000/001/original/alice.png',
  created_at: '2020-01-01T00:00:00.000Z',
  locked: false,
  bot: false,
  followers_count: 12,
  following_count: 34,
  statuses_count: 56,
  fields: [
    { name: 'Website', value: '<a href="https://alice.example" rel="nofollow noopener noreferrer"><span class="invisible">https://</span><span class="">alice.example</span></a>', verified_at: null },
  ],
  emojis: [{ shortcode: 'blobcat', url: 'https://files.mastodon.social/custom_emojis/images/blobcat.png' }],
}

export const maliciousStatus = {
  id: '110000000000000001',
  created_at: '2026-01-02T03:04:05.000Z',
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  sensitive: false,
  spoiler_text: '',
  visibility: 'public',
  language: 'en',
  uri: 'https://mastodon.social/users/alice/statuses/110000000000000001',
  url: 'https://mastodon.social/@alice/110000000000000001',
  replies_count: 3,
  reblogs_count: 5,
  favourites_count: 7,
  edited_at: null,
  content:
    '<p>hi <script>alert(1)</script>' +
    '<a href="javascript:alert(1)">bad</a> ' +
    '<a href="https://mastodon.social/@gargron" class="u-url mention">@gargron</a> ' +
    '<a href="https://mastodon.social/tags/rust" class="mention hashtag">#rust</a> ' +
    '<a href="https://evil.example/ok" onclick="steal()">fine</a> ' +
    '<img src=x onerror=alert(1)> ' +
    '<svg onload=alert(1)><circle r="1"/></svg> ' +
    '<iframe src="https://evil.example"></iframe> ' +
    '<span onmouseover="x()" style="position:fixed" class="h-card">styled &amp; safe</span> ' +
    '<a href="jAvaScRipt:x">case</a> ' +
    '<a href="java\tscript:alert(1)">tab</a> ' +
    '<a href="&#106;avascript:alert(1)">entity</a> ' +
    '<a href="data:text/html,<script>alert(1)</script>">data</a></p>',
  reblog: null,
  application: null,
  account: fixtureAccount,
  media_attachments: [],
  mentions: [],
  tags: [],
  emojis: [],
  card: null,
  poll: null,
  filtered: [],
}

export const richStatus = {
  id: '110000000000000002',
  created_at: '2026-03-04T05:06:07.000Z',
  in_reply_to_id: null,
  in_reply_to_account_id: null,
  sensitive: false,
  spoiler_text: 'mild peril',
  visibility: 'unlisted',
  uri: 'https://mastodon.social/users/alice/statuses/110000000000000002',
  url: 'https://mastodon.social/@alice/110000000000000002',
  replies_count: 1,
  reblogs_count: 2,
  favourites_count: 3,
  content: '<p>Poll &amp; card &hellip; <em>emphasis</em> <code>x &lt; y</code></p><p>second para</p>',
  reblog: null,
  account: fixtureAccount,
  media_attachments: [
    {
      id: 'm1',
      type: 'image',
      url: 'https://files.mastodon.social/media/1.png',
      preview_url: 'https://files.mastodon.social/media/1_small.png',
      remote_url: null,
      description: 'A cat wearing a tiny hat',
    },
    {
      id: 'm2',
      type: 'video',
      url: 'https://files.mastodon.social/media/2.mp4',
      preview_url: null,
      remote_url: null,
      description: 'A short clip',
    },
  ],
  mentions: [],
  tags: [],
  emojis: [],
  card: {
    url: 'https://blog.example/rust-is-neat',
    title: 'Rust is neat',
    description: 'An article about Rust.',
    type: 'link',
    provider_name: 'blog.example',
    image: 'https://blog.example/cover.png',
    author_name: '',
    author_url: '',
    html: '',
    width: 0,
    height: 0,
    embed_url: '',
    blurhash: '',
  },
  poll: {
    id: 'p1',
    expires_at: '2027-01-01T00:00:00.000Z',
    expired: false,
    multiple: false,
    votes_count: 100,
    voters_count: 60,
    options: [
      { title: 'yes :blobcat:', votes_count: 75 },
      { title: 'no', votes_count: 25 },
    ],
    emojis: [{ shortcode: 'blobcat', url: 'https://files.mastodon.social/custom_emojis/images/blobcat.png' }],
  },
  filtered: [],
}

export const boostedStatus = {
  ...maliciousStatus,
  id: '110000000000000003',
  content: '<p>original post body</p>',
  reblog: maliciousStatus,
}

export function timelineBody(statuses: unknown[], nextMaxId?: string): { body: unknown; link: string | null } {
  const link = nextMaxId
    ? `<https://mastodon.social/api/v1/timelines/public?max_id=${nextMaxId}>; rel="next", <https://mastodon.social/api/v1/timelines/public?min_id=1>; rel="prev"`
    : null
  return { body: statuses, link }
}

export const parsedStatusFixture: Status = {
  id: '1',
  uri: '',
  url: '',
  created_at: '2026-01-01T00:00:00.000Z',
  content: '<p>ok</p>',
  spoiler_text: '',
  visibility: 'public',
  sensitive: false,
  in_reply_to_id: null,
  account: fixtureAccount,
  reblog: null,
  media_attachments: [],
  poll: null,
  card: null,
  replies_count: 0,
  reblogs_count: 0,
  favourites_count: 0,
}
