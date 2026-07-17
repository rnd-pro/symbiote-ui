import {
  getSiteRoute,
  PRIMARY_NAV_ROUTES,
  withSiteBasePath,
} from './routes.js';

const basePath = process.env.PAGES_BASE_PATH || '/';
const homeHref = withSiteBasePath(basePath, getSiteRoute('home'));
const docsHref = withSiteBasePath(basePath, getSiteRoute('docs'));
const catalogHref = withSiteBasePath(basePath, getSiteRoute('catalog'));
const primaryNavigation = PRIMARY_NAV_ROUTES.map((route) => (
  `<a href="${withSiteBasePath(basePath, route)}">${route.navLabel}</a>`
)).join('\n');

export default /*html*/ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Symbiote UI: Agent-Ready Workspace UI Library. Lightweight Web Components and layouts for dynamic interface composition.">
<title>Symbiote UI — Agent-Ready Workspace UI Library</title>
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
  --max-width: 1100px;
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
  line-height: 1.5;
  transition: background 0.3s, color 0.3s;
}

/* Skip link */
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

/* Focus outline */
a:focus-visible, button:focus-visible {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

header {
  border-bottom: 1px solid var(--border);
  background: var(--surface-raised);
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
  transition: color 0.2s;
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

main {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 48px 24px;
}

.hero {
  text-align: center;
  margin-bottom: 64px;
}

.hero h1 {
  font-size: 2.8rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 16px;
  line-height: 1.2;
}

.hero p {
  font-size: 1.25rem;
  color: var(--text-dim);
  max-width: 700px;
  margin: 0 auto 32px;
}

.cta-group {
  display: flex;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius);
  font-weight: 600;
  text-decoration: none;
  font-size: 1rem;
  transition: transform 0.2s, background-color 0.2s;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-primary:hover {
  background: color-mix(in srgb, var(--accent) 90%, black);
}

.btn-secondary {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--border);
}

/* Narrative Pipeline Illustration */
.pipeline-section {
  margin-top: 64px;
  padding: 32px;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.pipeline-section h2 {
  text-align: center;
  font-size: 1.75rem;
  margin-top: 0;
  margin-bottom: 12px;
}

.pipeline-section .subtitle {
  text-align: center;
  color: var(--text-dim);
  margin-bottom: 48px;
}

.pipeline-flow {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

@media (min-width: 768px) {
  .pipeline-flow {
    flex-direction: row;
    align-items: stretch;
    justify-content: space-between;
  }
}

.pipeline-step {
  flex: 1;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.step-num {
  font-weight: 800;
  font-size: 1.5rem;
  color: var(--accent);
  margin-bottom: 8px;
}

.step-title {
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 8px;
}

.step-desc {
  font-size: 0.9rem;
  color: var(--text-dim);
  margin: 0;
}

/* Animations for pipeline */
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

@media (prefers-reduced-motion: no-preference) {
  .motion-ready .pipeline-step {
    opacity: 0;
    transform: translateY(20px);
  }

  .motion-ready .pipeline-step:nth-child(1) {
    animation: revealStep 0.5s ease forwards;
  }
  .motion-ready .pipeline-step:nth-child(2) {
    animation: revealStep 0.5s ease forwards 0.8s;
  }
  .motion-ready .pipeline-step:nth-child(3) {
    animation: revealStep 0.5s ease forwards 1.6s;
  }
  .motion-ready .pipeline-step:nth-child(4) {
    animation: revealStep 0.5s ease forwards 2.4s;
  }
  .motion-ready .pipeline-step:nth-child(5) {
    animation: revealStep 0.5s ease forwards 3.2s;
  }
}

@keyframes revealStep {
  to {
    opacity: 1;
    transform: translateY(0);
    border-color: var(--accent);
    box-shadow: 0 0 12px var(--accent-light);
  }
}

footer {
  margin-top: 64px;
  border-top: 1px solid var(--border);
  padding: 32px 24px;
  text-align: center;
  color: var(--text-dim);
  font-size: 0.9rem;
}

footer a {
  color: var(--accent);
  text-decoration: none;
}
</style>
</head>
<body>
<a href="#main-content" class="sn-skip-link">Skip to main content</a>

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

<main id="main-content">
  <section class="hero">
    <h1>Custom Workspaces Built by Agents</h1>
    <p>Symbiote UI is a lightweight library of Web Components and layouts specifically engineered for AI agents to discover, compose, and style interfaces dynamically.</p>
    <div class="cta-group">
      <a href="${docsHref}" class="btn btn-primary">Read Guides</a>
      <a href="${catalogHref}" class="btn btn-secondary">Explore Components</a>
    </div>
  </section>

  <section class="pipeline-section" aria-labelledby="pipeline-heading">
    <h2 id="pipeline-heading">The Agent Construction Narrative</h2>
    <p class="subtitle">How agents dynamically compose fully functional interfaces at runtime</p>

    <div class="pipeline-flow">
      <article class="pipeline-step">
        <div class="step-num">01</div>
        <h3 class="step-title">Agent Intent</h3>
        <p class="step-desc">The agent defines the workflow goals and determines which layout parts and widgets are needed.</p>
      </article>

      <article class="pipeline-step">
        <div class="step-num">02</div>
        <h3 class="step-title">Manifest Discovery</h3>
        <p class="step-desc">The agent queries components, custom elements definitions, and WebMCP capability schemas.</p>
      </article>

      <article class="pipeline-step">
        <div class="step-num">03</div>
        <h3 class="step-title">Component Composition</h3>
        <p class="step-desc">The agent structures layout slots and binds component state using standard DOM custom elements.</p>
      </article>

      <article class="pipeline-step">
        <div class="step-num">04</div>
        <h3 class="step-title">Cascade/Theme Adaptation</h3>
        <p class="step-desc">Dynamic token overrides apply to the layout scope, shifting density and OKLCH colors instantly.</p>
      </article>

      <article class="pipeline-step">
        <div class="step-num">05</div>
        <h3 class="step-title">Usable Workspace</h3>
        <p class="step-desc">The completed application layout is served to the user: fully interactive, accessible, and live.</p>
      </article>
    </div>
  </section>
</main>

<footer>
  <p>&copy; 2026 RND-PRO. Released under the MIT License.</p>
  <p>View the <a href="https://github.com/RND-PRO/symbiote-ui">source code on GitHub</a>.</p>
</footer>

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

// Trigger pipeline reveal animations
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('motion-ready');
});
</script>
</body>
</html>`;
