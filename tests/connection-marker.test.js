import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  drawCanvasMarker,
  projectConnectionMarkerGeometry,
  resolveConnectionMarker,
  resolveContainmentJunctions,
} from '../canvas/ConnectionMarker.js';
import {
  isCanvasConnectionPathCacheValid,
  shouldRenderConnectionDetail,
} from '../canvas/CanvasConnectionRenderer.js';
import {
  reconcileSvgJunctionMarkers,
  renderConnectionBatch,
  updateSvgMarker,
} from '../canvas/ConnectionRenderer.js';
import { normalizeGraphEdge } from '../graph/model.js';
import { getGraphSchema } from '../manifest/graph-schema.js';
import { CONNECTION_MARKER_METRICS } from '../tokens/scale.js';

test('resolveConnectionMarker flow placement on longest straight segment', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 }, // Seg 1: L=100
    { x: 100, y: 50 }, // Seg 2: L=50
  ];
  const conn = {
    id: 'test-flow',
    direction: 'forward',
    design: {
      marker: {
        role: 'flow'
      }
    }
  };

  const marker = resolveConnectionMarker(points, conn, {
    portClearance: 10,
    bendClearance: 5,
    minMarkerLength: 10,
  });

  // Longest segment is Seg 1 (length 100)
  // Safe interval after excluding portClearance (10) from start, and bendClearance (5) from end:
  // [10, 95] -> midpoint = (10 + 95) / 2 = 52.5
  assert.equal(marker.type, 'flow');
  assert.equal(marker.x, 52.5);
  assert.equal(marker.y, 0);
  assert.equal(marker.angle, 0);
  assert.equal(marker.direction, 'forward');
});

test('resolveConnectionMarker reverse rotates angle', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
  ];
  const conn = {
    id: 'test-reverse-flow',
    direction: 'reverse',
    design: {
      marker: {
        role: 'flow'
      }
    }
  };

  const marker = resolveConnectionMarker(points, conn, {
    portClearance: 10,
    bendClearance: 5,
    minMarkerLength: 10,
  });

  assert.equal(marker.type, 'flow');
  assert.equal(marker.angle, Math.PI);
});

test('resolveConnectionMarker too short route gets none', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 20, y: 0 }, // L=20
  ];
  const conn = {
    id: 'test-short',
    direction: 'forward',
    design: {
      marker: {
        role: 'flow'
      }
    }
  };

  // With portClearance = 15 on both sides, the segment has no safe space.
  const marker = resolveConnectionMarker(points, conn, {
    portClearance: 15,
    minMarkerLength: 5,
  });

  assert.equal(marker.type, 'none');
});

test('resolveContainmentJunctions at split branch', () => {
  const conn1 = {
    id: 'conn1',
    from: 'nodeA',
    kind: 'containment',
  };

  const conn2 = {
    id: 'conn2',
    from: 'nodeA',
    kind: 'containment',
  };

  const pts1 = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 50 },
  ];
  const pts2 = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 },
  ];

  const connectionPoints = new Map([
    ['conn1', pts1],
    ['conn2', pts2],
  ]);

  const junctions = resolveContainmentJunctions([conn1, conn2], connectionPoints);

  assert.equal(junctions.length, 1);
  assert.equal(junctions[0].type, 'junction');
  assert.equal(junctions[0].x, 50);
  assert.equal(junctions[0].y, 0);
  assert.deepEqual(junctions[0].connectionIds, ['conn1', 'conn2']);
  assert.equal(junctions[0].ownerId, 'conn1');
});

