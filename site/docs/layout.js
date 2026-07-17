import { md } from 'jsda-kit/node/md.js';
import fs from 'fs';
import path from 'path';
import {
  DOCS_NAV_ROUTES,
  getSiteRoute,
  PRIMARY_NAV_ROUTES,
  withSiteBasePath,
} from '../routes.js';

const basePath = process.env.PAGES_BASE_PATH || '/';
const homeHref = withSiteBasePath(basePath, getSiteRoute('home'));
const primaryNavigation = PRIMARY_NAV_ROUTES.map((route) => (
  `<a href="${withSiteBasePath(basePath, route)}">${route.navLabel}</a>`
)).join('\n');

export async function renderDocsPage(currentFile) {
  const currentDoc = DOCS_NAV_ROUTES.find((doc) => doc.markdown === currentFile)
    || DOCS_NAV_ROUTES[0];
  const markdownPath = path.resolve(process.cwd(), 'docs', currentDoc.markdown);
  const contentHtml = await md(markdownPath);

  const sidebarLinks = DOCS_NAV_ROUTES.map((doc) => {
    const active = doc.markdown === currentFile ? 'active' : '';
    const href = withSiteBasePath(basePath, doc);
    return `<li><a href="${href}" class="${active}">${doc.title}</a></li>`;
  }).join('\n');

  return /*html*/ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${currentDoc.title} - Symbiote UI documentation and guides.">
<title>${currentDoc.title} — Symbiote UI Docs</title>
<style>
:root {
  --bg: #fcfcfc;
  --text: #1a1a1a;
  --text-dim: #555555;
  --surface: #f0f0f0;
  --surface-raised: #ffffff;
  --accent: #2563eb;
  --accent-light: #eff6ff;
  --border: #e2e8f0;
  --font: Inter, system-ui, -apple-system, sans-serif;
  --radius: 8px;
  --max-width: 1200px;
}

[data-theme="dark"] {
  --bg: #0b0f19;
  --text: #f1f5f9;
  --text-dim: #94a3b8;
  --surface: #1e293b;
  --surface-raised: #0f172a;
  --accent: #3b82f6;
  --accent-light: #172554;
  --border: #334155;
}

* {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
  height: 100%;
}

.sn-skip-link {
  position: absolute;
  top: -100px;
  left: 10px;
  background: var(--accent);
  color: #ffffff;
  padding: 8px 16px;
  z-index: 10000;
  border-radius: var(--radius);
  text-decoration: none;
  font-weight: bold;
}
.sn-skip-link:focus {
  top: 10px;
}

a:focus-visible, button:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

header {
  border-bottom: 1px solid var(--border);
  background: var(--surface-raised);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 16px 24px;
}

.logo-group {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: bold;
  font-size: 1.2rem;
  color: var(--text);
  text-decoration: none;
}

.logo-icon {
  background: var(--accent);
  color: white;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-weight: 800;
}

nav {
  display: flex;
  align-items: center;
  gap: 20px;
}

nav a {
  color: var(--text-dim);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
}

nav a:hover {
  color: var(--accent);
}

.theme-btn {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 6px 12px;
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  gap: 6px;
}

.theme-btn:hover {
  background: var(--border);
}

.docs-wrapper {
  max-width: var(--max-width);
  margin: 0 auto;
  display: flex;
  min-height: calc(100vh - 69px);
}

.sidebar {
  width: 280px;
  flex-shrink: 0;
  border-right: 1px solid var(--border);
  padding: 32px 24px;
  overflow-y: auto;
  position: sticky;
  top: 69px;
  height: calc(100vh - 69px);
}

.sidebar ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sidebar li {
  margin-bottom: 8px;
}

.sidebar a {
  display: block;
  padding: 8px 12px;
  color: var(--text-dim);
  text-decoration: none;
  border-radius: var(--radius);
  font-size: 0.95rem;
  font-weight: 500;
  transition: background 0.2s, color 0.2s;
}

.sidebar a:hover {
  background: var(--surface);
  color: var(--text);
}

.sidebar a.active {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}

.content-pane {
  flex-grow: 1;
  padding: 32px 48px;
  min-width: 0;
}

/* Markdown formatting */
.content-body h1 {
  font-size: 2.25rem;
  font-weight: 800;
  margin-top: 0;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
}

.content-body h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin-top: 36px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.content-body h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-top: 24px;
  margin-bottom: 12px;
}

.content-body p {
  margin-top: 0;
  margin-bottom: 16px;
  color: var(--text);
}

.content-body code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.9em;
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 4px;
}

