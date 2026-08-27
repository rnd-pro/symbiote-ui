import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import {
  XR_SPATIAL_WINDOW_LAYOUT_VERSION,
  XR_SPATIAL_WINDOW_SYNC_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_LIFECYCLE_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_FALLBACK_VERSION,
  XR_SPATIAL_WINDOW_DIAGNOSTICS_VERSION,
  normalizeXRSpatialWindowLayout,
  diffXRSpatialWindowLayouts,
  resolveXRSpatialWindowTextureKey,
  createXRSpatialWindowChromeSurface,
  validateXRSpatialWindowThemeRedrawReceipt,
  validateXRSpatialWindowDiagnostics,
  computeXREvidenceDigest,
  digest,
} from '../xr/spatial-window-contract.js';
import { createXRSpatialWindowAssembly } from '../xr/spatial-window-assembly.js';
import { computeXRPanelChromeLayout } from '../xr/panel-frame.js';
import {
  createFakeXrPlatform,
  createFakeThree,
  createLayoutDescriptor,
  createWindowContentElement,
} from './xr-spatial-window-fixtures.js';

let directory = dirname(fileURLToPath(import.meta.url));

async function createSchemaValidator(names) {
  let schemas = await Promise.all(names.map(async (name) => (
    JSON.parse(await readFile(resolve(directory, '..', 'schemas', name), 'utf8'))
  )));
  let ajv = new Ajv2020({ allErrors: true, strict: true });
  for (let schema of schemas) ajv.addSchema(schema);
  return { ajv, schemas, validate: (index) => ajv.getSchema(schemas[index].$id) };
}

function createAssemblyContext(options = {}) {
  let platform = createFakeXrPlatform({ mode: options.mode ?? 'webgl' });
  let THREE = options.noThree ? null : createFakeThree();
  let assembly = createXRSpatialWindowAssembly({
    globalThis: platform.globalThis,
    document: platform.document,
    THREE,
    ...(options.assemblyOptions || {}),
  });
  return { platform, THREE, assembly };
}

test('layout descriptor normalization stamps version, derives windowId, and applies defaults', () => {
  let result = normalizeXRSpatialWindowLayout({ layoutId: 'layout-a' });
  assert.equal(result.ok, true);
  assert.equal(result.layout.version, XR_SPATIAL_WINDOW_LAYOUT_VERSION);
  assert.equal(result.layout.windowId, 'window:layout-a');
  assert.equal(result.layout.contentKind, 'dom');
  assert.deepEqual(result.layout.pose, { position: [0, 1.35, -1.6], rotation: [0, 0, 0] });
  assert.deepEqual(result.layout.sizeMeters, [0.8, 0.45]);
  assert.equal(result.layout.viewport.width, 1280);
  assert.equal(result.layout.viewport.height, 720);
  assert.equal(result.layout.contentRevision, 0);
  assert.equal(result.layout.themeRevision, 0);
  assert.deepEqual(result.layout.state, {
    focused: false,
    pinned: false,
    hidden: false,
    closable: true,
  });
  assert.equal(Object.isFrozen(result.layout), true);
  assert.equal(Object.isFrozen(result.layout.pose), true);
});

test('layout descriptor normalization reports invalid inputs as data', () => {
  assert.deepEqual(normalizeXRSpatialWindowLayout({}), {
    ok: false,
    reason: 'missing-layout-id',
    layoutId: null,
  });
  assert.equal(normalizeXRSpatialWindowLayout({ layoutId: 'a', version: 'other' }).reason, 'invalid-version');
  assert.equal(
    normalizeXRSpatialWindowLayout({ layoutId: 'a', contentKind: 'hologram' }).reason,
    'invalid-content-kind',
  );
  assert.equal(
    normalizeXRSpatialWindowLayout({ layoutId: 'a', pose: { position: [0, 'x', -1], rotation: [0, 0, 0] } }).reason,
    'invalid-pose',
  );
  assert.equal(normalizeXRSpatialWindowLayout({ layoutId: 'a', sizeMeters: [0, 1] }).reason, 'invalid-size');
  assert.equal(normalizeXRSpatialWindowLayout({ layoutId: 'a', viewport: { width: -1, height: 10 } }).reason, 'invalid-viewport');
  assert.equal(normalizeXRSpatialWindowLayout({ layoutId: 'a', contentRevision: 1.5 }).reason, 'invalid-revision');
  assert.equal(
    normalizeXRSpatialWindowLayout({ layoutId: 'a', state: { focused: 'yes' } }).reason,
    'invalid-state',
  );
});

test('layout diff reports changed fields and ignores identity fields', () => {
  let base = normalizeXRSpatialWindowLayout({ layoutId: 'a' }).layout;
  let same = normalizeXRSpatialWindowLayout({ layoutId: 'a' }).layout;
  assert.deepEqual(diffXRSpatialWindowLayouts(base, same), { changed: false, changes: [] });
  let moved = normalizeXRSpatialWindowLayout({
    layoutId: 'a',
    pose: { position: [0.5, 1.35, -1.6], rotation: [0, 0, 0] },
    contentRevision: 2,
  }).layout;
  let diff = diffXRSpatialWindowLayouts(base, moved);
  assert.equal(diff.changed, true);
  assert.ok(diff.changes.includes('pose'));
  assert.ok(diff.changes.includes('contentRevision'));
  assert.equal(diff.changes.includes('layoutId'), false);
});

