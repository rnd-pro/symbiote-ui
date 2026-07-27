import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  XR_SPATIAL_WINDOW_PLACEMENT_VERSION,
  XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY,
  XR_SPATIAL_WINDOW_PLACEMENT_DEFAULTS,
  computeXRSpatialWindowDefaultSlotPose,
  resolveXRSpatialWindowDefaultPlacement,
} from '../xr/spatial-window-placement.js';
import { createXRSpatialWindowAssembly } from '../xr/spatial-window-assembly.js';
import { computeXRPanelChromeLayout } from '../xr/panel-frame.js';
import {
  createXRPanelPoseComfortSummary,
  createXRPanelFacingSummary,
} from '../xr/layout-projection.js';
import {
  createFakeXrPlatform,
  createFakeThree,
  createWindowContentElement,
} from './xr-spatial-window-fixtures.js';

let directory = dirname(fileURLToPath(import.meta.url));
let DEFAULT_SIZE = [0.8, 0.45];

function createAssemblyContext() {
  let platform = createFakeXrPlatform({ mode: 'webgl' });
  let assembly = createXRSpatialWindowAssembly({
    globalThis: platform.globalThis,
    document: platform.document,
    THREE: createFakeThree(),
  });
  return { platform, assembly };
}

function createUnplacedDescriptor(platform, layoutId, overrides = {}) {
  return {
    layoutId,
    contentKind: 'dom',
    title: `${layoutId} window`,
    sizeMeters: [0.8, 0.45],
    viewport: { width: 1280, height: 720 },
    dom: { element: createWindowContentElement(platform.document) },
    ...overrides,
  };
}

function footprintsOverlap(firstPose, firstSize, secondPose, secondSize) {
  let horizontal = Math.hypot(
    firstPose.position[0] - secondPose.position[0],
    firstPose.position[2] - secondPose.position[2],
  );
  let vertical = Math.abs(firstPose.position[1] - secondPose.position[1]);
  return horizontal < (firstSize[0] + secondSize[0]) / 2
    && vertical < (firstSize[1] + secondSize[1]) / 2;
}

function assertComfortable(pose, sizeMeters, label) {
  let comfort = createXRPanelPoseComfortSummary({ position: pose.position, size: sizeMeters });
  assert.equal(comfort.status, 'comfortable', `${label} must stay inside the comfort envelope: ${comfort.warnings}`);
  let facing = createXRPanelFacingSummary({ position: pose.position, rotation: pose.rotation });
  assert.equal(facing.status, 'aligned', `${label} must face the viewer: ${facing.warnings}`);
  assert.ok(
    pose.position[1] - sizeMeters[1] / 2 > 0,
    `${label} must keep its bottom edge above the floor`,
  );
}

function assertPairwiseNonOverlapping(entries) {
  for (let first = 0; first < entries.length; first += 1) {
    for (let next = first + 1; next < entries.length; next += 1) {
      assert.equal(
        footprintsOverlap(entries[first].pose, entries[first].size, entries[next].pose, entries[next].size),
        false,
        `windows ${first} and ${next} must not overlap`,
      );
    }
  }
}

function placeSequentially(count, sizeMeters = DEFAULT_SIZE) {
  let occupied = [];
  let placements = [];
  for (let index = 0; index < count; index += 1) {
    let placement = resolveXRSpatialWindowDefaultPlacement({ occupied, sizeMeters });
    if (!placement.ok) {
      placements.push(placement);
      break;
    }
    placements.push(placement);
    occupied.push({ position: [...placement.pose.position], sizeMeters: [...sizeMeters] });
  }
  return placements;
}