test('Connection serialization round-trip table-driven', async () => {
  const { default: NodeEditor } = await import('../core/Editor.js');
  const { default: Node } = await import('../core/Node.js');
  const { default: Connection } = await import('../core/Connection.js');
  const { Output, Input, Socket } = await import('../core/Socket.js');

  const cases = [
    {
      id: 'conn-1',
      from: 'node-A',
      out: 'out-1',
      to: 'node-B',
      in: 'in-1',
      kind: 'has-media',
      direction: 'forward',
      design: { marker: { role: 'flow' } }
    },
    {
      id: 'conn-2',
      from: 'node-A',
      out: 'out-1',
      to: 'node-B',
      in: 'in-2',
      kind: 'uses',
      direction: 'forward',
      design: { marker: { role: 'gate' } }
    },
    {
      id: 'conn-3',
      from: 'node-A',
      out: 'out-1',
      to: 'node-B',
      in: 'in-3',
      kind: undefined,
      direction: undefined,
      design: undefined
    }
  ];

  const editor = new NodeEditor();
  const nodeA = new Node();
  nodeA.id = 'node-A';
  nodeA.addOutput('out-1', new Output(new Socket('any')));
  const nodeB = new Node();
  nodeB.id = 'node-B';
  nodeB.addInput('in-1', new Input(new Socket('any')));
  nodeB.addInput('in-2', new Input(new Socket('any')));
  nodeB.addInput('in-3', new Input(new Socket('any')));
  editor.addNode(nodeA);
  editor.addNode(nodeB);

  for (const tc of cases) {
    const conn = new Connection(nodeA, tc.out, nodeB, tc.in);
    conn.id = tc.id;
    if (tc.kind !== undefined) conn.kind = tc.kind;
    if (tc.direction !== undefined) conn.direction = tc.direction;
    if (tc.design !== undefined) conn.design = tc.design;
    editor.addConnection(conn);
  }

  const json = editor.toJSON();

  const newEditor = new NodeEditor();
  const newNodeA = new Node();
  newNodeA.id = 'node-A';
  newNodeA.addOutput('out-1', new Output(new Socket('any')));
  const newNodeB = new Node();
  newNodeB.id = 'node-B';
  newNodeB.addInput('in-1', new Input(new Socket('any')));
  newNodeB.addInput('in-2', new Input(new Socket('any')));
  newNodeB.addInput('in-3', new Input(new Socket('any')));
  newEditor.addNode(newNodeA);
  newEditor.addNode(newNodeB);

  newEditor.fromJSON(json);

  const conns = Array.from(newEditor.connections.values());
  assert.equal(conns.length, 3);

  for (const tc of cases) {
    const conn = newEditor.connections.get(tc.id);
    assert.ok(conn, `connection ${tc.id} not found`);
    assert.equal(conn.from, tc.from);
    assert.equal(conn.out, tc.out);
    assert.equal(conn.to, tc.to);
    assert.equal(conn.in, tc.in);
    assert.equal(conn.kind, tc.kind);
    assert.equal(conn.direction, tc.direction);
    assert.deepEqual(conn.design, tc.design);
  }
});

