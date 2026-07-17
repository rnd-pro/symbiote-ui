import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DOCS_NAV_ROUTES,
  normalizeSiteBasePath,
  NOT_FOUND_ROUTE,
  PRIMARY_NAV_ROUTES,
  SITE_ROUTES,
  withSiteBasePath,
} from '../site/routes.js';

const siteDir = path.resolve('_site');

function listHtmlFiles(dir) {
  let files = [];
  for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
    let entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') files.push(...listHtmlFiles(entryPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) files.push(entryPath);
  }
  return files;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routeUrl(baseUrl, route) {
  return new URL(route.path.replace(/^\/+/, ''), baseUrl).href;
}

console.log('Validating site at', siteDir);

let manifestPath = path.join(siteDir, 'route-manifest.json');
let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let expectedRoutes = SITE_ROUTES.map(({ file, path: routePath }) => ({
  file,
  path: routePath,
}));
let expectedHtmlFiles = [
  ...SITE_ROUTES.map((route) => route.file),
  NOT_FOUND_ROUTE.file,
].sort();
let actualHtmlFiles = listHtmlFiles(siteDir)
  .map((file) => path.relative(siteDir, file).split(path.sep).join('/'))
  .sort();

assert.deepEqual(manifest.routes, expectedRoutes, 'route manifest must match site/routes.js');
assert.deepEqual(actualHtmlFiles, expectedHtmlFiles, 'generated HTML must match site/routes.js');
assert.equal(
  manifest.basePath,
  normalizeSiteBasePath(process.env.PAGES_BASE_PATH || '/'),
  'route manifest must record the configured Pages base path'
);
assert.equal(
  SITE_ROUTES.some((route) => route.file === NOT_FOUND_ROUTE.file),
  false,
  '404 must stay outside the published route contract'
);

let sitemap = fs.readFileSync(path.join(siteDir, 'sitemap.xml'), 'utf8');
let sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
let expectedSitemapUrls = SITE_ROUTES.map((route) => routeUrl(manifest.baseUrl, route));
assert.deepEqual(sitemapUrls, expectedSitemapUrls, 'sitemap must match the canonical routes');
assert.doesNotMatch(sitemap, /404\.html/, '404 must not appear in the sitemap');

let robots = fs.readFileSync(path.join(siteDir, 'robots.txt'), 'utf8');
assert.match(
  robots,
  new RegExp(`Sitemap: ${escapeRegExp(new URL('sitemap.xml', manifest.baseUrl).href)}`),
  'robots.txt must reference this Pages deployment sitemap'
);

let shellRoutes = [SITE_ROUTES[0], ...SITE_ROUTES.filter((route) => route.file.startsWith('docs/'))];
for (let shellRoute of shellRoutes) {
  let content = fs.readFileSync(path.join(siteDir, shellRoute.file), 'utf8');
  for (let navRoute of PRIMARY_NAV_ROUTES) {
    let href = withSiteBasePath(manifest.basePath, navRoute);
    assert.match(
      content,
      new RegExp(`href="${escapeRegExp(href)}"`),
      `${shellRoute.file} must link to ${navRoute.id} through the configured base path`
    );
  }

  for (let match of content.matchAll(/(?:href|src)="(\/[^"#]*)"/g)) {
    assert.ok(
      manifest.basePath === '/' || match[1].startsWith(manifest.basePath),
      `${shellRoute.file} contains a root URL outside ${manifest.basePath}: ${match[1]}`
    );
  }

  assert.match(content, /aria-label="Switch to dark theme"/);
  assert.match(content, /Switch to light theme/);
  assert.match(
    content,
    /@media \(max-width: 768px\)[\s\S]*?\.header-container\s*\{[\s\S]*?flex-direction: column;/,
    `${shellRoute.file} must stack its header at tablet widths`
  );
}

let docsIndex = fs.readFileSync(path.join(siteDir, 'docs/index.html'), 'utf8');
for (let docsRoute of DOCS_NAV_ROUTES) {
  let href = withSiteBasePath(manifest.basePath, docsRoute);
  assert.match(docsIndex, new RegExp(`href="${escapeRegExp(href)}"`));
}
assert.doesNotMatch(docsIndex, /Showcase Demo Structure/);

let syntheticBasePath = '/owner/library/';
for (let route of SITE_ROUTES) {
  let expectedHref = route.path === '/'
    ? syntheticBasePath
    : `${syntheticBasePath}${route.path.replace(/^\/+/, '')}`;
  assert.equal(
    withSiteBasePath(syntheticBasePath, route),
    expectedHref,
    `synthetic Pages base path must preserve ${route.id}`
  );
}

console.log('Site validation passed.');