test('default slot lattice is a bounded deterministic 3D arrangement', () => {
  let first = computeXRSpatialWindowDefaultSlotPose(0);
  assert.deepEqual(first, {
    position: [-0.45, 1.561411, -1.907643],
    rotation: [0, 13.273043, 0],
  }, 'slot 0 anchors the primary arc deterministically');
  assert.deepEqual(first, computeXRSpatialWindowDefaultSlotPose(0), 'slot pose computation is deterministic');
  assert.equal(Object.isFrozen(first), true);

  let mirrored = computeXRSpatialWindowDefaultSlotPose(1);
  assert.equal(mirrored.position[0], 0.45, 'inner slots mirror on the arc');
  assert.equal(mirrored.position[2], first.position[2]);
  assert.equal(mirrored.rotation[1], -first.rotation[1]);

  let slots = [];
  for (let slot = 0; slot < XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY; slot += 1) {
    slots.push(computeXRSpatialWindowDefaultSlotPose(slot));
  }
  assert.equal(new Set(slots.map((slot) => JSON.stringify(slot))).size, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);
  for (let [index, slot] of slots.entries()) {
    assertComfortable(slot, DEFAULT_SIZE, `slot ${index}`);
  }
  assertPairwiseNonOverlapping(slots.map((pose) => ({ pose, size: DEFAULT_SIZE })));

  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(-1), /non-negative integer/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0.5), /non-negative integer/);
  assert.throws(
    () => computeXRSpatialWindowDefaultSlotPose(XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY),
    /capacity/,
    'the lattice never generates slots beyond the bounded capacity',
  );
});

test('placement options are validated including integral positive slotsPerRow', () => {
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { slotsPerRow: 2.5 }), /slotsPerRow/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { slotsPerRow: 0 }), /slotsPerRow/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { slotsPerRow: '4' }), /slotsPerRow/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { innerSlotsPerRow: 1.5 }), /innerSlotsPerRow/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { radius: -1 }), /radius/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { radius: Number.NaN }), /radius/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { innerRadius: 3 }), /innerRadius/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { slotSpacing: 0 }), /slotSpacing/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { rowSpacing: -0.1 }), /rowSpacing/);
  assert.throws(() => computeXRSpatialWindowDefaultSlotPose(0, { floorMargin: -1 }), /floorMargin/);
  assert.throws(() => resolveXRSpatialWindowDefaultPlacement({ sizeMeters: [0] }), /sizeMeters/);
});

test('every count 1..24 of default-size windows places comfortably without overlap', () => {
  for (let count = 1; count <= XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY; count += 1) {
    let placements = placeSequentially(count);
    assert.equal(placements.length, count);
    for (let [index, placement] of placements.entries()) {
      assert.equal(placement.ok, true, `window ${index + 1} of ${count} must resolve`);
      assert.equal(placement.slot, index, 'unblocked windows fill slots in preference order');
      assert.equal(placement.capacity, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);
      assert.deepEqual(placement.pose, computeXRSpatialWindowDefaultSlotPose(index));
      assertComfortable(placement.pose, DEFAULT_SIZE, `window ${index + 1} of ${count}`);
    }
    assertPairwiseNonOverlapping(placements.map((placement) => ({ pose: placement.pose, size: DEFAULT_SIZE })));
  }
});

test('capacity exhaustion is structured data, never an unsafe slot', () => {
  let placements = placeSequentially(XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY + 1);
  assert.equal(placements.length, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY + 1);
  let exhausted = placements.at(-1);
  assert.equal(exhausted.ok, false);
  assert.equal(exhausted.reason, 'placement-capacity-exhausted');
  assert.equal(exhausted.capacity, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);
  assert.equal(exhausted.pose, null, 'exhaustion never fabricates a pose');
  assert.equal(Object.isFrozen(exhausted), true);
});

