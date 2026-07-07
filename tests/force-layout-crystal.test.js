import assert from 'node:assert/strict';
import test from 'node:test';

import { ForceLayout } from '../canvas/ForceLayout.js';

function distance(point) {
  return Math.hypot(point.x, point.y);
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function radius(node) {
  return Math.max(node.w || 1, node.h || 1) / 2;
}

function overlapPairs(nodes, positions, padding = 8) {
  let pairs = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      let a = nodes[i];
      let b = nodes[j];
      let pa = positions[a.id];
      let pb = positions[b.id];
      if (!pa || !pb) continue;
      let minDistance = radius(a) + radius(b) + padding;
      if (distanceBetween(pa, pb) < minDistance) pairs.push([a.id, b.id]);
    }
  }
  return pairs;
}

function spokeCount(points, spokes) {
  let angles = points.map((point) => {
    let angle = Math.atan2(point.y, point.x);
    return angle < 0 ? angle + Math.PI * 2 : angle;
  });
  let step = (Math.PI * 2) / spokes;
  let best = 0;
  for (const offset of angles) {
    let used = new Set();
    for (const angle of angles) {
      let normalized = angle - offset;
      while (normalized < 0) normalized += Math.PI * 2;
      used.add(Math.round(normalized / step) % spokes);
    }
    best = Math.max(best, used.size);
  }
  return best;
}

function makeLeaf(id) {
  return { id, w: 36, h: 36 };
}

test('crystal fallback lays media leaves around a visible hub without overlaps', () => {
  let leaves = Array.from({ length: 9 }, (_, index) => makeLeaf(`leaf-${index}`));
  let nodes = [
    { id: 'hub', isGroup: true, children: leaves.map((leaf) => leaf.id), mass: 2, w: 84, h: 84 },
    ...leaves,
  ];
  let edges = leaves.map((leaf) => ({ from: 'hub', to: leaf.id }));
  let groups = {
    hub: nodes.map((node) => node.id),
  };
  let options = {
    layoutAlgorithm: 'crystal',
    activeVisualNodeId: 'hub',
    crystalRingDistance: 72,
    crystalSpokes: 6,
    crystalAngleJitter: 0,
  };

  let first = ForceLayout.createFallbackPositions({ nodes, edges, groups, options });
  let second = ForceLayout.createFallbackPositions({ nodes, edges, groups, options });

  assert.deepEqual(second, first);
  assert.deepEqual(first.hub, { x: 0, y: 0 });
  assert.deepEqual(overlapPairs(nodes, first, 10), []);

  let leafPositions = leaves.map((leaf) => first[leaf.id]);
  for (const leaf of leaves) {
    assert.ok(distance(first[leaf.id]) >= radius(nodes[0]) + radius(leaf) + 16);
  }
  assert.ok(spokeCount(leafPositions, 6) >= 5);
  assert.ok(Math.max(...leafPositions.map(distance)) > Math.min(...leafPositions.map(distance)) + 30);
});

test('crystal fallback keeps multiple mass centers visible with local leaves', () => {
  let nodes = [
    { id: 'root', isGroup: true, children: ['root-a', 'root-b'], mass: 2, w: 86, h: 86 },
    { id: 'root-a', w: 34, h: 34 },
    { id: 'root-b', w: 34, h: 34 },
    { id: 'project', isGroup: true, children: ['project-a', 'project-b', 'project-c'], mass: 1.8, w: 70, h: 70 },
    { id: 'project-a', w: 38, h: 38 },
    { id: 'project-b', w: 38, h: 38 },
    { id: 'project-c', w: 38, h: 38 },
  ];
  let edges = [
    { from: 'root', to: 'project' },
    { from: 'root', to: 'root-a' },
    { from: 'root', to: 'root-b' },
    { from: 'project', to: 'project-a' },
    { from: 'project', to: 'project-b' },
    { from: 'project', to: 'project-c' },
  ];
  let groups = {
    root: ['root', 'root-a', 'root-b'],
    project: ['project', 'project-a', 'project-b', 'project-c'],
  };
  let options = {
    layoutAlgorithm: 'crystal',
    activeVisualNodeId: 'root',
    crystalRingDistance: 70,
    crystalSpokes: 6,
    crystalAngleJitter: 0,
  };

  let positions = ForceLayout.createFallbackPositions({ nodes, edges, groups, options });

  assert.deepEqual(overlapPairs(nodes, positions, 10), []);
  assert.ok(distance(positions.project) > 160);
  for (const id of ['project-a', 'project-b', 'project-c']) {
    assert.ok(distanceBetween(positions.project, positions[id]) < distance(positions[id]));
    assert.ok(distanceBetween(positions.project, positions[id]) >= radius(nodes[3]) + radius(nodes.find((node) => node.id === id)) + 16);
  }
});

