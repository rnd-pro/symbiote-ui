import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const scrollbarSource = new URL('../themes/scrollbar-styles.js', import.meta.url);
const cascadeDemoSource = new URL('../demo/cascade-theme-lab.js', import.meta.url);
const cascadeDemoHtml = new URL('../demo/cascade-theme-lab.html', import.meta.url);

test('theme scrollbar normal state uses the normal thumb token', async () => {
  const source = await readFile(scrollbarSource, 'utf8');

  assert.match(
    source,
    /const SCROLLBAR_COLOR = 'var\(--sn-scrollbar-thumb, currentColor\) var\(--sn-scrollbar-track, transparent\)'/
  );
});

test('cascade theme lab mutates root tokens instead of applying local component themes', async () => {
  const source = await readFile(cascadeDemoSource, 'utf8');

  assert.match(source, /import Symbiote, \{ html \} from '@symbiotejs\/symbiote'/);
  assert.match(source, /class CascadeGraphPanel extends Symbiote/);
  assert.match(source, /class CascadeUiPanel extends Symbiote/);
  assert.match(source, /applyTheme\(document\.documentElement, DEFAULT_PROVIDER_THEME\)/);
  assert.match(source, /10 \+ brightness \* 0\.18/);
  assert.match(source, /94 \+ \(contrast - 58\) \* 0\.12/);
  assert.match(source, /63 \+ \(contrast - 58\) \* 0\.12/);
  assert.match(source, /0\.08 : 0\.24/);
  assert.match(source, /--sn-theme-outline-strength/);
  assert.match(source, /--sn-theme-type-scale/);
  assert.match(source, /--sn-theme-spacing-scale/);
  assert.match(source, /--sn-effect-focus-ring/);
  assert.match(source, /--sn-xr-panel-border/);
  assert.doesNotMatch(source, /extends HTMLElement/);
  assert.doesNotMatch(source, /\.setTheme\(/);
});

test('cascade theme lab declares browser import map for bare package imports', async () => {
  const source = await readFile(cascadeDemoHtml, 'utf8');

  assert.match(source, /<script type="importmap">/);
  assert.match(source, /"@symbiotejs\/symbiote": "\.\.\/node_modules\/@symbiotejs\/symbiote\/core\/index\.js"/);
  assert.match(source, /"symbiote-engine\/": "\.\.\/node_modules\/symbiote-engine\/"/);
});