test('default placement resolves the first slot not blocked by occupied windows', () => {
  let slotZero = computeXRSpatialWindowDefaultSlotPose(0);
  let empty = resolveXRSpatialWindowDefaultPlacement({ occupied: [] });
  assert.equal(empty.version, XR_SPATIAL_WINDOW_PLACEMENT_VERSION);
  assert.equal(empty.ok, true);
  assert.equal(empty.slot, 0);
  assert.deepEqual(empty.pose, slotZero);
  assert.equal(Object.isFrozen(empty), true);

  let afterZero = resolveXRSpatialWindowDefaultPlacement({
    occupied: [{ position: [...slotZero.position], sizeMeters: [0.8, 0.45] }],
  });
  assert.equal(afterZero.slot, 1);
  assert.deepEqual(afterZero.pose, computeXRSpatialWindowDefaultSlotPose(1));

  let lowerLevel = computeXRSpatialWindowDefaultSlotPose(XR_SPATIAL_WINDOW_PLACEMENT_DEFAULTS.slotsPerRow);
  let verticallySeparated = resolveXRSpatialWindowDefaultPlacement({
    occupied: [{ position: [...lowerLevel.position], sizeMeters: [0.8, 0.45] }],
  });
  assert.equal(verticallySeparated.slot, 0, 'a window one level below must not block the primary-level slot');

  assert.throws(
    () => resolveXRSpatialWindowDefaultPlacement({ occupied: [{ position: [0, 'x', -1] }] }),
    /finite/,
  );
});

test('wide and tall windows place by their actual size and exhaust structurally', () => {
  let wide = placeSequentially(XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY + 1, [1.6, 0.45]);
  let widePlaced = wide.filter((placement) => placement.ok);
  assert.equal(widePlaced.length, 8, 'wide windows fill a reduced geometry-aware capacity');
  for (let placement of widePlaced) assertComfortable(placement.pose, [1.6, 0.45], 'wide window');
  assertPairwiseNonOverlapping(widePlaced.map((placement) => ({ pose: placement.pose, size: [1.6, 0.45] })));
  assert.equal(wide.at(-1).ok, false);
  assert.equal(wide.at(-1).reason, 'placement-capacity-exhausted');

  let tall = placeSequentially(3, [0.8, 1.2]);
  assert.equal(tall.length, 3);
  for (let placement of tall) {
    assert.equal(placement.ok, true);
    assertComfortable(placement.pose, [0.8, 1.2], 'tall window');
  }
  assertPairwiseNonOverlapping(tall.map((placement) => ({ pose: placement.pose, size: [0.8, 1.2] })));

  let oversized = placeSequentially(2, [3.2, 2.4]);
  assert.equal(oversized[0].ok, true, 'a maximum-size window still fits one slot');
  assert.equal(oversized[1].ok, false, 'a second maximum-size window is structured exhaustion');
  assert.equal(oversized[1].reason, 'placement-capacity-exhausted');
});

test('every count 1..24 of unplaced descriptors produces comfortable non-overlapping windows', () => {
  for (let count = 1; count <= XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY; count += 1) {
    let { platform, assembly } = createAssemblyContext();
    let layouts = Array.from({ length: count }, (_, index) => (
      createUnplacedDescriptor(platform, `layout-${index}`)
    ));
    let sync = assembly.syncLayouts(layouts);
    assert.equal(sync.ok, true, `sync of ${count} must succeed`);
    assert.equal(sync.added.length, count);
    let windows = assembly.listWindows();
    assert.equal(windows.length, count);
    for (let entry of windows) {
      assertComfortable(entry.pose, entry.sizeMeters, entry.windowId);
    }
    assertPairwiseNonOverlapping(windows.map((entry) => ({ pose: entry.pose, size: entry.sizeMeters })));
    let slots = assembly.getDiagnostics().windows.map((entry) => entry.defaultSlot);
    assert.equal(new Set(slots).size, count, `slots must be unique live ownership for ${count}`);
    assert.deepEqual([...slots].sort((a, b) => a - b), Array.from({ length: count }, (_, index) => index));
  }
});

test('the 25th unplaced descriptor is a structured sync error, not an unsafe window', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = Array.from({ length: XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY + 1 }, (_, index) => (
    createUnplacedDescriptor(platform, `layout-${index}`)
  ));
  let sync = assembly.syncLayouts(layouts);
  assert.equal(sync.ok, false);
  assert.equal(sync.added.length, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);
  assert.equal(assembly.listWindows().length, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);
  assert.equal(sync.errors.length, 1);
  assert.equal(sync.errors[0].reason, 'placement-capacity-exhausted');
  assert.equal(sync.errors[0].capacity, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);
  let windows = assembly.listWindows();
  assertPairwiseNonOverlapping(windows.map((entry) => ({ pose: entry.pose, size: entry.sizeMeters })));
});

