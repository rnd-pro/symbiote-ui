import { getSiteRoute, withSiteBasePath } from './routes.js';

const basePath = process.env.PAGES_BASE_PATH || '/';
const homeHref = withSiteBasePath(basePath, getSiteRoute('home'));
const docsHref = withSiteBasePath(basePath, getSiteRoute('docs'));
const catalogHref = withSiteBasePath(basePath, getSiteRoute('catalog'));
const demosHref = withSiteBasePath(basePath, getSiteRoute('demos'));

export default /*html*/ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="${basePath}">
<title>Symbiote UI — Agent-ready UI construction</title>
<meta name="description" content="Agent-ready Web Components, layouts, themes, manifests, and UI contracts for Symbiote systems.">
<style>
:root {
  color-scheme: light;
  --page: #fff;
  --surface: #f7f7f8;
  --surface-soft: #f0f1f4;
  --ink: #3d3d45;
  --muted: #68686e;
  --line: #e3e3e5;
  --line-strong: #a6a6ad;
  --brand: #4058bd;
  --brand-soft: #eef1ff;
  --mint: #1c7a65;
  --danger: #c75454;
  --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #1c1d22;
  --surface: #222329;
  --surface-soft: #2a2b33;
  --ink: #e0e0d8;
  --muted: #a1a1a9;
  --line: #303137;
  --line-strong: #555762;
  --brand: #8192ff;
  --brand-soft: #25283d;
  --mint: #33ccaa;
  --danger: #ff8c9c;
}
*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; background: var(--page); color: var(--ink); font-family: var(--sans); line-height: 1.6; text-rendering: optimizeLegibility; }
a { color: inherit; text-underline-offset: .18em; }
button, kbd { font: inherit; }
:focus-visible { outline: 2px solid var(--brand); outline-offset: 3px; }
.skip-link { position: fixed; left: 1rem; top: .5rem; transform: translateY(-180%); z-index: 2; padding: .65rem .9rem; border-radius: .6rem; background: var(--ink); color: var(--page); }
.skip-link:focus { transform: translateY(0); }
.site-header { position: sticky; top: 0; z-index: 10; height: 64px; border-bottom: 1px solid var(--line); background: var(--page); }
.header-inner { width: min(1216px, calc(100% - 4rem)); height: 64px; margin: 0 auto; display: flex; align-items: center; gap: 1.4rem; }
.brand { display: inline-flex; align-items: center; gap: .5rem; color: var(--ink); font-size: 1.05rem; font-weight: 650; text-decoration: none; white-space: nowrap; }
.brand-mark { width: 24px; height: 24px; color: var(--brand); }
.header-search { display: inline-flex; align-items: center; gap: .55rem; min-width: 8.8rem; height: 40px; margin-right: auto; padding: 0 .8rem; border-radius: .8rem; background: var(--surface-soft); color: var(--muted); text-decoration: none; }
.header-search:hover { color: var(--ink); }
.header-search-icon { width: 18px; height: 18px; flex: 0 0 auto; }
.header-search-label { font-size: .95rem; }
.header-search kbd { margin-left: auto; padding: .08rem .38rem; border: 1px solid var(--line); border-radius: .38rem; background: var(--page); color: var(--muted); font-size: .72rem; line-height: 1.35; }
.site-nav { display: flex; align-items: center; gap: 1.5rem; }
.site-nav a { color: var(--muted); font-weight: 560; text-decoration: none; }
.site-nav a:hover { color: var(--ink); }
.icon-button { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 0; background: transparent; color: var(--muted); cursor: pointer; }
.icon-button:hover { color: var(--ink); }
.theme-button { width: 40px; height: 24px; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--surface-soft); font-size: .78rem; }
.header-divider { width: 1px; height: 24px; background: var(--line); }
.github-mark { width: 22px; height: 22px; }
.content { width: min(1152px, calc(100% - 2rem)); margin: 0 auto; }
.hero { min-height: 628px; padding-top: 80px; }
.hero h1 { max-width: 650px; margin: 0; font-size: clamp(3.25rem, 5vw, 4.25rem); line-height: 1.08; letter-spacing: -.045em; }
.hero h1 strong { display: block; color: var(--brand); font-weight: 750; }
.hero h1 span { display: block; }
.hero-lead { max-width: 570px; margin: 24px 0 0; color: var(--muted); font-size: 1.3rem; line-height: 1.5; }
.actions { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 40px; }
.button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 24px; border: 1px solid transparent; border-radius: 999px; font-weight: 650; text-decoration: none; }
.button--primary { background: var(--brand); color: var(--page); }
.button--secondary { background: var(--surface-soft); color: var(--ink); }
.how-it-works { padding: 24px 0 80px; }
.story-intro { max-width: 760px; margin: 0 auto 84px; text-align: center; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 34px; padding: 4px 12px; border: 1px solid var(--brand); border-radius: 999px; color: var(--brand); background: var(--brand-soft); font-family: var(--mono); font-size: .78rem; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
.eyebrow-icon { width: 14px; height: 14px; }
.story-intro h2 { margin: 0; font-size: clamp(2rem, 4vw, 2.5rem); line-height: 1.15; letter-spacing: -.03em; }
.story-intro p { margin: 18px auto 0; max-width: 700px; color: var(--muted); font-size: 1.08rem; }
.chapter { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, 1.1fr); gap: clamp(2rem, 6vw, 5rem); align-items: center; min-height: 420px; margin-bottom: 88px; }
.chapter:nth-of-type(even) .chapter-copy { order: 2; }
.chapter:nth-of-type(even) .motion-surface { order: 1; }
.chapter-label { display: inline-flex; align-items: center; gap: 10px; margin-bottom: 20px; color: var(--brand); font-family: var(--mono); font-size: .9rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.chapter-label b { color: var(--line-strong); }
.chapter h3 { max-width: 520px; margin: 0 0 18px; font-size: clamp(1.7rem, 3vw, 2.35rem); line-height: 1.12; letter-spacing: -.035em; }
.chapter p { max-width: 520px; margin: 0; color: var(--muted); font-size: 1.05rem; }
.motion-surface { min-height: 280px; padding: 24px 0; background: transparent; overflow: hidden; }
.motion-surface svg { display: block; width: 100%; height: auto; }
.motion-surface .line { fill: none; stroke: var(--line-strong); stroke-width: 2; }
.motion-surface .brand-stroke { fill: none; stroke: var(--brand); stroke-width: 2; }
.motion-surface .mint-stroke { fill: none; stroke: var(--mint); stroke-width: 2; }
.motion-surface .ink-fill { fill: var(--ink); }
.motion-surface [data-motion="dash"] { stroke-dasharray: 5 7; animation: dash-flow 3.2s linear infinite; }
.motion-surface [data-motion="pulse"] { transform-box: fill-box; transform-origin: center; animation: node-pulse 2.8s ease-in-out infinite; }
.motion-surface [data-motion="float"] { animation: key-float 3.8s ease-in-out infinite; }
.closing { padding: 24px 0 96px; text-align: center; }
.closing h2 { margin: 0; font-size: clamp(2rem, 4vw, 3rem); letter-spacing: -.04em; }
.closing .actions { justify-content: center; margin-top: 28px; }
.footer { padding: 32px 0; border-top: 1px solid var(--line); color: var(--muted); font-size: .9rem; }
.footer-inner { width: min(1152px, calc(100% - 2rem)); margin: 0 auto; display: flex; justify-content: space-between; gap: 1.5rem; }
@keyframes dash-flow { to { stroke-dashoffset: -48; } }
@keyframes node-pulse { 0%, 100% { transform: scale(1); opacity: .78; } 50% { transform: scale(1.12); opacity: 1; } }
@keyframes key-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
@media (max-width: 760px) {
  .header-inner { width: min(100% - 1.25rem, 1152px); gap: .6rem; }
  .brand-label { max-width: 9rem; overflow: hidden; text-overflow: ellipsis; }
  .header-search { min-width: 40px; width: 40px; padding: 0; justify-content: center; }
  .header-search-label, .header-search kbd { display: none; }
  .site-nav { gap: .7rem; font-size: .86rem; }
  .header-divider, .github-mark + span { display: none; }
  .content { width: min(100% - 3rem, 1152px); }
  .hero { min-height: auto; padding: 64px 0 96px; }
  .hero h1 { font-size: clamp(2.9rem, 12vw, 4.4rem); }
  .hero-lead { font-size: 1.15rem; }
  .chapter, .chapter:nth-of-type(even) { display: flex; flex-direction: column; align-items: stretch; gap: 28px; margin-bottom: 72px; }
  .chapter:nth-of-type(even) .chapter-copy, .chapter:nth-of-type(even) .motion-surface { order: initial; }
  .motion-surface { min-height: auto; padding: 16px; }
  .footer-inner { flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}
</style>
</head>
<body>
<a class="skip-link" href="#main-content">Skip to content</a>
<header class="site-header">
  <div class="header-inner">
    <a class="brand" href="${homeHref}" aria-label="Symbiote UI home">
      <svg class="brand-mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <circle cx="8" cy="9" r="2.5"/><circle cx="24" cy="9" r="2.5"/><circle cx="16" cy="23" r="2.5"/><path d="m10 10.5 4.2 8.5m7.8-8.5-4.2 8.5"/>
      </svg>
      <span class="brand-label">Symbiote UI</span>
    </a>
    <a class="header-search" href="${docsHref}" aria-label="Open Symbiote UI documentation" title="Open documentation">
      <svg class="header-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
      <span class="header-search-label">Search</span><kbd aria-hidden="true">⌘ K</kbd>
    </a>
    <nav class="site-nav" aria-label="Primary navigation">
      <a href="${docsHref}">Guide</a><a href="${catalogHref}">Catalog</a><a href="${demosHref}">Demo</a>
    </nav>
    <span class="header-divider" aria-hidden="true"></span>
    <a class="icon-button" href="https://github.com/RND-PRO/symbiote-ui" aria-label="Symbiote UI on GitHub" title="GitHub">
      <svg class="github-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.3-1.3-1.6-1.3-1.6-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.4-5.5-6A4.7 4.7 0 0 1 5.8 9c-.1-.3-.6-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.6.2 2.8.1 3.1a4.7 4.7 0 0 1 1.3 3.3c0 4.6-2.8 5.7-5.5 6 .4.3.7 1 .7 2v3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z"/></svg>
    </a>
    <button class="icon-button theme-button" type="button" data-theme-toggle aria-label="Switch color theme" title="Switch color theme">☼</button>
  </div>
</header>
<main id="main-content">
  <div class="content">
    <section class="hero" aria-labelledby="hero-title">
      <h1 id="hero-title"><strong>Symbiote UI</strong><span>Agent-ready interfaces,</span><span>built for the host.</span></h1>
      <p class="hero-lead">Discoverable Web Components, layouts, themes, manifests, and UI contracts for agents that construct professional workspaces.</p>
      <div class="actions"><a class="button button--primary" href="${docsHref}">Start with the guide</a><a class="button button--secondary" href="${catalogHref}">Explore the catalog</a></div>
    </section>
    <section class="how-it-works" aria-labelledby="story-title">
      <div class="story-intro"><span class="eyebrow"><svg class="eyebrow-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="8" cy="4" r="1.5" fill="currentColor"/><path d="M5.2 10.4 6.8 5.6m2.4 0 1.6 4.8"/></svg>How it works</span><h2 id="story-title">One provider contract. Every workspace stays coherent.</h2><p>Agents discover capabilities, compose a host-owned layout, and keep the same visual language from the first component to the last runtime update.</p></div>
      <article class="chapter"><div class="chapter-copy"><div class="chapter-label"><b>01</b> / Discover</div><h3>Start with a manifest, not a random component gallery.</h3><p>Provider metadata describes roles, schemas, actions, theme parts, and WebMCP capabilities before the host chooses a surface.</p></div><div class="motion-surface"><svg viewBox="0 0 560 260" role="img" aria-label="A manifest connects a host to discoverable UI modules"><rect x="44" y="48" width="184" height="150" rx="10" class="line"/><text x="64" y="80" class="ink-fill" font-size="15" font-family="var(--mono)">manifest.json</text><circle cx="94" cy="130" r="18" class="brand-stroke" data-motion="pulse"/><circle cx="166" cy="130" r="18" class="brand-stroke" data-motion="pulse"/><path d="M112 130h36" class="brand-stroke" data-motion="dash"/><path d="M228 123h74" class="mint-stroke" data-motion="dash"/><path d="m296 116 9 7-9 7" class="mint-stroke"/><g data-motion="float"><rect x="316" y="72" width="184" height="116" rx="10" class="line"/><text x="338" y="105" class="ink-fill" font-size="14" font-family="var(--sans)">host workspace</text><rect x="338" y="124" width="52" height="38" rx="6" fill="var(--brand-soft)" stroke="var(--brand)"/><rect x="402" y="124" width="76" height="38" rx="6" fill="var(--surface-soft)" stroke="var(--line-strong)"/></g></svg></div></article>
      <article class="chapter"><div class="chapter-copy"><div class="chapter-label"><b>02</b> / Compose</div><h3>Layouts give an agent a place to put the work.</h3><p>Shells, panels, graphs, boards, editors, chats, and inspector surfaces compose into a workspace while policy remains with the host.</p></div><div class="motion-surface"><svg viewBox="0 0 560 260" role="img" aria-label="Layout surfaces compose into one workspace"><rect x="42" y="42" width="476" height="176" rx="12" class="line"/><rect x="64" y="66" width="104" height="128" rx="8" fill="var(--surface-soft)" stroke="var(--line-strong)"/><rect x="184" y="66" width="200" height="128" rx="8" fill="var(--page)" stroke="var(--brand)"/><rect x="400" y="66" width="96" height="128" rx="8" fill="var(--surface-soft)" stroke="var(--line-strong)"/><path d="M168 130h16m200 0h16" class="brand-stroke" data-motion="dash"/><circle cx="284" cy="130" r="22" class="brand-stroke" data-motion="pulse"/><path d="M274 130h20m-10-10v20" class="brand-stroke"/></svg></div></article>
      <article class="chapter"><div class="chapter-copy"><div class="chapter-label"><b>03</b> / Keep it coherent</div><h3>The cascade theme travels with the workspace.</h3><p>Tokens, rules, and theme helpers keep generated interfaces legible across components, panels, graphs, and embedded demos.</p></div><div class="motion-surface"><svg viewBox="0 0 560 260" role="img" aria-label="A theme token flows across multiple UI surfaces"><path d="M86 130h388" class="mint-stroke" data-motion="dash"/><circle cx="104" cy="130" r="24" class="mint-stroke" data-motion="pulse"/><circle cx="280" cy="130" r="24" class="brand-stroke" data-motion="pulse"/><circle cx="456" cy="130" r="24" class="brand-stroke" data-motion="pulse"/><text x="80" y="88" class="ink-fill" font-size="15" font-family="var(--mono)">tokens</text><text x="247" y="88" class="ink-fill" font-size="15" font-family="var(--sans)">shell</text><text x="420" y="88" class="ink-fill" font-size="15" font-family="var(--sans)">demo</text><path d="M104 154v42m176-42v42m176-42v42" class="line"/><rect x="74" y="196" width="60" height="24" rx="12" fill="var(--brand-soft)" stroke="var(--brand)"/><rect x="250" y="196" width="60" height="24" rx="12" fill="var(--brand-soft)" stroke="var(--brand)"/><rect x="426" y="196" width="60" height="24" rx="12" fill="var(--brand-soft)" stroke="var(--brand)"/></svg></div></article>
    </section>
    <section class="closing" aria-labelledby="closing-title"><h2 id="closing-title">Ready to build a workspace?</h2><div class="actions"><a class="button button--primary" href="${docsHref}">Read the documentation</a><a class="button button--secondary" href="${demosHref}">Run the showcase demo</a></div></section>
  </div>
</main>
<footer class="footer"><div class="footer-inner"><span>Symbiote UI · MIT License</span><a href="${catalogHref}">Component catalog</a></div></footer>
<script>
(() => {
  const root = document.documentElement;
  const button = document.querySelector('[data-theme-toggle]');
  let theme = 'light';
  try { theme = localStorage.getItem('symbiote-ui:landing-theme') || 'light'; } catch {}
  root.dataset.theme = theme;
  button?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('symbiote-ui:landing-theme', root.dataset.theme); } catch {}
  });
})();
</script>
</body>
</html>`;