test('resolveConnectionMarker flow validation table-driven', () => {
  const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

  const testCases = [
    {
      name: 'Valid flow',
      conn: { direction: 'forward', kind: 'uses', design: { marker: { role: 'flow' } } },
      expectedType: 'flow'
    },
    {
      name: 'Flow with direction none',
      conn: { direction: 'none', kind: 'uses', design: { marker: { role: 'flow' } } },
      expectedType: 'none'
    },
    {
      name: 'Flow with unspecified direction',
      conn: { kind: 'uses', design: { marker: { role: 'flow' } } },
      expectedType: 'none'
    },
    {
      name: 'Flow with containment relation',
      conn: { direction: 'forward', kind: 'containment', design: { marker: { role: 'flow' } } },
      expectedType: 'none'
    },
    {
      name: 'Flow with reference relation',
      conn: { direction: 'forward', kind: 'reference', design: { marker: { role: 'flow' } } },
      expectedType: 'none'
    },
    {
      name: 'Flow with association relation',
      conn: { direction: 'forward', kind: 'association', design: { marker: { role: 'flow' } } },
      expectedType: 'none'
    },
    {
      name: 'Flow with secondary relation',
      conn: { direction: 'forward', kind: 'secondary', design: { marker: { role: 'flow' } } },
      expectedType: 'none'
    },
    {
      name: 'Unknown role becomes none',
      conn: { direction: 'forward', kind: 'uses', design: { marker: { role: 'invalid-role' } } },
      expectedType: 'none'
    },
    {
      name: 'Edge-local junction is ignored',
      conn: { direction: 'forward', kind: 'uses', design: { marker: { role: 'junction' } } },
      expectedType: 'none'
    },
    {
      name: 'Explicit gate on a primary directed edge',
      conn: { direction: 'forward', kind: 'uses', design: { marker: { role: 'gate' } } },
      expectedType: 'gate'
    },
    {
      name: 'Gate on a non-directional edge is ignored',
      conn: { direction: 'none', kind: 'uses', design: { marker: { role: 'gate' } } },
      expectedType: 'none'
    },
    {
      name: 'Gate on a secondary edge is ignored',
      conn: { direction: 'forward', kind: 'secondary', design: { marker: { role: 'gate' } } },
      expectedType: 'none'
    }
  ];

  for (const tc of testCases) {
    const marker = resolveConnectionMarker(points, tc.conn, {
      portClearance: 10,
      bendClearance: 5,
      minMarkerLength: 10,
    });
    assert.equal(marker.type, tc.expectedType, `${tc.name}: expected ${tc.expectedType}, got ${marker.type}`);
  }
});

test('resolveContainmentJunctions canonical owner and order-reversal stability', () => {
  const connA = { id: 'connA', from: 'nodeSource', kind: 'containment' };
  const connB = { id: 'connB', from: 'nodeSource', kind: 'containment' };
  const pts = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 }
  ];
  const ptsFork = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 50 }
  ];
  const connectionPoints = new Map([
    ['connA', pts],
    ['connB', ptsFork]
  ]);

  const junctions = resolveContainmentJunctions([connA, connB], connectionPoints);
  assert.equal(junctions.length, 1);
  assert.equal(junctions[0].ownerId, 'connA');
  assert.deepEqual(junctions[0].connectionIds, ['connA', 'connB']);

  // Order-reversal check
  const junctionsRev = resolveContainmentJunctions([connB, connA], connectionPoints);
  assert.equal(junctionsRev.length, 1);
  assert.equal(junctionsRev[0].ownerId, 'connA');
});

test('resolveContainmentJunctions handles unequal segmentation shared trunk', () => {
  const connA = { id: 'connA', from: 'nodeSource', kind: 'containment' };
  const connB = { id: 'connB', from: 'nodeSource', kind: 'containment' };

  const ptsA = [
    { x: 0, y: 0 },
    { x: 50, y: 0 },
    { x: 100, y: 0 }
  ];
  const ptsB = [
    { x: 0, y: 0 },
    { x: 25, y: 0 },
    { x: 50, y: 0 },
    { x: 50, y: 50 }
  ];

  const connectionPoints = new Map([
    ['connA', ptsA],
    ['connB', ptsB]
  ]);

  const junctions = resolveContainmentJunctions([connA, connB], connectionPoints);
  assert.equal(junctions.length, 1);
  assert.equal(junctions[0].type, 'junction');
  assert.equal(junctions[0].x, 50);
  assert.equal(junctions[0].y, 0);
});

