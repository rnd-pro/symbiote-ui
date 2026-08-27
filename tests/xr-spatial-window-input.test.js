import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import { createXRSpatialWindowAssembly } from '../xr/spatial-window-assembly.js';
import {
  XR_SPATIAL_WINDOW_SCROLL_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_SELECTION_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_FOCUS_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_VIEWPORT_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_RELAY_RECEIPT_VERSION,
  XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION,
} from '../xr/spatial-window-contract.js';
import { createXRThreeWebXRAdapter } from '../xr/three-webxr-adapter.js';
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
  let platform = createFakeXrPlatform({ mode: options.mode ?? 'webgl', ...options.platform });
  let THREE = options.noThree ? null : createFakeThree();
  let assembly = createXRSpatialWindowAssembly({
    globalThis: platform.globalThis,
    document: platform.document,
    THREE,
    ...(options.assemblyOptions || {}),
  });
  return { platform, THREE, assembly };
}

function createEnteredContext(options = {}) {
  let context = createAssemblyContext(options);
  let layoutIds = options.layouts || ['layout-alpha'];
  let descriptors = layoutIds.map((layoutId, index) => createLayoutDescriptor({
    layoutId,
    title: `${layoutId} window`,
    pose: { position: [layoutIds.length > 1 ? index * 0.9 - 0.45 : 0, 1.35, -1.6], rotation: [0, 0, 0] },
    dom: { element: createWindowContentElement(context.platform.document, options.dom || {}) },
  }));
  context.assembly.syncLayouts(descriptors);
  context.assembly.enter({ sessionId: options.sessionId || 'session-1' });
  return context;
}

function centerRay(position = [0, 1.35, -1.6]) {
  return {
    origin: [position[0], position[1], 0],
    direction: [0, 0, -1],
  };
}

test('wheel over content scrolls the live DOM with capture identity and a data-only receipt', () => {
  let { assembly, platform } = createEnteredContext();
  let element = assembly.getWindowElement('window:layout-alpha');
  let scroller = element.querySelector('.fake-scroll-region');
  assert.equal(scroller.scrollTop, 0);
  let canvasPaintBefore = element.parentNode.paintRequests || 0;

  let receipt = assembly.routeRay(centerRay(), {
    type: 'wheel',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    delta: { x: 0, y: 120 },
  });
  assert.equal(receipt.version, XR_SPATIAL_WINDOW_RELAY_RECEIPT_VERSION);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.routed, true);
  assert.equal(receipt.zone, 'content');
  let scroll = receipt.relay.scroll;
  assert.equal(scroll.version, XR_SPATIAL_WINDOW_SCROLL_RECEIPT_VERSION);
  assert.equal(scroll.ok, true);
  assert.equal(scroll.phase, 'end');
  assert.equal(scroll.kind, 'wheel');
  assert.deepEqual(scroll.capture, {
    sourceId: 'controller-right',
    sessionId: 'session-1',
    pointerId: 'controller-right',
  });
  assert.deepEqual(scroll.point, { x: 0.5, y: 0.5 });
  assert.equal(scroll.delta.y, 120);
  assert.equal(scroll.scroll.targetId, 'scroll-region');
  assert.equal(scroll.scroll.before.top, 0);
  assert.equal(scroll.scroll.after.top, 120);
  assert.equal(scroll.scroll.applied.y, 120);
  assert.equal(scroll.paintRequested, true);
  assert.equal(scroller.scrollTop, 120, 'live DOM scroll offset moved');
  assert.ok((element.parentNode.paintRequests || 0) > canvasPaintBefore, 'paint requested on the window canvas');
  assert.equal(Object.isFrozen(scroll), true);
  assert.doesNotThrow(() => JSON.stringify(scroll));
});