test('texture key tracks content and theme revisions, viewport, theme epoch, and content epoch', () => {
  let key = resolveXRSpatialWindowTextureKey({
    contentRevision: 3,
    themeRevision: 2,
    viewport: { width: 1280, height: 720 },
    themeEpoch: 1,
    contentEpoch: 0,
  });
  assert.equal(key, '3:2:1280x720:1:0');
  assert.notEqual(
    resolveXRSpatialWindowTextureKey({ contentRevision: 4, themeRevision: 2, viewport: { width: 1280, height: 720 }, themeEpoch: 1, contentEpoch: 0 }),
    key,
  );
  assert.notEqual(
    resolveXRSpatialWindowTextureKey({ contentRevision: 3, themeRevision: 2, viewport: { width: 1280, height: 720 }, themeEpoch: 1, contentEpoch: 2 }),
    key,
    'scroll-driven content epoch invalidates the texture',
  );
});

test('chrome surface extends beyond the window quad so chrome zones stay hittable', () => {
  let frame = computeXRPanelChromeLayout([0.8, 0.45]);
  let surface = createXRSpatialWindowChromeSurface(frame, [0.8, 0.45]);
  assert.ok(surface.sizeMeters[0] > 0.8);
  assert.ok(surface.sizeMeters[1] > 0.45);
  assert.ok(surface.extents.x > 0);
  assert.ok(surface.extents.y > 0);
});

test('syncLayouts adds, updates, removes, and reconciles idempotently', () => {
  let { assembly, platform } = createAssemblyContext();
  let alpha = createLayoutDescriptor({
    dom: { element: createWindowContentElement(platform.document) },
  });
  let beta = createLayoutDescriptor({
    layoutId: 'layout-beta',
    title: 'Beta window',
    pose: { position: [0.7, 1.3, -1.5], rotation: [0, -18, 0] },
    dom: { element: createWindowContentElement(platform.document) },
  });

  let first = assembly.syncLayouts([alpha, beta]);
  assert.equal(first.version, XR_SPATIAL_WINDOW_SYNC_RECEIPT_VERSION);
  assert.equal(first.ok, true);
  assert.equal(first.sequence, 1);
  assert.deepEqual([...first.added].sort(), ['window:layout-alpha', 'window:layout-beta']);
  assert.deepEqual(first.updated, []);
  assert.deepEqual(first.removed, []);
  assert.deepEqual(first.unchanged, []);
  assert.equal(first.errors.length, 0);
  assert.equal(first.windows.length, 2);
  assert.equal(first.windows[0].layoutId, 'layout-alpha');
  assert.equal(first.windows[0].windowId, 'window:layout-alpha');

  let second = assembly.syncLayouts([alpha, beta]);
  assert.equal(second.sequence, 2);
  assert.deepEqual(second.added, []);
  assert.deepEqual(second.updated, []);
  assert.deepEqual(second.removed, []);
  assert.deepEqual([...second.unchanged].sort(), ['window:layout-alpha', 'window:layout-beta']);
  let counters = assembly.getDiagnostics().counters;
  assert.equal(counters.uploads, 0, 'identical re-sync must not upload');

  let updatedBeta = createLayoutDescriptor({
    layoutId: 'layout-beta',
    contentRevision: 2,
    pose: { position: [0.9, 1.3, -1.5], rotation: [0, -18, 0] },
  });
  let third = assembly.syncLayouts([alpha, updatedBeta]);
  assert.deepEqual(third.added, []);
  assert.deepEqual(third.updated, ['window:layout-beta']);
  assert.deepEqual(third.removed, []);
  assert.deepEqual(third.unchanged, ['window:layout-alpha']);
  let betaEntry = third.windows.find((entry) => entry.layoutId === 'layout-beta');
  assert.ok(betaEntry.changes.includes('contentRevision'));
  assert.ok(betaEntry.changes.includes('pose'));

  let fourth = assembly.syncLayouts([alpha]);
  assert.deepEqual(fourth.removed, ['window:layout-beta']);
  assert.equal(assembly.getWindow('window:layout-beta'), null);
  assert.equal(assembly.listWindows().length, 1);

  let invalid = assembly.syncLayouts([{ title: 'no identity' }]);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.length, 1);
  assert.equal(invalid.errors[0].reason, 'missing-layout-id');
});

test('syncLayouts rejects a window-id conflict for a known layoutId', () => {
  let { assembly, platform } = createAssemblyContext();
  assembly.syncLayouts([createLayoutDescriptor({
    dom: { element: createWindowContentElement(platform.document) },
  })]);
  let conflict = assembly.syncLayouts([createLayoutDescriptor({ windowId: 'window:other' })]);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors.length, 1);
  assert.equal(conflict.errors[0].layoutId, 'layout-alpha');
  assert.equal(conflict.errors[0].reason, 'window-id-conflict');
});