test('resolveContainmentJunctions comprehensive coverage (siblings, outputs, identical, missing, frozen)', () => {
  const connA = Object.freeze({ id: 'connA', from: 'nodeSource', out: 'outPort', kind: 'containment' });
  const connB = Object.freeze({ id: 'connB', from: 'nodeSource', out: 'outPort', kind: 'containment' });
  const connC = Object.freeze({ id: 'connC', from: 'nodeSource', out: 'outPort', kind: 'containment' });

  const ptsA = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 50, y: 0 }),
    Object.freeze({ x: 100, y: 0 })
  ]);
  const ptsB = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 50, y: 0 }),
    Object.freeze({ x: 50, y: 50 })
  ]);
  const ptsC = Object.freeze([
    Object.freeze({ x: 0, y: 0 }),
    Object.freeze({ x: 50, y: 0 }),
    Object.freeze({ x: 0, y: 50 })
  ]);

  const connectionPointsMap = new Map([
    ['connA', ptsA],
    ['connB', ptsB],
    ['connC', ptsC]
  ]);

  const junctions = resolveContainmentJunctions([connA, connB, connC], connectionPointsMap);
  assert.equal(junctions.length, 1);
  assert.deepEqual(junctions[0].connectionIds, ['connA', 'connB', 'connC']);
  assert.equal(junctions[0].ownerId, 'connA');

  const connectionPointsObj = {
    connA: ptsA,
    connB: ptsB,
    connC: ptsC
  };
  const junctionsObj = resolveContainmentJunctions([connA, connB, connC], connectionPointsObj);
  assert.equal(junctionsObj.length, 1);
  assert.deepEqual(junctionsObj[0].connectionIds, ['connA', 'connB', 'connC']);

  const connDiffPort = { id: 'connB', from: 'nodeSource', out: 'anotherPort', kind: 'containment' };
  const junctionsDiff = resolveContainmentJunctions([connA, connDiffPort], connectionPointsMap);
  assert.equal(junctionsDiff.length, 0);

  const junctionsMissing = resolveContainmentJunctions([connA, connB], new Map([['connA', ptsA]]));
  assert.equal(junctionsMissing.length, 0);

  const junctionsIdentical = resolveContainmentJunctions([connA, connB], new Map([
    ['connA', ptsA],
    ['connB', ptsA]
  ]));
  assert.equal(junctionsIdentical.length, 0);
});

test('resolveContainmentJunctions assigns unique stable keys to nested branches', () => {
  const connections = ['a', 'b', 'c'].map((id) => ({
    id,
    from: 'source',
    out: 'out',
    kind: 'containment',
  }));
  const points = new Map([
    ['a', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]],
    ['b', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }]],
    ['c', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: -50 }]],
  ]);

  const forward = resolveContainmentJunctions(connections, points);
  const reverse = resolveContainmentJunctions([...connections].reverse(), points);

  assert.equal(forward.length, 2);
  assert.equal(new Set(forward.map((junction) => junction.key)).size, 2);
  assert.deepEqual(forward, reverse);
  assert.deepEqual(forward.map(({ x, y }) => ({ x, y })), [
    { x: 20, y: 0 },
    { x: 50, y: 0 },
  ]);
});

function createMockCanvasContext() {
  const calls = [];
  return {
    calls,
    save() { calls.push({ name: 'save' }); },
    restore() { calls.push({ name: 'restore' }); },
    translate(x, y) { calls.push({ name: 'translate', args: [x, y] }); },
    rotate(angle) { calls.push({ name: 'rotate', args: [angle] }); },
    fillRect(x, y, w, h) { calls.push({ name: 'fillRect', args: [x, y, w, h] }); },
    beginPath() { calls.push({ name: 'beginPath' }); },
    closePath() { calls.push({ name: 'closePath' }); },
    moveTo(x, y) { calls.push({ name: 'moveTo', args: [x, y] }); },
    lineTo(x, y) { calls.push({ name: 'lineTo', args: [x, y] }); },
    arc(x, y, r, sa, ea) { calls.push({ name: 'arc', args: [x, y, r, sa, ea] }); },
    fill() { calls.push({ name: 'fill' }); },
    set fillStyle(val) { calls.push({ name: 'fillStyle', val }); },
    get fillStyle() { return '#fff'; },
    set strokeStyle(val) { calls.push({ name: 'strokeStyle', val }); },
    get strokeStyle() { return '#fff'; },
  };
}

