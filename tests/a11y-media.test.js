import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(__dirname, '../themes/default-provider.css');

test('default-provider.css includes prefers-contrast and forced-colors media queries', () => {
  const content = readFileSync(cssPath, 'utf8');
  
  assert.ok(content.includes('@media (prefers-contrast: more)'), 'Should contain prefers-contrast media query');
  assert.ok(content.includes('--sn-theme-outline-strength: 0.90'), 'Should contain high contrast outline override');
  assert.ok(content.includes('--sn-text-dim: var(--sn-text)'), 'Should override text-dim for high contrast readability');
  
  assert.ok(content.includes('@media (forced-colors: active)'), 'Should contain forced-colors media query');
  assert.ok(content.includes('--sn-bg: Canvas'), 'Should map --sn-bg to Canvas in forced-colors mode');
  assert.ok(content.includes('--sn-text: CanvasText'), 'Should map --sn-text to CanvasText in forced-colors mode');
});