test('mixed batches resolve explicit poses before assigning defaults regardless of order', () => {
  let slotZero = computeXRSpatialWindowDefaultSlotPose(0);
  let orders = [
    ['layout-a', 'layout-explicit', 'layout-b'],
    ['layout-explicit', 'layout-a', 'layout-b'],
    ['layout-a', 'layout-b', 'layout-explicit'],
  ];
  let outcomes = [];
  for (let order of orders) {
    let { platform, assembly } = createAssemblyContext();
    let descriptors = order.map((layoutId) => (
      layoutId === 'layout-explicit'
        ? createUnplacedDescriptor(platform, layoutId, {
          pose: { position: [...slotZero.position], rotation: [...slotZero.rotation] },
        })
        : createUnplacedDescriptor(platform, layoutId)
    ));
    let sync = assembly.syncLayouts(descriptors);
    assert.equal(sync.ok, true);
    let explicit = assembly.getWindow('window:layout-explicit');
    assert.deepEqual(explicit.pose, slotZero, 'the explicit pose wins its exact slot');
    assert.equal(explicit.defaultSlot, null);
    outcomes.push(new Map(assembly.listWindows().map((entry) => [entry.layoutId, entry])));
  }
  for (let entry of outcomes[0].keys()) {
    assert.deepEqual(
      outcomes[1].get(entry).pose,
      outcomes[0].get(entry).pose,
      `descriptor reorder must not change the pose of ${entry}`,
    );
    assert.deepEqual(
      outcomes[2].get(entry).pose,
      outcomes[0].get(entry).pose,
      `descriptor reorder must not change the pose of ${entry}`,
    );
  }
  let windows = [...outcomes[0].values()];
  assertPairwiseNonOverlapping(windows.map((entry) => ({ pose: entry.pose, size: entry.sizeMeters })));
  assert.notDeepEqual(
    outcomes[0].get('layout-a').pose,
    slotZero,
    'an unplaced descriptor never steals an explicit pose position',
  );
});

test('explicit descriptor poses win exactly and block overlapping default slots', () => {
  let { platform, assembly } = createAssemblyContext();
  let explicitPose = {
    position: [0.123456, 1.5, -1.111111],
    rotation: [0, -33.333333, 0],
  };
  let sync = assembly.syncLayouts([
    createUnplacedDescriptor(platform, 'layout-a'),
    createUnplacedDescriptor(platform, 'layout-explicit', {
      pose: { position: [...explicitPose.position], rotation: [...explicitPose.rotation] },
    }),
    createUnplacedDescriptor(platform, 'layout-b'),
  ]);
  assert.equal(sync.ok, true);

  let explicit = assembly.getWindow('window:layout-explicit');
  assert.deepEqual(explicit.pose.position, explicitPose.position, 'explicit position survives byte-equivalently');
  assert.deepEqual(explicit.pose.rotation, explicitPose.rotation, 'explicit rotation survives byte-equivalently');
  assert.equal(explicit.defaultSlot, null, 'descriptor-posed windows hold no default slot');

  assert.equal(assembly.getWindow('window:layout-a').defaultSlot, 0);
  assert.equal(assembly.getWindow('window:layout-b').defaultSlot, 1);
});

test('the same ordered initial descriptors produce deterministic placement across assemblies', () => {
  let first = createAssemblyContext();
  let second = createAssemblyContext();
  let layoutIds = ['layout-a', 'layout-b', 'layout-c', 'layout-d'];
  first.assembly.syncLayouts(layoutIds.map((layoutId) => createUnplacedDescriptor(first.platform, layoutId)));
  second.assembly.syncLayouts(layoutIds.map((layoutId) => createUnplacedDescriptor(second.platform, layoutId)));
  assert.deepEqual(
    first.assembly.listWindows().map((entry) => entry.pose),
    second.assembly.listWindows().map((entry) => entry.pose),
  );
});

