import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

let labSource = readFileSync(new URL('../demo/native-panels-webgl-lab.js', import.meta.url), 'utf8');
let labHarnessHtml = readFileSync(new URL('../demo/native-panels-webgl-lab.html', import.meta.url), 'utf8');

test('native panels webgl lab attaches the native renderer group to the rendered scene exactly once', () => {
  let attachments = labSource.match(/scene\.add\(panelRenderer\.group\)/g) || [];
  assert.equal(
    attachments.length,
    1,
    'the rendered Three scene must own panelRenderer.group exactly once, otherwise nothing is drawn',
  );
});

test('native panels webgl lab harness keeps reference and stage in equal columns with a fill-frame iframe', () => {
  let columns = [...labHarnessHtml.matchAll(/grid-template-columns:\s*([^;]+);/g)]
    .map((match) => match[1].trim().replace(/\s+/g, ' '));
  assert.deepEqual(
    columns,
    ['minmax(0, 1fr) minmax(0, 1fr) 360px'],
    'reference and stage must share equal flexible columns beside the fixed 360px diagnostics panel',
  );
  let frameRule = /#reference-frame\s*\{[^}]*\}/.exec(labHarnessHtml)?.[0] || '';
  assert.match(
    frameRule,
    /width:\s*100%;/,
    'the iframe viewport must fill the reference column width instead of a fixed pixel width',
  );
  assert.match(
    frameRule,
    /height:\s*100%;/,
    'the iframe viewport must fill the reference column height instead of a fixed pixel height',
  );
});

test('native panels webgl lab relays each header intent to its own DOM control via the capture contract', () => {
  assert.match(
    labSource,
    /import\s*\{[^}]*\bresolveHeaderControlSelector\b[^}]*\}\s*from\s*'\.\.\/xr\/dom-spatial-capture\.js';/,
    'the relay must resolve header intents through the capture contract, not a local selector fork',
  );
  assert.match(labSource, /resolveHeaderControlSelector\(intent\)/);
  assert.ok(
    !labSource.includes("'.panel-menu-toggle'"),
    'the relay must not hardcode the panel menu toggle selector',
  );
  assert.ok(
    !labSource.includes("'.type-btn'"),
    'the relay must not hardcode the type button selector',
  );
});

test('native panels webgl lab normalizes browser-resolved theme colors before they reach Three', () => {
  assert.match(
    labSource,
    /import\s*\{[^}]*\bcreateCanvasColorNormalizer\b[^}]*\}\s*from\s*'\.\.\/xr\/dom-spatial-capture\.js';/,
    'theme role normalization reuses the capture seam canvas normalizer',
  );
  assert.match(labSource, /function normalizeThemeRoles\(/);
  assert.match(labSource, /lab\.unsupportedColors = normalizeThemeRoles\(theme, doc\)/);
  assert.match(labSource, /lab\.unsupportedColors = normalizeThemeRoles\(theme, document\)/);
  assert.match(labSource, /unsupportedColors/);
});

test('native panels webgl lab loads the self-hosted provider Material Symbols stylesheet in the outer document', () => {
  assert.match(
    labHarnessHtml,
    /<link[^>]*rel="stylesheet"[^>]*href="\.\.\/icons\/material-symbols\.css"[^>]*>/,
    'the outer lab document owns raster canvases, so it must load the provider icon font stylesheet',
  );
});

test('native panels webgl lab awaits the provider icon font and issues one late-readiness redraw', () => {
  assert.match(labSource, /document\.fonts/, 'font readiness uses the FontFaceSet of the outer document');
  assert.match(labSource, /Material Symbols Outlined/, 'the awaited family is the provider icon font');
  assert.match(labSource, /fonts\.check\(/, 'readiness is checked explicitly, not assumed');
  assert.match(labSource, /refreshTextures\(\)/, 'a late font readiness triggers one explicit quality redraw');
});

test('native panels webgl lab exposes the text quality report and appearance refresh surface', () => {
  assert.match(labSource, /getTextQualityReport\(\)/, 'the lab report surfaces the renderer text quality report');
  assert.match(
    labSource,
    /refreshAppearance\(compiled, \{ theme \}\)/,
    'dark/light recapture goes through the appearance-refresh seam',
  );
  assert.match(
    labSource,
    /geometry-invalidated/,
    'geometry-invalidated appearance refreshes fall back to an intentional remount',
  );
});

test('native panels webgl lab passes product classes only through the generic surfaceSelectors option', () => {
  assert.match(
    labSource,
    /const REAL_SURFACE_SELECTORS = Object\.freeze\(\[/,
    'the lab declares its structural surface selectors as explicit data',
  );
  assert.match(
    labSource,
    /surfaceSelectors:\s*REAL_SURFACE_SELECTORS/,
    'capture options carry structural surfaces through the generic surfaceSelectors seam',
  );
  assert.ok(
    !labSource.includes("'.project-panel-intro strong'") && !labSource.includes('textSelectors: REAL_TEXT_SELECTORS'),
    'product classes no longer appear in textSelectors',
  );
});

test('native panels webgl lab computes IR and visual parity with a composite ok', () => {
  assert.match(
    labSource,
    /import\s*\{[^}]*\bcreateSpatialVisualParityReport\b[^}]*\}\s*from\s*'\.\.\/xr\/spatial-visual-parity\.js';/,
    'visual parity comes from the provider contract module',
  );
  assert.match(
    labSource,
    /createSpatialVisualParityReport\(snapshot, panelRenderer\.getAppearanceReport\(\)\)/,
    'visual parity compares the snapshot against the renderer appearance sample',
  );
  assert.match(
    labSource,
    /ok:\s*ir\.ok\s*&&\s*visual\.ok/,
    'the lab headline passes only when IR parity and visual parity both pass',
  );
  assert.match(labSource, /ir:/, 'the IR subreport is exposed');
  assert.match(labSource, /visual:/, 'the visual subreport is exposed');
});

test('native panels webgl lab relays the tree collapse intent through the capture contract', () => {
  assert.match(
    labSource,
    /import\s*\{[^}]*\bSPATIAL_TREE_CONTROLS\b[^}]*\}\s*from\s*'\.\.\/xr\/dom-spatial-capture\.js';/,
    'tree control selectors resolve through the capture contract, not a local selector fork',
  );
  assert.ok(
    !labSource.includes("'.sn-tree-panel-collapse'"),
    'the relay must not hardcode the tree collapse selector',
  );
});
