/**
 * Mobile control sizing: icon box, painted control box and pressable area are
 * three independent theme parameters, and drawer surfaces must read them from
 * the shared token system instead of pixels written into drawer CSS.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

test('both providers expose separate icon / visual / hit size parameters', async () => {
  const [provider, cascade] = await Promise.all([
    import('../themes/default-provider.js'),
    import('../themes/cascade-theme.js'),
  ]);
  const providerTokens = provider.DEFAULT_PROVIDER_THEME.tokens;

  // Painted control box (density-driven) and pressable area (absolute floor)
  // are separate tokens; the icon box already has its own type-scale token.
  assert.equal(providerTokens['--sn-layout-header-button-min-inline-size'],
    'calc(24px * var(--sn-theme-density))');
  assert.equal(providerTokens['--sn-layout-header-button-hit-size'], '44px');
  assert.equal(providerTokens['--sn-layout-header-icon-size'],
    'calc(16px * var(--sn-theme-type-scale))');

  // Tree: glyph column, desktop column, touch column.
  assert.equal(providerTokens['--sn-tree-toggle-width'], 'calc(18px * var(--sn-theme-density))');
  assert.equal(providerTokens['--sn-tree-toggle-touch-width'],
    'calc(24px * var(--sn-theme-density))');
  assert.equal(providerTokens['--sn-tree-icon-size'], 'calc(15px * var(--sn-theme-type-scale))');

  // The Cascade theme retunes the same parameters, so a product theme can move
  // icon, control and hit sizes independently.
  const cascadeSource = read('../themes/cascade-theme.js');
  assert.match(cascadeSource, /'--sn-layout-header-button-hit-size': '44px',/);
  assert.match(cascadeSource, /'--sn-tree-toggle-touch-width': densityToken\(24\),/);
  assert.ok(
    cascade.CASCADE_THEME_TOKEN_TARGETS.density.includes('--sn-layout-header-button-hit-size'),
    'the hit size is a retunable density-family target',
  );
});

test('generated provider CSS mirrors the hit and touch tokens', () => {
  const css = read('../themes/default-provider.css');
  assert.ok(css.includes('  --sn-layout-header-button-hit-size: 44px;'));
  assert.ok(css.includes('  --sn-tree-toggle-touch-width: calc(24px * var(--sn-theme-density));'));
  // Density must reach the toggle column: a resolved literal would freeze it.
  assert.ok(css.includes('  --sn-tree-toggle-width: calc(18px * var(--sn-theme-density));'));
});

test('header control hit area expands outside the visual box but stays gap-clamped', () => {
  const css = read('../layout/LayoutNode/LayoutNode.css.js');
  const hitRule = css.slice(css.indexOf('.header-btn'), css.indexOf('.type-btn'));
  assert.match(hitRule, /::before/, 'the target is realised by a pseudo-element, not by padding');
  assert.match(hitRule, /--sn-layout-header-button-hit-size/,
    'the target size comes from the theme, not a literal');
  assert.match(hitRule, /min\(var\(--sn-layout-header-button-gap,[^)]*\),\s*var\(--sn-layout-header-gap,[^)]*\)\)\s*\/\s*2/,
    'expansion is clamped to half the smallest distance between header controls');
  const declarations = hitRule.replace(/\/\*[\s\S]*?\*\//g, '').replace(/var\([^)]*\)/g, '');
  assert.ok(!/\b(?:44|24|32)px\b/.test(declarations),
    'no fixed pixel sizes inside the hit-area declarations');

  // The icon keeps its own type-scale token next to the hit parameter.
  assert.match(css, /\.material-symbols-outlined \{\s*font-size: var\(--sn-layout-header-icon-size, 16px\);/);
});

test('drawer scope reads the touch column from the theme instead of a fixed pixel', () => {
  const css = read('../layout/Layout/Layout.css.js');
  const start = css.indexOf("layout-node[mobile-dock='start'],");
  const block = css.slice(start, css.indexOf('}', start));
  assert.match(block, /--sn-tree-toggle-width: var\(--sn-tree-toggle-touch-width/,
    'drawer mode maps the theme touch token onto the toggle column');
  assert.ok(!/:\s*\d+px;/.test(block),
    'the drawer block declares no hard-coded pixel size');
});

test('drawer panels keep content out of the safe-area insets', () => {
  const css = read('../layout/Layout/Layout.css.js');

  // The panel stays flush to the screen edge; only its content is inset, and
  // the inset is the environment value, not a library pixel.
  const safeAreaStart = css.indexOf("layout-node[node-type='panel'][mobile-dock='start'],");
  const panelBlock = css.slice(safeAreaStart, css.indexOf("layout-node[node-type='panel'] {", safeAreaStart));
  assert.match(panelBlock, /--sn-layout-drawer-safe-area-block-end:\s*env\(safe-area-inset-bottom, 0px\);/);
  assert.match(panelBlock, /--sn-layout-drawer-safe-area-inline-start:\s*env\(safe-area-inset-left, 0px\);/);
  assert.match(panelBlock, /--sn-layout-drawer-safe-area-inline-end:\s*env\(safe-area-inset-right, 0px\);/);
  assert.match(panelBlock, /padding-block-end: var\(--sn-layout-drawer-safe-area-block-end, 0px\);/);

  // Each dock insets the edge that touches the screen, never the inner edge.
  assert.match(css, /layout-node\[node-type='panel'\]\[mobile-dock='start'\] \{\s*padding-inline-start: var\(--sn-layout-drawer-safe-area-inline-start, 0px\);/);
  assert.match(css, /layout-node\[node-type='panel'\]\[mobile-dock='end'\] \{\s*padding-inline-end: var\(--sn-layout-drawer-safe-area-inline-end, 0px\);/);
  assert.doesNotMatch(css, /layout-node\[node-type='panel'\]\[mobile-dock='start'\] \{[^}]*padding-inline-end/,
    'the start drawer must not inset its inner edge');

  // A host that already pads its own content can neutralise the inset.
  assert.match(panelBlock, /var\(--sn-layout-drawer-safe-area-[^,]+, 0px\)/,
    'every safe-area padding is token-driven with a 0px fallback');
});