test('stable re-sync keeps assigned default poses and reports zero changes', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = ['layout-a', 'layout-b', 'layout-c', 'layout-d']
    .map((layoutId) => createUnplacedDescriptor(platform, layoutId));
  assembly.syncLayouts(layouts);
  let before = assembly.listWindows().map((entry) => entry.pose);

  let resync = assembly.syncLayouts(layouts.map((layout) => ({ ...layout })));
  assert.deepEqual(resync.added, []);
  assert.deepEqual(resync.updated, []);
  assert.deepEqual(resync.removed, []);
  assert.equal(resync.unchanged.length, 4);
  assert.deepEqual(assembly.listWindows().map((entry) => entry.pose), before);
  assert.equal(assembly.getDiagnostics().counters.uploads, 0, 'stable re-sync performs no uploads');
});

test('opening one new unplaced layout mid-session moves no existing window', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = ['layout-a', 'layout-b', 'layout-c', 'layout-d']
    .map((layoutId) => createUnplacedDescriptor(platform, layoutId));
  assembly.syncLayouts(layouts);
  assembly.enter({ sessionId: 'session-placement' });
  let before = new Map(assembly.listWindows().map((entry) => [entry.windowId, entry.pose]));

  let receipt = assembly.syncLayouts([...layouts, createUnplacedDescriptor(platform, 'layout-e')]);
  assert.deepEqual(receipt.added, ['window:layout-e']);
  assert.deepEqual(receipt.updated, []);
  assert.equal(receipt.unchanged.length, 4);
  for (let [windowId, pose] of before.entries()) {
    assert.deepEqual(assembly.getWindow(windowId).pose, pose, `${windowId} must not move`);
  }
  let added = assembly.getWindow('window:layout-e');
  assert.equal(added.defaultSlot, 4);
  assert.deepEqual(added.pose, computeXRSpatialWindowDefaultSlotPose(4));
  assertComfortable(added.pose, added.sizeMeters, 'window:layout-e');
});

test('a recreated unplaced identity reuses a freed default slot without moving live windows', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = ['layout-a', 'layout-b', 'layout-c', 'layout-d']
    .map((layoutId) => createUnplacedDescriptor(platform, layoutId));
  assembly.syncLayouts(layouts);

  let narrowed = assembly.syncLayouts([layouts[0], layouts[1], layouts[3]]);
  assert.deepEqual(narrowed.removed, ['window:layout-c']);
  let liveBefore = new Map(assembly.listWindows().map((entry) => [entry.windowId, entry.pose]));

  let recreated = assembly.syncLayouts([
    layouts[0],
    layouts[1],
    createUnplacedDescriptor(platform, 'layout-c'),
    layouts[3],
  ]);
  assert.deepEqual(recreated.added, ['window:layout-c']);
  assert.equal(recreated.unchanged.length, 3);
  for (let [windowId, pose] of liveBefore.entries()) {
    assert.deepEqual(assembly.getWindow(windowId).pose, pose, `${windowId} must not move`);
  }
  let restored = assembly.getWindow('window:layout-c');
  assert.equal(restored.defaultSlot, 2, 'the freed slot is reused');
  assert.deepEqual(restored.pose, computeXRSpatialWindowDefaultSlotPose(2));
});