test('crystal fallback handles empty, single, and explicit center positions', () => {
  assert.deepEqual(ForceLayout.createFallbackPositions({
    nodes: [],
    options: { layoutAlgorithm: 'crystal' },
  }), {});

  assert.deepEqual(ForceLayout.createFallbackPositions({
    nodes: [{ id: 'only' }],
    options: { layoutAlgorithm: 'crystal' },
  }), { only: { x: 0, y: 0 } });

  let positions = ForceLayout.createFallbackPositions({
    nodes: [
      { id: 'root', x: 40, y: -20, isGroup: true, children: ['child'], w: 60, h: 60 },
      { id: 'child', w: 30, h: 30 },
    ],
    edges: [{ from: 'root', to: 'child' }],
    options: { layoutAlgorithm: 'crystal', crystalRingDistance: 80 },
  });

  assert.deepEqual(positions.root, { x: 40, y: -20 });
  assert.ok(Number.isFinite(positions.child.x));
  assert.ok(Number.isFinite(positions.child.y));
  assert.ok(Math.hypot(positions.child.x - 40, positions.child.y + 20) >= 60);
});

test('crystal fallback uses the active visual node as the growth root', () => {
  let positions = ForceLayout.createFallbackPositions({
    nodes: [
      { id: 'heavy-hub', isGroup: true, children: ['a', 'b', 'active'], mass: 2, w: 76, h: 76 },
      { id: 'a', w: 32, h: 32 },
      { id: 'b', w: 32, h: 32 },
      { id: 'active', isGroup: true, children: ['active-child'], w: 64, h: 64 },
      { id: 'active-child', w: 32, h: 32 },
    ],
    edges: [
      { from: 'heavy-hub', to: 'a' },
      { from: 'heavy-hub', to: 'b' },
      { from: 'heavy-hub', to: 'active' },
      { from: 'active', to: 'active-child' },
    ],
    groups: {
      'heavy-hub': ['heavy-hub', 'a', 'b', 'active'],
      active: ['active', 'active-child'],
    },
    options: {
      layoutAlgorithm: 'crystal',
      activeVisualNodeId: 'active',
      crystalRingDistance: 72,
    },
  });

  assert.deepEqual(positions.active, { x: 0, y: 0 });
  assert.ok(distance(positions['heavy-hub']) > 150);
  assert.ok(distance(positions['active-child']) >= 64);
});

test('crystal runtime fallback starts from non-overlapping target geometry', async () => {
  let NativeWorker = globalThis.Worker;
  let nativeRaf = globalThis.requestAnimationFrame;
  let nativeCancelRaf = globalThis.cancelAnimationFrame;
  let nativeWarn = console.warn;
  globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
  console.warn = () => {};

  let nodes = [
    { id: 'hub', isGroup: true, children: ['a', 'b', 'mid'], mass: 2, w: 84, h: 84 },
    { id: 'a', w: 36, h: 36 },
    { id: 'b', w: 36, h: 36 },
    { id: 'mid', w: 36, h: 36 },
    { id: 'leaf', w: 36, h: 36 },
  ];

  try {
    delete globalThis.Worker;
    let force = new ForceLayout('/missing-force-worker.js');
    let firstTick = new Promise((resolve, reject) => {
      let timer = setTimeout(() => {
        force.stop();
        reject(new Error('crystal runtime fallback did not tick'));
      }, 300);
      force.onTick = (positions) => {
        clearTimeout(timer);
        force.stop();
        resolve(positions);
      };
    });

    force.start({
      nodes,
      edges: [
        { from: 'hub', to: 'mid' },
        { from: 'mid', to: 'leaf' },
      ],
      groups: {
        hub: ['hub', 'a', 'b', 'mid'],
      },
      options: {
        mode: 'continuous',
        layoutAlgorithm: 'crystal',
        activeVisualNodeId: 'hub',
        crystalRingDistance: 72,
        crystalSpokes: 6,
        crystalAngleJitter: 0,
        alphaDecay: 0.5,
        brownian: 0,
      },
    });

    let positions = await firstTick;
    assert.deepEqual(overlapPairs(nodes, positions, 8), []);
    assert.ok(distance(positions.mid) > 60);
    assert.ok(distance(positions.a) > 60);
    assert.ok(distance(positions.b) > 60);
    assert.ok(distance(positions.leaf) > 60);
  } finally {
    console.warn = nativeWarn;
    if (NativeWorker) {
      globalThis.Worker = NativeWorker;
    } else {
      delete globalThis.Worker;
    }
    if (nativeRaf) {
      globalThis.requestAnimationFrame = nativeRaf;
    } else {
      delete globalThis.requestAnimationFrame;
    }
    if (nativeCancelRaf) {
      globalThis.cancelAnimationFrame = nativeCancelRaf;
    } else {
      delete globalThis.cancelAnimationFrame;
    }
  }
});