.content-body pre {
  background: var(--surface);
  padding: 16px;
  border-radius: var(--radius);
  overflow-x: auto;
  border: 1px solid var(--border);
  margin-bottom: 24px;
}

.content-body pre code {
  background: none;
  padding: 0;
  font-size: 0.9em;
  color: inherit;
}

.content-body ul, .content-body ol {
  margin-top: 0;
  margin-bottom: 16px;
  padding-left: 24px;
}

.content-body li {
  margin-bottom: 8px;
}

.content-body blockquote {
  margin: 0 0 24px;
  padding: 12px 24px;
  border-left: 4px solid var(--accent);
  background: var(--surface);
  color: var(--text-dim);
  border-radius: 0 var(--radius) var(--radius) 0;
}

.content-body table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
}

.content-body th, .content-body td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.content-body th {
  font-weight: 600;
  background: var(--surface);
}

/* highlight.js code styling (inline light/dark theme) */
pre code {
  color: var(--text);
}
.hljs-comment { color: #8e908c; font-style: italic; }
.hljs-keyword, .hljs-selector-tag { color: #8959a8; font-weight: bold; }
.hljs-string, .hljs-value, .hljs-inheritance, .hljs-header { color: #718c00; }
.hljs-number, .hljs-symbol { color: #f5871f; }
.hljs-title, .hljs-section { color: #4271ae; font-weight: bold; }
.hljs-variable, .hljs-template-variable { color: #3e999f; }
.hljs-params { color: #f5871f; }

[data-theme="dark"] .hljs-comment { color: #94a3b8; }
[data-theme="dark"] .hljs-keyword, [data-theme="dark"] .hljs-selector-tag { color: #c084fc; }
[data-theme="dark"] .hljs-string, [data-theme="dark"] .hljs-value { color: #4ade80; }
[data-theme="dark"] .hljs-number, [data-theme="dark"] .hljs-symbol { color: #fb923c; }
[data-theme="dark"] .hljs-title, [data-theme="dark"] .hljs-section { color: #60a5fa; }
[data-theme="dark"] .hljs-variable { color: #2dd4bf; }

/* Responsive styling */
@media (max-width: 768px) {
  .header-container {
    flex-direction: column;
    gap: 16px;
    padding: 16px;
  }
  nav {
    flex-wrap: wrap;
    justify-content: center;
  }
}
@media (max-width: 768px) {
  .docs-wrapper {
    flex-direction: column;
  }
  .sidebar {
    width: 100%;
    height: auto;
    position: static;
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 16px 24px;
  }
  .content-pane {
    padding: 24px;
  }
}
</style>
</head>
<body>
<a href="#docs-content" class="sn-skip-link">Skip to main content</a>

<header>
  <div class="header-container">
    <a href="${homeHref}" class="logo-group">
      <div class="logo-icon">S</div>
      <span>Symbiote UI</span>
    </a>
    <nav aria-label="Primary Navigation">
      ${primaryNavigation}
      <button id="theme-toggle" class="theme-btn" aria-label="Switch to dark theme">
        <span class="theme-icon" aria-hidden="true">☾</span>
        <span class="theme-label">Dark Theme</span>
      </button>
    </nav>
  </div>
</header>

<div class="docs-wrapper">
  <nav class="sidebar" aria-label="Documentation Navigation">
    <ul>
      ${sidebarLinks}
    </ul>
  </nav>

  <main class="content-pane" id="docs-content">
    <article class="content-body">
      ${contentHtml}
    </article>
  </main>
</div>

<script>
// Theme switching
const themeToggle = document.getElementById('theme-toggle');
const root = document.documentElement;
const themeIcon = themeToggle.querySelector('.theme-icon');
const themeLabel = themeToggle.querySelector('.theme-label');

function setTheme(dark) {
  if (dark) {
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    localStorage.setItem('theme', 'dark');
    themeToggle.setAttribute('aria-label', 'Switch to light theme');
    themeIcon.textContent = '☀';
    themeLabel.textContent = 'Light Theme';
  } else {
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    localStorage.setItem('theme', 'light');
    themeToggle.setAttribute('aria-label', 'Switch to dark theme');
    themeIcon.textContent = '☾';
    themeLabel.textContent = 'Dark Theme';
  }
}

const storedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
setTheme(storedTheme === 'dark' || (!storedTheme && prefersDark));

themeToggle.addEventListener('click', () => {
  const isDark = root.getAttribute('data-theme') === 'dark';
  setTheme(!isDark);
});
</script>
</body>
</html>`;
}