test('settled poses survive stable re-sync and release their default slot', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = ['layout-a', 'layout-b']
    .map((layoutId) => createUnplacedDescriptor(platform, layoutId));
  assembly.syncLayouts(layouts);
  assembly.enter({ sessionId: 'session-drag' });

  let settled = assembly.settleWindowPose('window:layout-a', {
    position: [2.4, 1.3, -1.2],
    rotation: [0, -40, 0],
  });
  assert.equal(settled.ok, true);

  let resync = assembly.syncLayouts(layouts.map((layout) => ({ ...layout })));
  assert.equal(resync.unchanged.length, 2);
  assert.deepEqual(
    assembly.getWindow('window:layout-a').pose.position,
    [2.4, 1.3, -1.2],
    'a user-settled pose must not snap back to a default slot on stable re-sync',
  );

  let opened = assembly.syncLayouts([...layouts, createUnplacedDescriptor(platform, 'layout-c')]);
  assert.deepEqual(opened.added, ['window:layout-c']);
  let added = assembly.getWindow('window:layout-c');
  assert.equal(added.defaultSlot, 0, 'the vacated slot is free once the dragged window no longer occupies it');
  assert.deepEqual(added.pose, computeXRSpatialWindowDefaultSlotPose(0));
  assert.deepEqual(assembly.getWindow('window:layout-a').pose.position, [2.4, 1.3, -1.2]);

  let slots = assembly.getDiagnostics().windows.map((entry) => entry.defaultSlot);
  assert.equal(
    new Set(slots.filter((slot) => slot !== null)).size,
    slots.filter((slot) => slot !== null).length,
    'defaultSlot diagnostics never claim duplicate live ownership',
  );
  assert.equal(
    assembly.getDiagnostics().windows.find((entry) => entry.windowId === 'window:layout-a').defaultSlot,
    null,
    'a window that vacated its slot does not claim slot ownership',
  );
});

test('reset restores a free canonical pose and re-resolves around freed-slot reuse', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = ['layout-a', 'layout-b']
    .map((layoutId) => createUnplacedDescriptor(platform, layoutId));
  assembly.syncLayouts(layouts);
  assembly.enter({ sessionId: 'session-reset' });

  assembly.settleWindowPose('window:layout-a', {
    position: [2.4, 1.3, -1.2],
    rotation: [0, 0, 0],
  });
  let restored = assembly.resetWindowPose('window:layout-a');
  assert.equal(restored.ok, true);
  assert.deepEqual(
    assembly.getWindow('window:layout-a').pose,
    computeXRSpatialWindowDefaultSlotPose(0),
    'reset returns to the canonical slot while it is free',
  );

  assembly.settleWindowPose('window:layout-a', {
    position: [2.4, 1.3, -1.2],
    rotation: [0, 0, 0],
  });
  let opened = assembly.syncLayouts([...layouts, createUnplacedDescriptor(platform, 'layout-c')]);
  assert.deepEqual(opened.added, ['window:layout-c']);
  assert.equal(assembly.getWindow('window:layout-c').defaultSlot, 0, 'layout-c reuses the vacated slot');

  let reresolved = assembly.resetWindowPose('window:layout-a');
  assert.equal(reresolved.ok, true);
  let resetPose = assembly.getWindow('window:layout-a').pose;
  assert.notDeepEqual(
    resetPose,
    computeXRSpatialWindowDefaultSlotPose(0),
    'reset must never overlap the live window now occupying the stale canonical slot',
  );
  assert.deepEqual(
    resetPose,
    computeXRSpatialWindowDefaultSlotPose(2),
    'reset re-resolves the lowest safe free slot instead',
  );
  assertComfortable(resetPose, DEFAULT_SIZE, 're-resolved reset pose');
  let windows = assembly.listWindows();
  assertPairwiseNonOverlapping(windows.map((entry) => ({ pose: entry.pose, size: entry.sizeMeters })));
  let slots = assembly.getDiagnostics().windows.map((entry) => entry.defaultSlot);
  assert.equal(
    new Set(slots.filter((slot) => slot !== null)).size,
    slots.filter((slot) => slot !== null).length,
    'slot ownership stays unique after reset re-resolution',
  );
});