test('hand-sourced wheel shares controller scroll semantics', () => {
  let { assembly } = createEnteredContext();
  let element = assembly.getWindowElement('window:layout-alpha');
  let scroller = element.querySelector('.fake-scroll-region');

  let receipt = assembly.routeRay(centerRay(), {
    type: 'wheel',
    source: 'xr-hand',
    sourceId: 'hand-left',
    sessionId: 'session-1',
    delta: { x: 0, y: 40 },
  });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.relay.scroll.ok, true);
  assert.equal(receipt.relay.scroll.capture.sourceId, 'hand-left');
  assert.equal(scroller.scrollTop, 40);
});

test('scroll invalidates only the affected window texture', () => {
  let { assembly } = createEnteredContext({ layouts: ['layout-alpha', 'layout-beta'] });
  let before = assembly.getDiagnostics();
  let alphaBefore = before.windows.find((entry) => entry.layoutId === 'layout-alpha').upload.uploads;
  let betaBefore = before.windows.find((entry) => entry.layoutId === 'layout-beta').upload.uploads;

  assembly.routeRay({
    origin: [-0.45, 1.35, 0],
    direction: [0, 0, -1],
  }, {
    type: 'wheel',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    delta: { x: 0, y: 60 },
  });

  let after = assembly.getDiagnostics();
  let alphaAfter = after.windows.find((entry) => entry.layoutId === 'layout-alpha').upload;
  let betaAfter = after.windows.find((entry) => entry.layoutId === 'layout-beta').upload;
  assert.equal(alphaAfter.uploads, alphaBefore + 1, 'scrolled window re-uploaded exactly once');
  assert.equal(betaAfter.uploads, betaBefore, 'unaffected window performs zero uploads');
  assert.equal(after.counters.scrollGestures, 1);
});

test('scroll offsets survive exit and re-entry with the same live DOM', () => {
  let { assembly } = createEnteredContext();
  let element = assembly.getWindowElement('window:layout-alpha');
  let scroller = element.querySelector('.fake-scroll-region');
  assembly.routeRay(centerRay(), {
    type: 'wheel',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    delta: { x: 0, y: 96 },
  });
  assert.equal(scroller.scrollTop, 96);

  assembly.exit();
  let reenter = assembly.enter({ sessionId: 'session-2' });
  assert.equal(reenter.ok, true);
  let sameElement = assembly.getWindowElement('window:layout-alpha');
  assert.equal(sameElement, element, 're-entry keeps the same live DOM subtree');
  assert.equal(sameElement.querySelector('.fake-scroll-region').scrollTop, 96, 'scroll offset preserved');
});

test('select-drag scroll runs begin/update/end with derived deltas and strict capture', () => {
  let { assembly } = createEnteredContext();
  let element = assembly.getWindowElement('window:layout-alpha');
  let scroller = element.querySelector('.fake-scroll-region');

  let stray = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'update',
    source: 'xr-hand',
    sourceId: 'hand-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.4 },
  });
  assert.equal(stray.relay.scroll.ok, false);
  assert.equal(stray.relay.scroll.reason, 'scroll-not-active');

  let begin = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'begin',
    source: 'xr-hand',
    sourceId: 'hand-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.6 },
  });
  assert.equal(begin.relay.scroll.ok, true);
  assert.equal(begin.relay.scroll.phase, 'begin');
  assert.equal(begin.relay.scroll.kind, 'drag');

  let secondBegin = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'begin',
    source: 'xr-hand',
    sourceId: 'hand-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.6 },
  });
  assert.equal(secondBegin.relay.scroll.ok, false);
  assert.equal(secondBegin.relay.scroll.reason, 'scroll-already-active');

  let update = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'update',
    source: 'xr-hand',
    sourceId: 'hand-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.4 },
  });
  assert.equal(update.relay.scroll.ok, true);
  assert.equal(update.relay.scroll.phase, 'update');
  assert.equal(update.relay.scroll.delta.y, 144, 'grab delta derived from normalized point movement');
  assert.equal(scroller.scrollTop, 144);

  let foreignUpdate = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'update',
    source: 'xr-hand',
    sourceId: 'hand-left',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.3 },
  });
  assert.equal(foreignUpdate.relay.scroll.ok, false, 'another source cannot drive the capture');

  let end = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'end',
    source: 'xr-hand',
    sourceId: 'hand-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.35 },
  });
  assert.equal(end.relay.scroll.ok, true);
  assert.equal(end.relay.scroll.phase, 'end');
  assert.equal(end.relay.scroll.totals.y, 180);
  assert.equal(scroller.scrollTop, 180);
});