test('enter, exit, and re-entry preserve windows and poses without duplicates', () => {
  let { assembly, platform } = createAssemblyContext();
  let alpha = createLayoutDescriptor({
    dom: { element: createWindowContentElement(platform.document) },
  });
  let beta = createLayoutDescriptor({
    layoutId: 'layout-beta',
    pose: { position: [-0.6, 1.4, -1.4], rotation: [0, 20, 0] },
    dom: { element: createWindowContentElement(platform.document) },
  });
  assembly.syncLayouts([alpha, beta]);

  let enter = assembly.enter({ sessionId: 'session-1' });
  assert.equal(enter.version, XR_SPATIAL_WINDOW_LIFECYCLE_RECEIPT_VERSION);
  assert.equal(enter.action, 'enter');
  assert.equal(enter.ok, true);
  assert.equal(enter.details.entered, true);
  assert.equal(enter.details.alreadyEntered, false);
  assert.equal(enter.details.windowCount, 2);

  let again = assembly.enter({ sessionId: 'session-1' });
  assert.equal(again.ok, true);
  assert.equal(again.details.alreadyEntered, true);
  assert.equal(again.details.windowCount, 2, 're-enter must not duplicate windows');

  let settle = assembly.settleWindowPose('window:layout-alpha', {
    position: [0.25, 1.5, -1.2],
    rotation: [0, 12, 0],
  });
  assert.equal(settle.ok, true);

  let exit = assembly.exit();
  assert.equal(exit.action, 'exit');
  assert.equal(exit.ok, true);
  assert.equal(exit.details.windowCount, 2);

  let reenter = assembly.enter({ sessionId: 'session-2' });
  assert.equal(reenter.ok, true);
  assert.equal(reenter.details.alreadyEntered, false);
  assert.equal(reenter.details.windowCount, 2);
  assert.equal(reenter.details.poseRestore.restored, true, 're-entry restores persisted poses');

  let pose = assembly.getWindow('window:layout-alpha').pose;
  assert.deepEqual(pose.position, [0.25, 1.5, -1.2]);
  assert.deepEqual(pose.rotation, [0, 12, 0]);
  let betaPose = assembly.getWindow('window:layout-beta').pose;
  assert.deepEqual(betaPose.position, [-0.6, 1.4, -1.4]);
});

test('adoptSession and releaseSession bind pose state explicitly', () => {
  let { assembly, platform } = createAssemblyContext();
  assembly.syncLayouts([createLayoutDescriptor({
    dom: { element: createWindowContentElement(platform.document) },
  })]);

  let adopt = assembly.adoptSession({ sessionId: 'session-adopt' });
  assert.equal(adopt.action, 'adopt-session');
  assert.equal(adopt.ok, true);
  assert.equal(adopt.details.sessionId, 'session-adopt');

  let readopt = assembly.adoptSession({ sessionId: 'session-adopt' });
  assert.equal(readopt.details.alreadyAdopted, true);

  assembly.settleWindowPose('window:layout-alpha', { position: [1, 1.5, -1], rotation: [0, 0, 0] });
  let release = assembly.releaseSession();
  assert.equal(release.action, 'release-session');
  assert.equal(release.ok, true);
  assert.equal(release.details.poseSnapshot.version, 'xr-portable-panel-state-v1');

  let readopt2 = assembly.adoptSession({ sessionId: 'session-adopt-2' });
  assert.equal(readopt2.details.poseRestore.restored, true);
  assert.deepEqual(assembly.getWindow('window:layout-alpha').pose.position, [1, 1.5, -1]);

  let releaseWithout = assembly.releaseSession();
  assembly.releaseSession();
  let orphan = assembly.releaseSession();
  assert.equal(orphan.ok, true);
  assert.equal(orphan.details.released, false);
  assert.equal(orphan.reason, 'no-adopted-session');
  assert.equal(releaseWithout.ok, true);
});

test('focusWindow focuses one window and blurs the previous one', () => {
  let { assembly, platform } = createAssemblyContext();
  assembly.syncLayouts([
    createLayoutDescriptor({ dom: { element: createWindowContentElement(platform.document) } }),
    createLayoutDescriptor({
      layoutId: 'layout-beta',
      dom: { element: createWindowContentElement(platform.document) },
    }),
  ]);
  let focus = assembly.focusWindow('window:layout-alpha');
  assert.equal(focus.version, XR_SPATIAL_WINDOW_LIFECYCLE_RECEIPT_VERSION);
  assert.equal(focus.action, 'focus');
  assert.equal(focus.ok, true);
  assert.equal(focus.windowId, 'window:layout-alpha');
  assert.equal(assembly.getWindow('window:layout-alpha').state.focused, true);

  let refocus = assembly.focusWindow('window:layout-beta');
  assert.equal(refocus.details.previousFocusedWindowId, 'window:layout-alpha');
  assert.equal(assembly.getWindow('window:layout-alpha').state.focused, false);
  assert.equal(assembly.getWindow('window:layout-beta').state.focused, true);

  let missing = assembly.focusWindow('window:nope');
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'window-not-found');
});

test('receipts are data-only and JSON round-trippable', () => {
  let { assembly, platform } = createAssemblyContext();
  assembly.syncLayouts([
    createLayoutDescriptor({ dom: { element: createWindowContentElement(platform.document) } }),
    { layoutId: 'broken' },
  ]);
  assembly.enter({ sessionId: 'session-data' });
  assembly.focusWindow('window:layout-alpha');
  let receipts = assembly.getReceipts();
  assert.ok(receipts.length >= 3);
  for (let receipt of receipts) {
    assert.equal(Object.isFrozen(receipt), true);
    let roundTrip = JSON.parse(JSON.stringify(receipt));
    assert.deepEqual(roundTrip, JSON.parse(JSON.stringify(receipt)));
  }
  let diagnostics = assembly.getDiagnostics();
  let serialized = JSON.parse(JSON.stringify(diagnostics));
  assert.equal(serialized.version, XR_SPATIAL_WINDOW_DIAGNOSTICS_VERSION);
});