test('chrome reset action follows the same safe re-resolution contract', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = ['layout-a', 'layout-b']
    .map((layoutId) => createUnplacedDescriptor(platform, layoutId));
  assembly.syncLayouts(layouts);
  assembly.enter({ sessionId: 'session-chrome-reset' });
  assembly.settleWindowPose('window:layout-a', {
    position: [2.4, 1.3, -1.2],
    rotation: [0, 0, 0],
  });
  assembly.syncLayouts([...layouts, createUnplacedDescriptor(platform, 'layout-c')]);
  assert.equal(assembly.getWindow('window:layout-c').defaultSlot, 0);

  let zones = computeXRPanelChromeLayout(DEFAULT_SIZE, { closable: true });
  let resetZone = zones.actions.reset;
  let hitU = resetZone.x + resetZone.width / 2;
  let hitV = resetZone.y + resetZone.height / 2;
  let pose = assembly.getWindow('window:layout-a').pose;
  let receipt = assembly.routeRay({
    origin: [
      pose.position[0] + (hitU - 0.5) * DEFAULT_SIZE[0],
      pose.position[1] + (0.5 - hitV) * DEFAULT_SIZE[1],
      0,
    ],
    direction: [0, 0, -1],
  }, { type: 'pointerdown', source: 'xr-controller', sourceId: 'controller-right', sessionId: 'session-chrome-reset' });
  assert.equal(receipt.zone, 'action');
  assert.equal(receipt.action, 'reset');
  assert.equal(receipt.ok, true, 'chrome reset re-resolves instead of overlapping');
  assert.deepEqual(
    assembly.getWindow('window:layout-a').pose,
    computeXRSpatialWindowDefaultSlotPose(2),
    'chrome reset lands on the same safe slot as the public reset path',
  );
  let windows = assembly.listWindows();
  assertPairwiseNonOverlapping(windows.map((entry) => ({ pose: entry.pose, size: entry.sizeMeters })));
});

test('reset returns structured failure when every safe slot is occupied', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = Array.from({ length: XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY }, (_, index) => (
    createUnplacedDescriptor(platform, `layout-${index}`)
  ));
  assembly.syncLayouts(layouts);
  assembly.enter({ sessionId: 'session-reset-full' });

  let draggedPose = { position: [2.4, 1.3, -1.2], rotation: [0, 0, 0] };
  assembly.settleWindowPose('window:layout-0', draggedPose);
  let blocker = computeXRSpatialWindowDefaultSlotPose(0);
  let occupied = assembly.syncLayouts([
    ...layouts,
    createUnplacedDescriptor(platform, 'layout-blocker', {
      pose: { position: [...blocker.position], rotation: [...blocker.rotation] },
    }),
  ]);
  assert.deepEqual(occupied.added, ['window:layout-blocker']);
  assert.equal(assembly.listWindows().length, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY + 1);

  let reset = assembly.resetWindowPose('window:layout-0');
  assert.equal(reset.ok, false, 'reset fails structurally when no safe slot exists');
  assert.equal(reset.reason, 'placement-capacity-exhausted');
  assert.deepEqual(
    assembly.getWindow('window:layout-0').pose.position,
    draggedPose.position,
    'a failed reset leaves the live pose untouched',
  );
  let windows = assembly.listWindows();
  assertPairwiseNonOverlapping(windows.map((entry) => ({ pose: entry.pose, size: entry.sizeMeters })));
});

test('explicit pose updates stay authoritative and reset stays coherent', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = ['layout-a', 'layout-b']
    .map((layoutId) => createUnplacedDescriptor(platform, layoutId));
  assembly.syncLayouts(layouts);
  assembly.enter({ sessionId: 'session-explicit' });

  let explicitPose = { position: [-0.111, 1.5, -1.15], rotation: [0, -5, 0] };
  let updated = assembly.syncLayouts([
    createUnplacedDescriptor(platform, 'layout-a', {
      pose: { position: [...explicitPose.position], rotation: [...explicitPose.rotation] },
    }),
    layouts[1],
  ]);
  assert.deepEqual(updated.updated, ['window:layout-a']);
  assert.deepEqual(assembly.getWindow('window:layout-a').pose.position, explicitPose.position);
  assert.equal(assembly.getWindow('window:layout-a').defaultSlot, null);

  assembly.settleWindowPose('window:layout-a', { position: [2.4, 1.3, -1.2], rotation: [0, 0, 0] });
  let restored = assembly.resetWindowPose('window:layout-a');
  assert.equal(restored.ok, true);
  assert.deepEqual(
    assembly.getWindow('window:layout-a').pose.position,
    explicitPose.position,
    'reset returns an explicitly posed window to its latest explicit pose',
  );

  let occupied = assembly.syncLayouts([
    layouts[0],
    createUnplacedDescriptor(platform, 'layout-b', {
      pose: { position: [...explicitPose.position], rotation: [...explicitPose.rotation] },
    }),
  ]);
  assert.deepEqual(occupied.updated, ['window:layout-b']);
  let reresolved = assembly.resetWindowPose('window:layout-a');
  assert.equal(reresolved.ok, true, 'reset re-resolves when the explicit canonical pose is occupied');
  assert.deepEqual(
    assembly.getWindow('window:layout-a').pose,
    computeXRSpatialWindowDefaultSlotPose(0),
    'the re-resolved pose is the lowest safe default slot',
  );
  let windows = assembly.listWindows();
  assertPairwiseNonOverlapping(windows.map((entry) => ({ pose: entry.pose, size: entry.sizeMeters })));
});