test('scroll cancel releases the capture and rejects further updates', () => {
  let { assembly } = createEnteredContext();
  let element = assembly.getWindowElement('window:layout-alpha');
  let scroller = element.querySelector('.fake-scroll-region');

  assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'begin',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.5 },
  });
  assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'update',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.45 },
  });
  let cancel = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'cancel',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.45 },
  });
  assert.equal(cancel.relay.scroll.ok, true);
  assert.equal(cancel.relay.scroll.phase, 'cancel');
  assert.equal(cancel.relay.scroll.totals.y, 36, 'applied deltas are not rewound on cancel');
  assert.equal(scroller.scrollTop, 36);

  let after = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'update',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.4 },
  });
  assert.equal(after.relay.scroll.ok, false);
  assert.equal(after.relay.scroll.reason, 'scroll-not-active');
});

test('text selection drag emits capture and a selection receipt read from the live DOM', () => {
  let { assembly, platform } = createEnteredContext();

  let down = assembly.routeRay(centerRay(), {
    type: 'pointerdown',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    buttons: { primary: true, secondary: false },
    point: { x: 0.2, y: 0.5 },
  });
  assert.equal(down.ok, true);
  assert.deepEqual(down.relay.capture, {
    sourceId: 'controller-right',
    sessionId: 'session-1',
    pointerId: 'controller-right',
    phase: 'begin',
  });

  let move = assembly.routeRay(centerRay(), {
    type: 'pointermove',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    buttons: { primary: true, secondary: false },
    point: { x: 0.45, y: 0.5 },
  });
  assert.equal(move.relay.capture.phase, 'update');

  platform.simulateTextSelection({ text: 'window', anchorOffset: 0, focusOffset: 6 });
  let up = assembly.routeRay(centerRay(), {
    type: 'pointerup',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    buttons: { primary: false, secondary: false },
    point: { x: 0.6, y: 0.5 },
  });
  let selection = up.relay.selection;
  assert.equal(selection.version, XR_SPATIAL_WINDOW_SELECTION_RECEIPT_VERSION);
  assert.equal(selection.ok, true);
  assert.equal(selection.phase, 'end');
  assert.deepEqual(selection.startPoint, { x: 0.2, y: 0.5 });
  assert.deepEqual(selection.point, { x: 0.6, y: 0.5 });
  assert.deepEqual(selection.capture, {
    sourceId: 'controller-right',
    sessionId: 'session-1',
    pointerId: 'controller-right',
  });
  assert.equal(selection.selection.text, 'window', 'selection read from the live DOM, never synthesized');
  assert.equal(selection.selection.anchorOffset, 0);
  assert.equal(selection.selection.focusOffset, 6);
  assert.equal(Object.isFrozen(selection), true);

  let diagnostics = assembly.getDiagnostics();
  assert.equal(diagnostics.windows[0].relay.selections, 1);
  assert.equal(diagnostics.counters.selectionGestures, 1);
});

test('selection cancel releases capture and reports the cancel as data', () => {
  let { assembly } = createEnteredContext();
  assembly.routeRay(centerRay(), {
    type: 'pointerdown',
    source: 'xr-hand',
    sourceId: 'hand-left',
    sessionId: 'session-1',
    buttons: { primary: true, secondary: false },
  });
  let cancel = assembly.routeRay(centerRay(), {
    type: 'pointercancel',
    source: 'xr-hand',
    sourceId: 'hand-left',
    sessionId: 'session-1',
  });
  let selection = cancel.relay.selection;
  assert.equal(selection.version, XR_SPATIAL_WINDOW_SELECTION_RECEIPT_VERSION);
  assert.equal(selection.phase, 'cancel');
  assert.equal(selection.ok, false);
  assert.equal(selection.reason, 'selection-cancelled');
  assert.equal(selection.selection, null);

  let up = assembly.routeRay(centerRay(), {
    type: 'pointerup',
    source: 'xr-hand',
    sourceId: 'hand-left',
    sessionId: 'session-1',
  });
  assert.equal(up.relay.selection.ok, false);
  assert.equal(up.relay.selection.reason, 'selection-not-active');
});