test('CONNECTION_MARKER_METRICS and renderer-neutral projection parity (Canvas and SVG)', () => {
  assert.equal(Object.isFrozen(CONNECTION_MARKER_METRICS), true);
  const cases = [
    { type: 'flow', direction: 'forward', x: 10, y: 20, angle: Math.PI / 4 },
    { type: 'flow', direction: 'both', x: 30, y: 40, angle: 0 },
    { type: 'junction', x: 50, y: 60, angle: 0 },
    { type: 'gate', x: 70, y: 80, angle: 0 },
  ];

  for (const marker of cases) {
    const primitives = projectConnectionMarkerGeometry(marker);
    const canvas = createMockCanvasContext();
    drawCanvasMarker(canvas, marker, '#123456', '#abcdef');

    assert.deepEqual(canvas.calls.find((call) => call.name === 'translate').args, [marker.x, marker.y]);
    assert.equal(canvas.calls.filter((call) => call.name === 'fillRect').length,
      primitives.filter((primitive) => primitive.type === 'rect').length);
    assert.equal(canvas.calls.filter((call) => call.name === 'arc').length,
      primitives.filter((primitive) => primitive.type === 'circle').length);
    assert.equal(canvas.calls.filter((call) => call.name === 'moveTo').length,
      primitives.filter((primitive) => primitive.type === 'polygon').length);

    const { document } = parseHTML('<!doctype html><html><body></body></html>');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    updateSvgMarker('test-conn', marker, svg, '#123456');
    const markerEl = svg.querySelector('[data-conn-marker="test-conn"]');

    assert.equal(markerEl.getAttribute('data-type'), marker.type);
    assert.equal(markerEl.style.getPropertyValue('--sn-conn-marker-color'), '#123456');
    assert.equal(markerEl.children.length, primitives.length);
    primitives.forEach((primitive, index) => {
      const element = markerEl.children[index];
      assert.equal(element.localName, primitive.type);
      if (primitive.type === 'rect') {
        assert.equal(Number(element.getAttribute('x')), primitive.x);
        assert.equal(Number(element.getAttribute('y')), primitive.y);
        assert.equal(Number(element.getAttribute('width')), primitive.width);
        assert.equal(Number(element.getAttribute('height')), primitive.height);
      } else if (primitive.type === 'circle') {
        assert.equal(Number(element.getAttribute('r')), primitive.radius);
      } else {
        assert.equal(element.getAttribute('points'),
          primitive.points.map((point) => point.join(',')).join(' '));
      }
    });
  }
});

test('LOD: normal/low zoom suppression in Canvas rendering', () => {
  assert.equal(shouldRenderConnectionDetail(0.4, false), false);
  assert.equal(shouldRenderConnectionDetail(0.4, true), true);
  assert.equal(shouldRenderConnectionDetail(0.6, false), true);
});

test('Canvas semantic cache invalidation (cold vs warm redraw)', () => {
  const cached = {
    pathStyle: 'pcb',
    kind: 'containment',
    direction: 'forward',
    role: 'flow'
  };

  const connSame = {
    kind: 'containment',
    direction: 'forward',
    design: { marker: { role: 'flow' } }
  };
  assert.equal(isCanvasConnectionPathCacheValid(cached, connSame, 'pcb'), true);

  const connNewRole = {
    kind: 'containment',
    direction: 'forward',
    design: { marker: { role: 'gate' } }
  };
  assert.equal(isCanvasConnectionPathCacheValid(cached, connNewRole, 'pcb'), false);

  const connNewDir = {
    kind: 'containment',
    direction: 'both',
    design: { marker: { role: 'flow' } }
  };
  assert.equal(isCanvasConnectionPathCacheValid(cached, connNewDir, 'pcb'), false);
  assert.equal(isCanvasConnectionPathCacheValid(cached, connSame, 'pcb-drag-proxy'), false);
});