test('poses persist across release/re-entry without moving settled windows', () => {
  let { platform, assembly } = createAssemblyContext();
  let layouts = ['layout-a', 'layout-b', 'layout-c']
    .map((layoutId) => createUnplacedDescriptor(platform, layoutId));
  assembly.syncLayouts(layouts);
  assembly.enter({ sessionId: 'session-persist' });
  assembly.settleWindowPose('window:layout-a', {
    position: [2.4, 1.3, -1.2],
    rotation: [0, 0, 0],
  });
  let before = new Map(assembly.listWindows().map((entry) => [entry.windowId, entry.pose]));

  let released = assembly.releaseSession();
  assert.equal(released.ok, true);
  let adopted = assembly.adoptSession({ sessionId: 'session-persist' });
  assert.equal(adopted.ok, true);
  for (let [windowId, pose] of before.entries()) {
    assert.deepEqual(
      assembly.getWindow(windowId).pose,
      pose,
      `${windowId} pose must survive release/re-entry`,
    );
  }

  let exited = assembly.exit();
  assert.equal(exited.ok, true);
  let reentered = assembly.enter({ sessionId: 'session-persist' });
  assert.equal(reentered.details.poseRestore.restored, true);
  for (let [windowId, pose] of before.entries()) {
    assert.deepEqual(
      assembly.getWindow(windowId).pose,
      pose,
      `${windowId} pose must survive exit/re-entry`,
    );
  }
  let slots = assembly.getDiagnostics().windows.map((entry) => entry.defaultSlot);
  assert.equal(
    new Set(slots.filter((slot) => slot !== null)).size,
    slots.filter((slot) => slot !== null).length,
    'slot ownership stays unique across re-entry',
  );
});

test('placement contract is exposed through package exports, barrel, discover, and renderer metadata', async () => {
  let pkg = JSON.parse(await readFile(resolve(directory, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.exports['./xr/spatial-window-placement']);

  let barrel = await import('../xr/index.js');
  assert.equal(typeof barrel.computeXRSpatialWindowDefaultSlotPose, 'function');
  assert.equal(typeof barrel.resolveXRSpatialWindowDefaultPlacement, 'function');
  assert.equal(barrel.XR_SPATIAL_WINDOW_PLACEMENT_VERSION, XR_SPATIAL_WINDOW_PLACEMENT_VERSION);
  assert.equal(barrel.XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY, XR_SPATIAL_WINDOW_PLACEMENT_CAPACITY);

  let subpath = await import('../xr/spatial-window-placement.js');
  assert.equal(typeof subpath.resolveXRSpatialWindowDefaultPlacement, 'function');

  let { cmdDiscover } = await import('../discover.js');
  let discovery = await cmdDiscover();
  let entrypoint = discovery.exports.entrypoints.find((entry) => (
    entry.specifier === 'symbiote-ui/xr/spatial-window-placement'
  ));
  assert.ok(entrypoint, 'discover lists the placement entrypoint');
  assert.equal(entrypoint.kind, 'node-safe');
  let webxr = discovery.manifest.renderers.find((renderer) => renderer.name === 'webxr');
  assert.ok(webxr.capabilities.includes('xr-spatial-window-default-placement'));
});