test('selection evidence stays explicit when the platform lacks a selection API', () => {
  let { assembly } = createEnteredContext({ platform: { selectionApi: false } });
  assembly.routeRay(centerRay(), {
    type: 'pointerdown',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    buttons: { primary: true, secondary: false },
  });
  let up = assembly.routeRay(centerRay(), {
    type: 'pointerup',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(up.relay.selection.ok, true);
  assert.equal(up.relay.selection.selection, null);
  assert.equal(up.relay.selection.reason, 'selection-api-unavailable');
});

test('focusWindowContent focuses the real editable target and reports dom-focus IME handoff', () => {
  let { assembly, platform } = createEnteredContext({ dom: { draft: 'draft text' } });
  let element = assembly.getWindowElement('window:layout-alpha');
  let input = element.querySelector('input');

  let receipt = assembly.focusWindowContent('window:layout-alpha', {
    target: '#draft-input',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(receipt.version, XR_SPATIAL_WINDOW_FOCUS_RECEIPT_VERSION);
  assert.equal(receipt.action, 'content-focus');
  assert.equal(receipt.ok, true);
  assert.equal(receipt.target.tagName, 'input');
  assert.equal(receipt.target.editable, true);
  assert.equal(receipt.target.focusable, true);
  assert.equal(receipt.focused, true);
  assert.equal(platform.document.activeElement, input, 'the real live DOM target holds focus');
  assert.equal(receipt.ime.mode, 'dom-focus');
  assert.equal(receipt.ime.reason, null);
  assert.equal(receipt.ime.handoff.editable, true);
  assert.equal(receipt.ime.handoff.hasValue, true);
  assert.equal(receipt.ime.handoff.valueLength, 10);
  assert.equal('value' in receipt.ime.handoff, false, 'handoff never clones form values into receipts');
  assert.equal('text' in receipt.ime.handoff, false, 'no synthesized keyboard text anywhere');
  assert.equal(Object.isFrozen(receipt), true);

  let diagnostics = assembly.getDiagnostics();
  assert.equal(diagnostics.windows[0].contentFocus.targetId, 'draft-input');
  assert.equal(diagnostics.counters.contentFocusHandoffs, 1);
});

test('focusWindowContent on non-editable content returns structured dom-overlay fallback data', () => {
  let { assembly } = createEnteredContext();
  let receipt = assembly.focusWindowContent('window:layout-alpha', {
    target: '.fake-scroll-region',
    source: 'xr-hand',
    sourceId: 'hand-left',
    sessionId: 'session-1',
  });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.target.editable, false);
  assert.equal(receipt.ime.mode, 'dom-overlay');
  assert.equal(receipt.ime.reason, 'target-not-editable');
  assert.equal(receipt.ime.handoff.editable, false);
  assert.equal(receipt.focused, false);
});

test('content blur and cancel release the real DOM focus as data', () => {
  let { assembly, platform } = createEnteredContext();
  let element = assembly.getWindowElement('window:layout-alpha');
  let input = element.querySelector('input');

  assembly.focusWindowContent('window:layout-alpha', {
    target: '#draft-input',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(platform.document.activeElement, input);

  let blur = assembly.blurWindowContent('window:layout-alpha', {
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(blur.action, 'content-blur');
  assert.equal(blur.ok, true);
  assert.equal(blur.focused, false);
  assert.equal(platform.document.activeElement, platform.nativeDocument.body);

  let secondBlur = assembly.blurWindowContent('window:layout-alpha', { source: 'xr-controller' });
  assert.equal(secondBlur.ok, true);
  assert.equal(secondBlur.reason, 'no-content-focus');

  assembly.focusWindowContent('window:layout-alpha', {
    target: '#draft-input',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  let cancel = assembly.cancelWindowContentFocus('window:layout-alpha', {
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(cancel.action, 'content-focus-cancel');
  assert.equal(cancel.ok, true);
  assert.equal(cancel.focused, false);
  assert.equal(platform.document.activeElement, platform.nativeDocument.body);
  assert.equal(assembly.getDiagnostics().windows[0].contentFocus, null);
});

test('content focus rejects unknown windows and targets as data', () => {
  let { assembly } = createEnteredContext();
  let missingWindow = assembly.focusWindowContent('window:nope', { target: '#draft-input' });
  assert.equal(missingWindow.ok, false);
  assert.equal(missingWindow.reason, 'window-not-found');

  let missingTarget = assembly.focusWindowContent('window:layout-alpha', { target: '#nope' });
  assert.equal(missingTarget.ok, false);
  assert.equal(missingTarget.reason, 'target-not-found');
  assert.equal(missingTarget.ime.mode, 'unavailable');
});

test('updateWindowViewport updates the live DOM viewport without remount and preserves content state', () => {
  let { assembly, platform } = createEnteredContext({ dom: { draft: 'keep me' } });
  let element = assembly.getWindowElement('window:layout-alpha');
  let scroller = element.querySelector('.fake-scroll-region');
  let input = element.querySelector('input');
  scroller.scrollTop = 48;
  assembly.focusWindowContent('window:layout-alpha', {
    target: '#draft-input',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  platform.simulateTextSelection({ text: 'keep', anchorOffset: 0, focusOffset: 4 });

  let receipt = assembly.updateWindowViewport('window:layout-alpha', {
    viewport: { width: 960, height: 540 },
  });
  assert.equal(receipt.version, XR_SPATIAL_WINDOW_VIEWPORT_RECEIPT_VERSION);
  assert.equal(receipt.action, 'viewport-update');
  assert.equal(receipt.ok, true);
  assert.deepEqual(receipt.viewport, { width: 960, height: 540 });
  assert.deepEqual(receipt.previousViewport, { width: 1280, height: 720 });
  assert.equal(receipt.remounted, false);
  assert.equal(receipt.rolledBack, false);
  assert.equal(receipt.paintRequested, true);
  assert.deepEqual(receipt.preserved, {
    focus: true,
    formValues: true,
    selection: true,
    scroll: true,
  });
  assert.equal(receipt.texture.uploaded, true);
  assert.equal(receipt.texture.width, 960, 'texture evidence carries measured pixels');
  assert.equal(receipt.texture.height, 540);

  assert.equal(assembly.getWindowElement('window:layout-alpha'), element, 'live DOM subtree is not replaced');
  assert.equal(element.style.width, '960px');
  assert.equal(element.style.height, '540px');
  assert.equal(input.value, 'keep me', 'form values preserved');
  assert.equal(scroller.scrollTop, 48, 'scroll offsets preserved');
  assert.equal(platform.document.activeElement, input, 'focus preserved');
  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.deepEqual(windowEntry.viewport, { width: 960, height: 540 });
  assert.equal(windowEntry.upload.width, 960);
  assert.equal(windowEntry.upload.height, 540);
  assert.equal(assembly.getDiagnostics().counters.viewportUpdates, 1);
});

test('updateWindowViewport validates inputs as data', () => {
  let { assembly } = createEnteredContext();
  let missing = assembly.updateWindowViewport('window:nope', { viewport: { width: 960, height: 540 } });
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'window-not-found');

  let invalid = assembly.updateWindowViewport('window:layout-alpha', { viewport: { width: 10, height: 10 } });
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, 'invalid-viewport');

  let missingViewport = assembly.updateWindowViewport('window:layout-alpha', {});
  assert.equal(missingViewport.ok, false);
  assert.equal(missingViewport.reason, 'invalid-viewport');
});

test('resize commit keeps mesh and element identity and reports measured texture pixels', async () => {
  let { assembly } = createEnteredContext();
  let meshBefore = assembly.getWindowMesh('window:layout-alpha');
  let elementBefore = assembly.getWindowElement('window:layout-alpha');

  assembly.beginResize('window:layout-alpha', { handle: 'southEast' });
  assembly.previewResize('window:layout-alpha', [1.2, 0.675]);
  let commit = await assembly.commitResize('window:layout-alpha');
  assert.equal(commit.version, XR_SPATIAL_WINDOW_RESIZE_RECEIPT_VERSION);
  assert.equal(commit.ok, true);
  assert.equal(commit.texture.uploaded, true);
  assert.equal(commit.texture.width, 1920, 'commit receipt reports measured texture width');
  assert.equal(commit.texture.height, 1080, 'commit receipt reports measured texture height');

  assert.equal(assembly.getWindowMesh('window:layout-alpha'), meshBefore, 'commit swaps geometry on the same mesh');
  assert.equal(meshBefore.geometry.parameters.width, 1.2);
  assert.equal(assembly.getWindowElement('window:layout-alpha'), elementBefore, 'commit never remounts the live DOM');
  assert.equal(elementBefore.style.width, '1920px');

  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.equal(windowEntry.upload.width, 1920);
  assert.equal(windowEntry.upload.height, 1080);
});

test('three adapter exposes a per-panel size operation without scene churn', () => {
  let THREE = createFakeThree();
  let adapter = createXRThreeWebXRAdapter({ THREE });
  adapter.setScene({
    panels: [{
      id: 'panel-1',
      position: [0, 1.35, -1.6],
      rotation: [0, 0, 0],
      size: [0.8, 0.45],
    }],
  });
  let mesh = adapter.getPanelMesh('panel-1');
  assert.equal(mesh.geometry.parameters.width, 0.8);

  let result = adapter.setPanelSize('panel-1', [1.2, 0.675]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.sizeMeters, [1.2, 0.675]);
  assert.equal(adapter.getPanelMesh('panel-1'), mesh, 'same mesh, no scene churn');
  assert.equal(mesh.geometry.parameters.width, 1.2);
  assert.equal(mesh.geometry.parameters.height, 0.675);
  assert.equal(mesh.userData.panel.size[0], 1.2);

  let missing = adapter.setPanelSize('panel-nope', [1, 1]);
  assert.equal(missing.ok, false);
  assert.equal(missing.reason, 'panel-not-found');
});

test('new receipts validate against their public schemas', async () => {
  let { ajv, validate } = await createSchemaValidator([
    'xr-spatial-window-scroll-receipt-v1.json',
    'xr-spatial-window-selection-receipt-v1.json',
    'xr-spatial-window-focus-receipt-v1.json',
    'xr-spatial-window-viewport-receipt-v1.json',
    'xr-spatial-window-diagnostics-v1.json',
    'xr-spatial-window-relay-receipt-v1.json',
    'xr-spatial-window-resize-receipt-v1.json',
  ]);
  let { assembly, platform } = createEnteredContext({ dom: { draft: 'abc' } });

  let wheel = assembly.routeRay(centerRay(), {
    type: 'wheel',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    delta: { x: 0, y: 24 },
  });
  assert.equal(validate(0)(wheel.relay.scroll), true, ajv.errorsText(validate(0).errors));
  assert.equal(validate(5)(wheel), true, ajv.errorsText(validate(5).errors));

  assembly.routeRay(centerRay(), {
    type: 'pointerdown',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    buttons: { primary: true, secondary: false },
  });
  platform.simulateTextSelection({ text: 'a', anchorOffset: 0, focusOffset: 1 });
  let up = assembly.routeRay(centerRay(), {
    type: 'pointerup',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(validate(1)(up.relay.selection), true, ajv.errorsText(validate(1).errors));
  assert.equal(validate(5)(up), true, ajv.errorsText(validate(5).errors));

  let focus = assembly.focusWindowContent('window:layout-alpha', {
    target: '#draft-input',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(validate(2)(focus), true, ajv.errorsText(validate(2).errors));

  let viewport = assembly.updateWindowViewport('window:layout-alpha', {
    viewport: { width: 1024, height: 576 },
  });
  assert.equal(validate(3)(viewport), true, ajv.errorsText(validate(3).errors));

  assembly.beginResize('window:layout-alpha', { handle: 'southEast' });
  assembly.previewResize('window:layout-alpha', [1.0, 0.5625]);
  let commit = await assembly.commitResize('window:layout-alpha');
  assert.equal(validate(6)(commit), true, ajv.errorsText(validate(6).errors));

  let diagnostics = assembly.getDiagnostics();
  assert.equal(validate(4)(diagnostics), true, ajv.errorsText(validate(4).errors));

  let badScroll = JSON.parse(JSON.stringify(wheel.relay.scroll));
  badScroll.phase = 'sideways';
  assert.equal(validate(0)(badScroll), false);
  let badFocus = JSON.parse(JSON.stringify(focus));
  badFocus.ime.mode = 'synthesized-keyboard';
  assert.equal(validate(2)(badFocus), false);
});

test('discover publishes the input and viewport capabilities', async () => {
  let { cmdDiscover } = await import('../discover.js');
  let discovery = await cmdDiscover();
  let webxr = discovery.manifest.renderers.find((renderer) => renderer.name === 'webxr');
  for (let capability of [
    'xr-spatial-window-scroll-relay',
    'xr-spatial-window-text-selection-capture',
    'xr-spatial-window-content-focus-ime-handoff',
    'xr-spatial-window-viewport-update',
  ]) {
    assert.ok(webxr.capabilities.includes(capability), `webxr capability ${capability}`);
  }
  let three = discovery.manifest.renderers.find((renderer) => renderer.name === 'three-webxr');
  assert.ok(three.capabilities.includes('three-panel-size-update'));
  let schemaVersions = discovery.manifest.schemas.map((schema) => schema.version);
  for (let version of [
    'xr-spatial-window-scroll-receipt-v1',
    'xr-spatial-window-selection-receipt-v1',
    'xr-spatial-window-focus-receipt-v1',
    'xr-spatial-window-viewport-receipt-v1',
  ]) {
    assert.ok(schemaVersions.includes(version), `published schema ${version}`);
  }
});

test('pointercancel releases an active scroll capture for the same source', () => {
  let { assembly } = createEnteredContext();
  assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'begin',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.5 },
  });
  let cancel = assembly.routeRay(centerRay(), {
    type: 'pointercancel',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
  });
  assert.equal(cancel.ok, true);
  assert.equal(cancel.relay.scroll.version, XR_SPATIAL_WINDOW_SCROLL_RECEIPT_VERSION);
  assert.equal(cancel.relay.scroll.phase, 'cancel');
  assert.equal(cancel.relay.scroll.ok, true);

  let after = assembly.routeRay(centerRay(), {
    type: 'scroll',
    phase: 'update',
    source: 'xr-controller',
    sourceId: 'controller-right',
    sessionId: 'session-1',
    point: { x: 0.5, y: 0.4 },
  });
  assert.equal(after.relay.scroll.ok, false);
  assert.equal(after.relay.scroll.reason, 'scroll-not-active');
});

test('updateWindowViewport rolls back transactionally when the texture upload fails', () => {
  let { assembly, platform } = createEnteredContext({ mode: 'canvas2d' });
  let element = assembly.getWindowElement('window:layout-alpha');
  platform.setDrawFails(true);

  let receipt = assembly.updateWindowViewport('window:layout-alpha', {
    viewport: { width: 960, height: 540 },
  });
  assert.equal(receipt.version, XR_SPATIAL_WINDOW_VIEWPORT_RECEIPT_VERSION);
  assert.equal(receipt.ok, false);
  assert.equal(receipt.rolledBack, true);
  assert.equal(receipt.texture.uploaded, false);
  assert.deepEqual(receipt.viewport, { width: 1280, height: 720 });

  let windowEntry = assembly.getWindow('window:layout-alpha');
  assert.deepEqual(windowEntry.viewport, { width: 1280, height: 720 }, 'failed update keeps the committed viewport');
  assert.equal(element.style.width, '1280px', 'failed update restores the committed CSS viewport');
});
