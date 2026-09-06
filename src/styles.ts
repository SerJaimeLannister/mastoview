export const STYLES = `:root {
  --font: ui-monospace, "SF Mono", "Cascadia Mono", "JetBrains Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace;
  --fg: #1b1b1b;
  --fg-dim: #5f5f5f;
  --bg: #ffffff;
  --bg-alt: #f2f2f2;
  --border: #cfcfcf;
  --accent: #0a5a9c;
  --max: 74ch;
}

@media (prefers-color-scheme: dark) {
  :root {
    --fg: #e6e6e6;
    --fg-dim: #9a9a9a;
    --bg: #0f0f0f;
    --bg-alt: #1c1c1c;
    --border: #383838;
    --accent: #66b0ee;
  }
}

* { box-sizing: border-box; }

html { background: var(--bg); color: var(--fg); }

body {
  margin: 0 auto;
  padding: 0.75rem 1rem 3rem;
  max-width: var(--max);
  font-family: var(--font);
  font-size: 15px;
  line-height: 1.5;
  word-wrap: break-word;
}

a { color: var(--accent); text-underline-offset: 2px; }
a:visited { color: var(--accent); }
h1 a, h2 a, .brand { color: var(--fg); }

.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  position: static;
}

.site-header {
  border-bottom: 2px solid var(--fg);
  margin-bottom: 1rem;
}
.site-header nav {
  display: flex;
  gap: 1.25rem;
  flex-wrap: wrap;
  align-items: baseline;
  padding: 0.4rem 0;
}
.brand { font-weight: 700; text-decoration: none; }
.crumb { color: var(--fg-dim); }
.crumb-domain { font-weight: 700; }
.site-header nav > a[aria-current="page"] {
  font-weight: 700;
  text-decoration: none;
  border-bottom: 2px solid var(--fg);
}

main h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
main h2 {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fg-dim);
  margin: 1.5rem 0 0.5rem;
}
.page-desc { color: var(--fg-dim); margin-top: 0; }
.empty, .warning, .hint { color: var(--fg-dim); font-style: italic; }
.warning { font-style: normal; }
.dim { color: var(--fg-dim); }

.status {
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--border);
}
.status-highlight {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  padding: 0.75rem;
}
.status-header {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 4px;
  border: 1px solid var(--border);
  flex: none;
}
.avatar-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  background: var(--bg-alt);
}
.author { text-decoration: none; }
.author .name { font-weight: 700; }
.author .acct, .permalink, .status-meta, .context-line { color: var(--fg-dim); }
.permalink { text-decoration: none; margin-left: auto; white-space: nowrap; }
.permalink:hover { text-decoration: underline; }
.badge {
  font-size: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 0 0.3rem;
  color: var(--fg-dim);
}
.context-line { margin: 0 0 0.25rem; font-size: 0.85rem; }
.status-meta { margin: 0.4rem 0 0; font-size: 0.85rem; }

.content p { margin: 0.4rem 0; }
.content blockquote {
  border-left: 3px solid var(--border);
  margin: 0.5rem 0;
  padding: 0 0 0 0.75rem;
  color: var(--fg-dim);
}
.content pre {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  padding: 0.5rem;
  overflow-x: auto;
}
.content ul, .content ol { margin: 0.4rem 0; padding-left: 1.5rem; }

details.cw {
  border: 1px solid var(--border);
  background: var(--bg-alt);
  padding: 0.4rem 0.6rem;
  margin: 0.4rem 0;
}
details.cw summary { cursor: pointer; font-weight: 700; }
.cw-hint { font-weight: 400; color: var(--fg-dim); font-size: 0.8rem; }

.media { margin: 0.5rem 0; }
.media img { max-width: 100%; height: auto; border: 1px solid var(--border); }
.media figcaption, .media-link { color: var(--fg-dim); font-size: 0.85rem; }

.poll ul { list-style: none; padding: 0; margin: 0.4rem 0; }
.poll li { margin: 0.25rem 0; }
.poll-bar { display: inline-flex; gap: 0.5rem; align-items: center; min-width: 12rem; }
progress { width: 8rem; height: 1rem; accent-color: var(--fg); }
.poll-pct { min-width: 3ch; text-align: right; font-weight: 700; }
.poll-meta { color: var(--fg-dim); font-size: 0.85rem; }

.link-card {
  border: 1px solid var(--border);
  padding: 0.4rem 0.6rem;
  margin: 0.5rem 0;
}
.link-card img { max-width: 100%; max-height: 12rem; }
.link-card-title { margin: 0; font-weight: 700; }
.link-card-desc { margin: 0.25rem 0; color: var(--fg-dim); font-size: 0.9rem; }

.pagination {
  margin: 1rem 0;
  border: 2px solid var(--fg);
  text-align: center;
}
.pagination a {
  display: block;
  padding: 0.5rem;
  font-weight: 700;
  text-decoration: none;
}
.pagination a:hover { background: var(--bg-alt); }

.profile { border-bottom: 2px solid var(--fg); padding-bottom: 1rem; margin-bottom: 1rem; }
.profile h1 { margin-bottom: 0; }
.profile .acct { color: var(--fg-dim); margin: 0 0 0.5rem; }
.stats { display: flex; gap: 1.5rem; flex-wrap: wrap; margin: 0.75rem 0; }
.stats div { display: flex; gap: 0.4rem; }
.stats dt { color: var(--fg-dim); }
.stats dd { margin: 0; font-weight: 700; }
.fields { border: 1px solid var(--border); margin: 0.75rem 0; }
.fields > div { display: grid; grid-template-columns: minmax(10ch, 22ch) 1fr; border-bottom: 1px solid var(--border); }
.fields > div:last-child { border-bottom: none; }
.fields dt { padding: 0.3rem 0.5rem; color: var(--fg-dim); border-right: 1px solid var(--border); overflow-wrap: anywhere; }
.fields dd { padding: 0.3rem 0.5rem; margin: 0; overflow-wrap: anywhere; }
.profile-meta { color: var(--fg-dim); font-size: 0.85rem; }

.tabs { display: flex; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
.tabs a[aria-current="page"] { font-weight: 700; text-decoration: none; border-bottom: 2px solid var(--fg); }

.account-list { list-style: none; padding: 0; }
.account-list li { padding: 0.35rem 0; border-bottom: 1px solid var(--border); display: flex; gap: 0.5rem; align-items: center; }
.account-list .avatar { width: 24px; height: 24px; }
.tag-list { padding-left: 1.25rem; }
.tag-list li { margin: 0.2rem 0; }

.instance-links { display: flex; gap: 1.25rem; flex-wrap: wrap; margin: 1rem 0; border: 1px solid var(--border); padding: 0.5rem 0.75rem; }

.search-form {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
  margin: 1rem 0;
}
.search-form label { font-weight: 700; }
input[type="text"], input[type="search"] {
  font: inherit;
  flex: 1 1 16ch;
  min-width: 0;
  padding: 0.3rem 0.5rem;
  border: 1px solid var(--fg);
  background: var(--bg);
  color: var(--fg);
}
button {
  font: inherit;
  font-weight: 700;
  padding: 0.3rem 0.9rem;
  border: 1px solid var(--fg);
  background: var(--bg);
  color: var(--fg);
  cursor: pointer;
}
button:hover { background: var(--bg-alt); }

.error { border: 2px solid var(--fg); padding: 1rem; margin: 2rem 0; }
.thread-title { color: var(--fg-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.06em; }

.emoji { height: 1em; width: 1em; vertical-align: -0.15em; }

.site-footer {
  margin-top: 2.5rem;
  border-top: 1px solid var(--border);
  color: var(--fg-dim);
  font-size: 0.8rem;
}

:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }

@media (max-width: 480px) {
  body { font-size: 14px; padding: 0.5rem 0.75rem 2rem; }
  .permalink { margin-left: 0; }
}
`
