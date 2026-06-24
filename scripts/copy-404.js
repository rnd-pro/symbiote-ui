import fs from 'node:fs/promises';

const dist = new URL('../catalog/dist/', import.meta.url);
const base = process.env.PAGES_BASE ?? '/symbiote-ui/';

const source = new URL('index.html', dist);
let html = await fs.readFile(source, 'utf8');
html = html.replace(/<base href=[^>]*>/, `<base href="${base}">`);

await fs.writeFile(source, html);
await fs.writeFile(new URL('404.html', dist), html);
