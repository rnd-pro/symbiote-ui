import { cp, rm, mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, '_site');

// Top-level entries kept out of the published site. Everything else (the library
// source dirs) ships so the unbundled demos can resolve their relative imports.
const EXCLUDE = new Set([
  '_site', '.git', '.github', '.claude', 'node_modules', 'catalog',
  'tests', 'tmp', 'scratch', 'coverage', 'scripts', 'docs', 'audit.js',
  'project.cfg.js', 'package.json', 'package-lock.json',
  '.gitignore', '.npmignore', '.gitmodules', 'CHANGELOG.md',
]);

// Runtime deps the demos resolve through their `../node_modules` import maps.
const RUNTIME_DEPS = ['@symbiotejs/symbiote', 'symbiote-engine'];

await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (EXCLUDE.has(entry.name)) continue;
  await cp(path.join(root, entry.name), path.join(site, entry.name), { recursive: true });
}

for (const dep of RUNTIME_DEPS) {
  await cp(path.join(root, 'node_modules', dep), path.join(site, 'node_modules', dep), { recursive: true });
}

// Overlay the built catalog at the site root — its index.html becomes the front door.
await cp(path.join(root, 'catalog', 'dist'), site, { recursive: true });

await writeFile(path.join(site, '.nojekyll'), '');

console.log('Assembled _site (catalog at root, demos under /demo/) at', site);
