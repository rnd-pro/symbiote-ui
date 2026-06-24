import fs from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const dist = new URL('catalog/dist/', root);
const jsDir = new URL('js/', dist);

const assets = [
  { from: new URL('icons/material-symbols.css', root), to: new URL('material-symbols.css', jsDir) },
  { from: new URL('icons/material-symbols-outlined-400.ttf', root), to: new URL('material-symbols-outlined-400.ttf', jsDir) },
  { from: new URL('custom-elements.json', root), to: new URL('custom-elements.json', dist) },
  { from: new URL('canvas/ForceWorker.js', root), to: new URL('ForceWorker.js', jsDir) },
];

for (const { from } of assets) {
  await fs.access(from);
}

await fs.mkdir(jsDir, { recursive: true });

for (const { from, to } of assets) {
  await fs.cp(from, to);
}