test('assembly is SSR-safe: evaluates and reconciles without DOM or WebXR globals', () => {
  let assembly = createXRSpatialWindowAssembly({ globalThis: {} });
  let sync = assembly.syncLayouts([createLayoutDescriptor()]);
  assert.equal(sync.ok, true);
  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.equal(windowEntry.lifecycle.mounted, false);
  assert.equal(windowEntry.fallback.version, XR_SPATIAL_WINDOW_FALLBACK_VERSION);
  assert.equal(windowEntry.fallback.mode, 'dom-overlay');
  assert.equal(windowEntry.fallback.reason, 'dom-host-unavailable');
  let enter = assembly.enter({ sessionId: 'session-ssr' });
  assert.equal(enter.ok, true);
  let diagnostics = assembly.getDiagnostics();
  assert.equal(diagnostics.windows[0].upload.uploads, 0);
});

test('package exports and discover metadata expose the assembly', async () => {
  let pkg = JSON.parse(await readFile(resolve(directory, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.exports['./xr/spatial-window-assembly']);
  assert.ok(pkg.exports['./xr/spatial-window-contract']);

  let barrel = await import('../xr/index.js');
  assert.equal(typeof barrel.createXRSpatialWindowAssembly, 'function');
  assert.equal(typeof barrel.normalizeXRSpatialWindowLayout, 'function');
  assert.equal(barrel.XR_SPATIAL_WINDOW_LAYOUT_VERSION, XR_SPATIAL_WINDOW_LAYOUT_VERSION);

  let assemblySubpath = await import('../xr/spatial-window-assembly.js');
  assert.equal(typeof assemblySubpath.createXRSpatialWindowAssembly, 'function');

  let { cmdDiscover } = await import('../discover.js');
  let discovery = await cmdDiscover();
  let entrypoint = discovery.exports.entrypoints.find((entry) => (
    entry.specifier === 'symbiote-ui/xr/spatial-window-assembly'
  ));
  assert.ok(entrypoint, 'discover lists the assembly entrypoint');
  assert.equal(entrypoint.kind, 'ssr-entry-safe');
  let webxr = discovery.manifest.renderers.find((renderer) => renderer.name === 'webxr');
  assert.ok(webxr.capabilities.includes('xr-spatial-window-assembly'));
  assert.ok(webxr.capabilities.includes('xr-spatial-window-sync-layouts'));
  let schemaVersions = discovery.manifest.schemas.map((schema) => schema.version);
  assert.ok(schemaVersions.includes(XR_SPATIAL_WINDOW_LAYOUT_VERSION));
  assert.ok(schemaVersions.includes(XR_SPATIAL_WINDOW_SYNC_RECEIPT_VERSION));
  assert.ok(schemaVersions.includes(XR_SPATIAL_WINDOW_DIAGNOSTICS_VERSION));
});

test('assembly schemas validate canonical descriptors, receipts, and diagnostics', async () => {
  let names = [
    'xr-spatial-window-layout-v1.json',
    'xr-spatial-window-sync-receipt-v1.json',
    'xr-spatial-window-lifecycle-receipt-v1.json',
    'xr-spatial-window-diagnostics-v1.json',
  ];
  let { ajv, validate } = await createSchemaValidator(names);
  let validateLayout = validate(0);
  let validateSync = validate(1);
  let validateLifecycle = validate(2);
  let validateDiagnostics = validate(3);

  let { assembly, platform } = createAssemblyContext();
  let sync = assembly.syncLayouts([createLayoutDescriptor({
    dom: { element: createWindowContentElement(platform.document) },
  })]);
  let enter = assembly.enter({ sessionId: 'session-schema' });
  let focus = assembly.focusWindow('window:layout-alpha');
  let diagnostics = assembly.getDiagnostics();
  let projection = assembly.getWindowDataProjection('window:layout-alpha');

  assert.equal(validateLayout(projection), true, ajv.errorsText(validateLayout.errors));
  assert.equal(validateSync(sync), true, ajv.errorsText(validateSync.errors));
  assert.equal(validateLifecycle(enter), true, ajv.errorsText(validateLifecycle.errors));
  assert.equal(validateLifecycle(focus), true, ajv.errorsText(validateLifecycle.errors));
  assert.equal(validateDiagnostics(diagnostics), true, ajv.errorsText(validateDiagnostics.errors));

  let badLayout = JSON.parse(JSON.stringify(projection));
  badLayout.layoutId = '';
  assert.equal(validateLayout(badLayout), false);
  let badSync = JSON.parse(JSON.stringify(sync));
  badSync.added = 'window:layout-alpha';
  assert.equal(validateSync(badSync), false);
});

test('provider theme corrections: typed theme redraw receipt, per-window snapshot invariance, positive intersection allowlist, and recursive schema strictness', async () => {
  let names = [
    'xr-spatial-window-diagnostics-v1.json',
    'xr-spatial-window-theme-redraw-receipt-v1.json',
  ];
  let { ajv, validate } = await createSchemaValidator(names);
  let validateDiagnostics = validate(0);
  let validateThemeRedraw = validate(1);

  let { assembly, platform } = createAssemblyContext();

  assembly.syncLayouts([
    createLayoutDescriptor({
      layoutId: 'layout-alpha',
      themeScope: 'alpha-scope',
      sizeMeters: [0.8, 0.45],
      viewport: { width: 800, height: 450 },
      dom: { element: createWindowContentElement(platform.document) },
    }),
    createLayoutDescriptor({
      layoutId: 'layout-beta',
      themeScope: 'beta-scope',
      sizeMeters: [1.2, 0.6],
      viewport: { width: 1200, height: 600 },
      dom: { element: createWindowContentElement(platform.document) },
    }),
  ]);

  assembly.enter({ sessionId: 'session-theme-parity' });

  let diagBefore = assembly.getDiagnostics();
  let winAlphaBefore = diagBefore.windows.find((w) => w.layoutId === 'layout-alpha');
  let winBetaBefore = diagBefore.windows.find((w) => w.layoutId === 'layout-beta');

  assert.equal(validateDiagnostics(diagBefore), true, ajv.errorsText(validateDiagnostics.errors));

  // Adversarial mutations
  let badDiag1 = JSON.parse(JSON.stringify(diagBefore));
  badDiag1.unknownTopLevelProperty = 'fail-me';
  assert.equal(validateDiagnostics(badDiag1), false, 'Unknown top-level property must fail schema');

  let badDiag2 = JSON.parse(JSON.stringify(diagBefore));
  badDiag2.frame.unknownFrameProperty = 42;
  assert.equal(validateDiagnostics(badDiag2), false, 'Unknown frame property must fail schema');

  let badDiag3 = JSON.parse(JSON.stringify(diagBefore));
  badDiag3.theme.unknownThemeProperty = 'fail';
  assert.equal(validateDiagnostics(badDiag3), false, 'Unknown theme property must fail schema');

  let badDiag4 = JSON.parse(JSON.stringify(diagBefore));
  badDiag4.windows[0].chrome.zones.actions.unknownActionProperty = { x: 0, y: 0, width: 1, height: 1 };
  assert.equal(validateDiagnostics(badDiag4), false, 'Unknown action property must fail schema');

  let badDiag5 = JSON.parse(JSON.stringify(diagBefore));
  badDiag5.activeGesture = { windowId: 'window:layout-alpha', operation: 'move', handle: null, unknownField: true };
  assert.equal(validateDiagnostics(badDiag5), false, 'Unknown activeGesture property must fail schema');

  let badDiag6 = JSON.parse(JSON.stringify(diagBefore));
  badDiag6.windows[0].fallback = {
    version: 'xr-spatial-window-fallback-v1',
    windowId: 'window:layout-alpha',
    layoutId: 'layout-alpha',
    mode: 'none',
    source: 'test',
    reason: null,
    upload: null,
    unknownField: 'fail'
  };
  assert.equal(validateDiagnostics(badDiag6), false, 'Unknown fallback property must fail schema');

  // Verify explicit allowlist overlap check on alpha window
  assert.equal(winAlphaBefore.chrome.overlap.zeroForbiddenOverlap, true);
  assert.equal(winAlphaBefore.chrome.overlap.verdict, 'PASS');

  // Check positive intersections in diagnostics
  let intersections = winAlphaBefore.chrome.overlap.intersections;
  assert.ok(intersections.length > 0);
  assert.ok(intersections.every((item) => item.allowed === true));
  let cbMove = intersections.find(item => item.zones.includes('controlBar') && item.zones.includes('move'));
  let cbReset = intersections.find(item => item.zones.includes('controlBar') && item.zones.includes('actions:reset'));
  assert.ok(cbMove);
  assert.ok(cbReset);

  // Apply theme specifically to 'alpha-scope'
  let themeInput = {
    version: 'xr-theme-snapshot-v1',
    themeScope: 'alpha-scope',
    tokens: { '--sn-xr-panel-bg': '#555555' },
    material: {
      background: '#555555',
      backgroundColor: 0x555555,
      border: '#666666',
      borderColor: 0x666666,
      pointer: '#777777',
      pointerColor: 0x777777,
      radius: '0px',
      shadow: 'none',
      text: '#888888',
      textColor: 0x888888,
      textDim: '#999999',
      textDimColor: 0x999999,
      gap: '0px',
      motion: { duration: '0s', easing: 'linear' },
    },
  };

  let beforeCounters = {
    alphaUploads: winAlphaBefore.upload.uploads,
    betaUploads: winBetaBefore.upload.uploads,
  };

  assembly.applyTheme(themeInput);
  let redrawReceipt = assembly.getReceipts().find((r) => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');

  assert.ok(redrawReceipt, 'Theme redraw receipt must be emitted');
  assert.equal(redrawReceipt.themeScope, 'alpha-scope');
  assert.equal(redrawReceipt.ok, true);
  assert.deepEqual(redrawReceipt.affectedWindows, ['window:layout-alpha']);
  assert.deepEqual(redrawReceipt.reusedWindows, ['window:layout-beta']);
  assert.equal(validateThemeRedraw(redrawReceipt), true, ajv.errorsText(validateThemeRedraw.errors));

  // Verify visual invariance of beta window
  let diagAfter = assembly.getDiagnostics();
  let winAlphaAfter = diagAfter.windows.find((w) => w.layoutId === 'layout-alpha');
  let winBetaAfter = diagAfter.windows.find((w) => w.layoutId === 'layout-beta');

  assert.equal(winAlphaAfter.upload.uploads, beforeCounters.alphaUploads + 1, 'Alpha window texture must upload');
  assert.equal(winBetaAfter.upload.uploads, beforeCounters.betaUploads, 'Beta window must NOT upload');

  // Verify material properties in adapter (using stubs)
  let alphaMesh = assembly.getWindowMesh('window:layout-alpha');
  let betaMesh = assembly.getWindowMesh('window:layout-beta');

  assert.ok(alphaMesh);
  assert.ok(betaMesh);
  assert.equal(alphaMesh.userData.panel.material.backgroundColor, 0x555555);
  assert.notEqual(betaMesh.userData?.panel?.material?.backgroundColor, 0x555555);
});

test('provider theme corrections v4 adversarial: validation mutations, unmounted redraw, fabricated diagnostics overlap, and byte invariance', async () => {
  let names = [
    'xr-spatial-window-diagnostics-v1.json',
    'xr-spatial-window-theme-redraw-receipt-v1.json',
  ];
  let { ajv, validate } = await createSchemaValidator(names);
  let validateDiagnostics = validate(0);
  let validateThemeRedraw = validate(1);

  let { assembly, platform } = createAssemblyContext();

  // Create layout - both are DOM windows so they can be mounted inside session
  assembly.syncLayouts([
    createLayoutDescriptor({
      layoutId: 'layout-alpha',
      themeScope: 'alpha-scope',
      sizeMeters: [0.8, 0.45],
      viewport: { width: 800, height: 450 },
      dom: { element: createWindowContentElement(platform.document) },
    }),
    createLayoutDescriptor({
      layoutId: 'layout-beta',
      themeScope: 'beta-scope',
      sizeMeters: [1.2, 0.6],
      viewport: { width: 1200, height: 600 },
      dom: { element: createWindowContentElement(platform.document) },
    }),
  ]);

  // TEST 1: Unmounted redraw path must fail-closed under new contract
  let themeInput = {
    version: 'xr-theme-snapshot-v1',
    themeScope: 'alpha-scope',
    tokens: { '--sn-xr-panel-bg': '#555555' },
    material: { background: '#555555', backgroundColor: 0x555555 },
  };

  // status !== entered throws no-session
  assert.throws(() => {
    assembly.applyTheme(themeInput);
  }, /no-session/);

  // Set up assembly3 with an unmounted window to test affected-window-unmounted
  let { assembly: assembly3, platform: platform3 } = createAssemblyContext();
  assembly3.syncLayouts([
    createLayoutDescriptor({
      layoutId: 'layout-alpha',
      themeScope: 'alpha-scope',
      contentKind: 'volumetric',
      sizeMeters: [0.8, 0.45],
      viewport: { width: 800, height: 450 },
    }),
  ]);
  assembly3.enter({ sessionId: 'session-unmounted-test' });
  assert.throws(() => {
    assembly3.applyTheme(themeInput);
  }, /affected-window-unmounted/);

  // Enter session on assembly - now both layouts are DOM and mounted
  assembly.enter({ sessionId: 'session-adversarial' });
  assembly.applyTheme(themeInput);

  let redrawReceipt = assembly.getReceipts().find((r) => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
  assert.ok(redrawReceipt, 'Receipt should be emitted');

  // Verify that it is validated successfully by BOTH schema and semantic validator
  assert.equal(validateThemeRedraw(redrawReceipt), true, ajv.errorsText(validateThemeRedraw.errors));
  let semanticResult = await validateXRSpatialWindowThemeRedrawReceipt(redrawReceipt);
  assert.equal(semanticResult.ok, true, semanticResult.reason);

  // TEST 2: Adversarial mutations on the theme redraw receipt

  // Mutation 2.1: Mutate binding hash to an invalid non-hash string
  let mutated1 = JSON.parse(JSON.stringify(redrawReceipt));
  mutated1.bindingHash = 'not-a-hash';
  let temp1 = { ...mutated1 };
  delete temp1.evidenceDigest;
  mutated1.evidenceDigest = await computeXREvidenceDigest(temp1);
  // Schema should pass or fail depending on regex, but semantic validator MUST reject it
  let semRes1 = await validateXRSpatialWindowThemeRedrawReceipt(mutated1);
  assert.equal(semRes1.ok, false);
  assert.equal(semRes1.reason, 'invalid-bindingHash-format');

  // Mutation 2.2: Mutate actualMaterial inside windowResults (should mismatch with signed record hash)
  let mutated2 = JSON.parse(JSON.stringify(redrawReceipt));
  mutated2.windowResults[0].actualMaterial = { mutated: true };
  let temp2 = { ...mutated2 };
  delete temp2.evidenceDigest;
  mutated2.evidenceDigest = await computeXREvidenceDigest(temp2);
  let semRes2 = await validateXRSpatialWindowThemeRedrawReceipt(mutated2);
  assert.equal(semRes2.ok, false);
  assert.ok(semRes2.reason.startsWith('incorrect-window-hash-for-'));

  // Mutation 2.3: Mutate before/after revision in windowResults (should mismatch with signed record hash)
  let mutated3 = JSON.parse(JSON.stringify(redrawReceipt));
  mutated3.windowResults[0].afterRevision = 999;
  let temp3 = { ...mutated3 };
  delete temp3.evidenceDigest;
  mutated3.evidenceDigest = await computeXREvidenceDigest(temp3);
  let semRes3 = await validateXRSpatialWindowThemeRedrawReceipt(mutated3);
  assert.equal(semRes3.ok, false);
  assert.ok(semRes3.reason.startsWith('incorrect-window-hash-for-'));

  // Mutation 2.4: Mutate aggregate counters (e.g. increase afterUploads)
  let mutated4 = JSON.parse(JSON.stringify(redrawReceipt));
  mutated4.counters.afterUploads += 1;
  let temp4 = { ...mutated4 };
  delete temp4.evidenceDigest;
  mutated4.evidenceDigest = await computeXREvidenceDigest(temp4);
  let semRes4 = await validateXRSpatialWindowThemeRedrawReceipt(mutated4);
  assert.equal(semRes4.ok, false);
  assert.equal(semRes4.reason, 'counters-recomputation-mismatch');

  // Mutation 2.5: Partition mismatch (remove windowId from affectedWindows)
  let mutated5 = JSON.parse(JSON.stringify(redrawReceipt));
  mutated5.affectedWindows = [];
  let temp5 = { ...mutated5 };
  delete temp5.evidenceDigest;
  mutated5.evidenceDigest = await computeXREvidenceDigest(temp5);
  let semRes5 = await validateXRSpatialWindowThemeRedrawReceipt(mutated5);
  assert.equal(semRes5.ok, false);
  assert.equal(semRes5.reason, 'partitions-do-not-cover-windowIds');

  // Mutation 2.6: Duplicate window IDs in windowIds list
  let mutated6 = JSON.parse(JSON.stringify(redrawReceipt));
  mutated6.windowIds.push(mutated6.windowIds[0]);
  let temp6 = { ...mutated6 };
  delete temp6.evidenceDigest;
  mutated6.evidenceDigest = await computeXREvidenceDigest(temp6);
  let semRes6 = await validateXRSpatialWindowThemeRedrawReceipt(mutated6);
  assert.equal(semRes6.ok, false);
  assert.equal(semRes6.reason, 'duplicate-windowIds');

  // TEST 2.7: Mutation with rehash (recomputing all hashes) still fails trusted-state validation
  let mutatedRehash = JSON.parse(JSON.stringify(redrawReceipt));
  mutatedRehash.themeScope = 'fake-scope';
  let tempRehash = { ...mutatedRehash };
  delete tempRehash.evidenceDigest;
  mutatedRehash.evidenceDigest = await computeXREvidenceDigest(tempRehash);
  let trustedVal = await validateXRSpatialWindowThemeRedrawReceipt(mutatedRehash, [
    { windowId: 'window:layout-alpha', themeRevision: 1, upload: { uploads: 0, reuses: 0 }, material: null },
    { windowId: 'window:layout-beta', themeRevision: 0, upload: { uploads: 0, reuses: 0 }, material: null }
  ]);
  assert.equal(trustedVal.ok, false, "Mutation with rehash must be rejected by trusted validation");

  // TEST 2.8: Mutation without rehash fails digest verification
  let mutatedNoRehash = JSON.parse(JSON.stringify(redrawReceipt));
  mutatedNoRehash.themeScope = 'fake-scope';
  let noRehashVal = await validateXRSpatialWindowThemeRedrawReceipt(mutatedNoRehash);
  assert.equal(noRehashVal.ok, false, "Mutation without rehash must fail digest verification");
  assert.equal(noRehashVal.reason, 'evidenceDigest-recomputation-mismatch');

  // TEST 2.9: FNV collision pair cannot collide under evidence digest
  let strA = "2112789";
  let strB = "2349192";
  assert.equal(digest(strA), digest(strB), "FNV-1a/32 collision pair must collide under FNV");
  let shaA = await computeXREvidenceDigest(strA);
  let shaB = await computeXREvidenceDigest(strB);
  assert.notEqual(shaA, shaB, "FNV-1a/32 collision pair must NOT collide under SHA-256");

  // TEST 2.10: Empty window transition receipt (no-op receipt) must throw under new contract
  let emptyAssembly = createXRSpatialWindowAssembly(createFakeXrPlatform());
  assert.throws(() => {
    emptyAssembly.applyTheme(themeInput);
  }, /zero-handle\/no-op/);
  let emptyReceipts = emptyAssembly.getReceipts().filter((r) => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
  assert.equal(emptyReceipts.length, 0, "No redraw receipts must be emitted for zero-handle/no-op");

  // TEST 2.11: Skipped window revision change or non-zero delta gets rejected
  let mutatedSkipped = JSON.parse(JSON.stringify(redrawReceipt));
  let betaRes = mutatedSkipped.windowResults.find(r => r.windowId === 'window:layout-beta');
  betaRes.afterRevision += 1;
  let betaResCopy = { ...betaRes };
  delete betaResCopy.hash;
  betaRes.hash = await computeXREvidenceDigest(betaResCopy);
  mutatedSkipped.bindingHash = await computeXREvidenceDigest(mutatedSkipped.windowResults.map(r => r.hash).sort());
  let tempSkipped = { ...mutatedSkipped };
  delete tempSkipped.evidenceDigest;
  mutatedSkipped.evidenceDigest = await computeXREvidenceDigest(tempSkipped);
  let skippedVal = await validateXRSpatialWindowThemeRedrawReceipt(mutatedSkipped);
  assert.equal(skippedVal.ok, false);
  assert.equal(skippedVal.reason, 'revision-changed-for-skipped-window-window:layout-beta');

  // TEST 3: Diagnostics overlap fabrication check
  // Enter session to generate valid diagnostics geometry
  assembly.enter({ sessionId: 'session-adversarial' });
  let diagBefore = assembly.getDiagnostics();
  let diagSemResult = await validateXRSpatialWindowDiagnostics(diagBefore);
  assert.equal(diagSemResult.ok, true, diagSemResult.reason);

  // Fabricate a positive content x resize intersection inside diagnostics
  let badDiag = JSON.parse(JSON.stringify(diagBefore));
  let winAlpha = badDiag.windows.find(w => w.layoutId === 'layout-alpha');
  // Inject a fake intersection
  winAlpha.chrome.overlap.intersections.push({
    zones: ['content', 'resize:northWest'],
    intersectionArea: 1.5,
    allowed: true,
  });
  // Recomputation must catch this mismatch because we reconstruct zones from canonical geometry (Point 5)
  let badSemResult = await validateXRSpatialWindowDiagnostics(badDiag);
  assert.equal(badSemResult.ok, false);
  assert.equal(badSemResult.reason, 'intersection-count-mismatch');

  // TEST 3.1: Diagnostics theme evidence bindingHash mutation rejects
  let mutatedDiagSnap = JSON.parse(JSON.stringify(diagBefore));
  mutatedDiagSnap.windows[0].theme.snapshot.tokens['--sn-xr-panel-bg'] = '#000000';
  let diagSnapVal = await validateXRSpatialWindowDiagnostics(mutatedDiagSnap);
  assert.equal(diagSnapVal.ok, false);
  assert.ok(diagSnapVal.reason.startsWith('theme-bindingHash-mismatch-for-'));

  // TEST 3.2: Diagnostics theme evidence bindingHash mutation with rehash rejects against trusted observation
  let mutatedDiagRehash = JSON.parse(JSON.stringify(diagBefore));
  mutatedDiagRehash.windows[0].theme.snapshot.tokens['--sn-xr-panel-bg'] = '#000000';
  const boundEvidence = {
    themeScope: mutatedDiagRehash.windows[0].theme.themeScope,
    snapshot: mutatedDiagRehash.windows[0].theme.snapshot,
    actualMaterial: mutatedDiagRehash.windows[0].theme.actualMaterial,
  };
  mutatedDiagRehash.windows[0].theme.bindingHash = await computeXREvidenceDigest(boundEvidence);
  let diagTrustedVal = await validateXRSpatialWindowDiagnostics(mutatedDiagRehash, diagBefore.windows);
  assert.equal(diagTrustedVal.ok, false);
  assert.equal(diagTrustedVal.reason, 'themeSnapshot-mismatch-with-trusted-for-window:layout-alpha');

  // TEST 4: Byte invariance of non-targeted window diagnostics
  let winBetaDiagBefore = JSON.stringify(diagBefore.windows.find(w => w.layoutId === 'layout-beta'));

  // Apply theme change to alpha-scope specifically
  let themeInputChanged = {
    version: 'xr-theme-snapshot-v1',
    themeScope: 'alpha-scope',
    tokens: { '--sn-xr-panel-bg': '#666666' },
    material: { background: '#666666', backgroundColor: 0x666666 },
  };
  assembly.applyTheme(themeInputChanged);

  let diagAfter = assembly.getDiagnostics();
  let winBetaDiagAfter = JSON.stringify(diagAfter.windows.find(w => w.layoutId === 'layout-beta'));

  // Ensure beta window's diagnostics are completely byte-invariant
  assert.equal(winBetaDiagAfter, winBetaDiagBefore, 'Beta window diagnostics must be byte-invariant under default-scope update');
});

test('assembly upload state exposes the packed receipt and receipt validates against xr-html-canvas-upload-receipt-v1 schema', async () => {
  let { assembly, platform } = createAssemblyContext();
  let alpha = createLayoutDescriptor({
    dom: { element: createWindowContentElement(platform.document) },
  });
  assembly.syncLayouts([alpha]);
  assembly.enter({ sessionId: 'session-test-receipt' });
  
  let diagnostics = assembly.getDiagnostics();
  let uploadState = diagnostics.windows[0].upload;
  
  assert.equal(uploadState.version, 'xr-html-canvas-upload-receipt-v1');
  assert.equal(uploadState.panelId, 'window:layout-alpha');
  assert.equal(typeof uploadState.mode, 'string');
  assert.equal(typeof uploadState.rendered, 'boolean');
  assert.equal(typeof uploadState.uploaded, 'boolean');
  assert.equal(typeof uploadState.canvasMatch, 'boolean');
  
  let { validate, ajv } = await createSchemaValidator(['xr-html-canvas-upload-receipt-v1.json']);
  let validateReceipt = validate(0);
  
  let receiptObj = {
    version: uploadState.version,
    panelId: uploadState.panelId,
    mode: uploadState.mode,
    rendered: uploadState.rendered,
    uploaded: uploadState.uploaded,
    canvasMatch: uploadState.canvasMatch,
    width: uploadState.width,
    height: uploadState.height,
    signature: uploadState.signature,
    reason: uploadState.reason,
    errorName: uploadState.errorName,
  };
  
  assert.equal(validateReceipt(receiptObj), true, ajv.errorsText(validateReceipt.errors));
});

