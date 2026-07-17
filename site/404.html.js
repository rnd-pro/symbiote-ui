import { getSiteRoute, withSiteBasePath } from './routes.js';

const basePath = process.env.PAGES_BASE_PATH || '/';
const homeHref = withSiteBasePath(basePath, getSiteRoute('home'));

export default /*html*/ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>404 Page Not Found — Symbiote UI</title>
<style>
:root {
  --bg: #fcfcfc;
  --text: #1a1a1a;
  --text-dim: #555555;
  --surface: #f0f0f0;
  --surface-raised: #ffffff;
  --accent: #2563eb;
  --border: #e2e8f0;
  --font: Inter, system-ui, -apple-system, sans-serif;
  --radius: 8px;
}

[data-theme="dark"] {
  --bg: #0b0f19;
  --text: #f1f5f9;
  --text-dim: #94a3b8;
  --surface: #1e293b;
  --surface-raised: #0f172a;
  --accent: #3b82f6;
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
  height: 100%;
  display: flex;
  flex-direction: column;
}

header {
  border-bottom: 1px solid var(--border);
  background: var(--surface-raised);
}

.header-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 24px;
  width: 100%;
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

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

h1 {
  font-size: 4rem;
  font-weight: 800;
  margin: 0;
  color: var(--accent);
}

p {
  font-size: 1.25rem;
  color: var(--text-dim);
  max-width: 500px;
  margin: 16px 0 32px;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  border-radius: var(--radius);
  font-weight: 600;
  text-decoration: none;
  font-size: 1rem;
  background: var(--accent);
  color: white;
  transition: background-color 0.2s;
}

.btn:hover {
  background: color-mix(in srgb, var(--accent) 90%, black);
}

footer {
  border-top: 1px solid var(--border);
  padding: 24px;
  text-align: center;
  color: var(--text-dim);
  font-size: 0.9rem;
}
</style>
</head>
<body>
<header>
  <div class="header-container">
    <a href="${homeHref}" class="logo-group">
      <div class="logo-icon">S</div>
      <span>Symbiote UI</span>
    </a>
  </div>
</header>

<main>
  <h1>404</h1>
  <p>The page you are looking for does not exist or has been moved.</p>
  <a href="${homeHref}" class="btn">Go Back Home</a>
</main>

<footer>
  <p>&copy; 2026 RND-PRO.</p>
</footer>

<script>
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const storedTheme = localStorage.getItem('theme');
if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
  document.documentElement.setAttribute('data-theme', 'dark');
  document.documentElement.style.colorScheme = 'dark';
}
</script>
</body>
</html>`;