test('connection render batches reconcile derived junctions once', () => {
  const order = [];
  const count = renderConnectionBatch(
    ['a', 'b', 'c'],
    (id) => order.push(`render:${id}`),
    () => order.push('reconcile'),
  );

  assert.equal(count, 3);
  assert.deepEqual(order, ['render:a', 'render:b', 'render:c', 'reconcile']);
});

test('graph normalization rejects authored junction markers', () => {
  const edge = normalizeGraphEdge({
    id: 'edge-1',
    kind: 'containment',
    direction: 'forward',
    design: { marker: { role: 'junction' } },
    source: { nodeId: 'a', port: 'out' },
    target: { nodeId: 'b', port: 'in' },
  });

  assert.equal(edge.design.marker.role, 'none');
});

test('provider schemas expose only authored edge-marker roles', () => {
  const v1Roles = getGraphSchema('v1').$defs.connection
    .properties.design.properties.marker.properties.role.enum;
  const modelRoles = getGraphSchema('graph-model-v1').$defs.edge
    .properties.design.properties.marker.properties.role.enum;

  assert.deepEqual(v1Roles, ['none', 'flow', 'gate']);
  assert.deepEqual(modelRoles, ['none', 'flow', 'gate']);
});

test('SVG derived junctions reconciliation lifecycle (route update & owner removal)', () => {
  const { document } = parseHTML('<!doctype html><html><body></body></html>');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const connections = ['a', 'b', 'c'].map((id) => ({
    id,
    from: 'source',
    out: 'out',
    kind: 'containment',
  }));
  const points = new Map([
    ['a', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]],
    ['b', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }]],
    ['c', [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: -50 }]],
  ]);
  for (const id of ['a', 'b', 'c']) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('data-conn-id', id);
    svg.append(path);
  }
  svg.querySelector('[data-conn-id="b"]').setAttribute('data-selected', '');
  svg.querySelector('[data-conn-id="c"]').setAttribute('data-active-conn', '');

  const editor = {
    getNode: () => ({ outputs: { out: { socket: { color: '#123456' } } } }),
  };
  const initial = reconcileSvgJunctionMarkers(svg, connections, points, editor);
  const initialElements = svg.querySelectorAll('g[data-conn-marker^="junction::"]');
  assert.equal(initial.length, 2);
  assert.equal(initialElements.length, 2);
  assert.equal(initialElements[0].style.getPropertyValue('--sn-conn-marker-color'), '#123456');
  assert.equal(Array.from(initialElements).some((element) => element.hasAttribute('data-selected')), true);
  assert.equal(Array.from(initialElements).some((element) => element.hasAttribute('data-active-conn')), true);

  const previousKeys = new Set(initial.map((junction) => junction.key));
  const survivingConnections = connections.slice(1);
  points.delete('a');
  const surviving = reconcileSvgJunctionMarkers(svg, survivingConnections, points, editor);
  const survivingElement = svg.querySelector('g[data-conn-marker^="junction::"]');
  assert.equal(surviving.length, 1);
  assert.equal(previousKeys.has(surviving[0].key), false);
  assert.equal(survivingElement.hasAttribute('data-selected'), true);
  assert.equal(survivingElement.hasAttribute('data-active-conn'), true);

  svg.querySelector('[data-conn-id="c"]').removeAttribute('data-active-conn');
  svg.querySelector('[data-conn-id="b"]').setAttribute('data-dimmed', '');
  reconcileSvgJunctionMarkers(svg, survivingConnections, points, editor);
  assert.equal(svg.querySelector('g[data-conn-marker^="junction::"]').hasAttribute('data-dimmed'), true);

  reconcileSvgJunctionMarkers(svg, [connections[2]], points, editor);
  assert.equal(svg.querySelectorAll('g[data-conn-marker^="junction::"]').length, 0);
});
