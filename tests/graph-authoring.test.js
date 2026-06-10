import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';

class TestCSSStyleSheet {
  replaceSync(text) {
    this.cssText = text;
  }
}

function installSsrDom() {
  let { window } = parseHTML('<!doctype html><html><body></body></html>');
  Object.assign(globalThis, {
    window,
    document: window.document,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    customElements: window.customElements,
    Node: window.Node,
    Event: window.Event,
    CustomEvent: window.CustomEvent,
    KeyboardEvent: window.KeyboardEvent,
    MutationObserver: window.MutationObserver,
    CSSStyleSheet: TestCSSStyleSheet,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: (id) => clearTimeout(id),
  });
  window.document.adoptedStyleSheets = [];
  Object.defineProperty(window.HTMLElement.prototype, 'adoptedStyleSheets', {
    configurable: true,
    get() {
      return this.__symbioteSsrSheets || [];
    },
    set(value) {
      this.__symbioteSsrSheets = value;
    },
  });
  return window;
}

installSsrDom();

// Import geometry helpers
import {
  isPointInRect,
  isRectIntersecting,
  isRectContaining,
  computeSelectionBounds,
  isNodeInMarquee,
  areEdgeEndpointsInSelection,
  isEdgeIntersectingRect,
  alignNodes,
  distributeNodes,
} from '../interactions/SelectionGeometry.js';

// Import Selector
import { Selector } from '../interactions/Selector.js';

// Import graph-model helpers
import {
  groupNodes,
  ungroupNodes,
  addNodesToGroup,
  removeNodesFromGroup,
  createCanvasGraphStore
} from '../canvas/graph-model.js';

// Import ViewportActions
import { ViewportActions } from '../canvas/ViewportActions.js';

describe('SelectionGeometry Helpers', () => {
  it('isPointInRect verifies coordinate bounds correctly', () => {
    assert.equal(isPointInRect(5, 5, 0, 0, 10, 10), true);
    assert.equal(isPointInRect(15, 5, 0, 0, 10, 10), false);
    assert.equal(isPointInRect(0, 0, 0, 0, 10, 10), true);
    assert.equal(isPointInRect(10, 10, 0, 0, 10, 10), true);
  });

  it('isRectIntersecting verifies overlapping bounds', () => {
    let r1 = { x: 0, y: 0, width: 10, height: 10 };
    let r2 = { x: 5, y: 5, width: 10, height: 10 };
    let r3 = { x: 20, y: 20, width: 10, height: 10 };
    assert.equal(isRectIntersecting(r1, r2), true);
    assert.equal(isRectIntersecting(r1, r3), false);
  });

  it('isRectContaining verifies containment correctly', () => {
    let parent = { x: 0, y: 0, width: 20, height: 20 };
    let child1 = { x: 2, y: 2, width: 5, height: 5 };
    let child2 = { x: 15, y: 15, width: 10, height: 10 };
    assert.equal(isRectContaining(parent, child1), true);
    assert.equal(isRectContaining(parent, child2), false);
  });

  it('computeSelectionBounds calculates bounding box of multiple selected nodes', () => {
    let positions = {
      node1: { x: 10, y: 20 },
      node2: { x: 50, y: 60 },
    };
    let sizes = {
      node1: { width: 100, height: 40 },
      node2: { width: 80, height: 50 },
    };
    let bounds = computeSelectionBounds(positions, sizes, ['node1', 'node2']);
    assert.deepEqual(bounds, {
      x: 10,
      y: 20,
      width: 120, // max X (50+80=130) - min X (10) = 120
      height: 90, // max Y (60+50=110) - min Y (20) = 90
    });
  });

  it('isNodeInMarquee supports intersect and contain options', () => {
    let marquee = { x: 0, y: 0, width: 10, height: 10 };
    let nodeRect = { x: 5, y: 5, width: 10, height: 10 };

    assert.equal(isNodeInMarquee(nodeRect, marquee, { containment: 'intersect' }), true);
    assert.equal(isNodeInMarquee(nodeRect, marquee, { containment: 'contain' }), false);
  });

  it('isEdgeIntersectingRect detects wire intersections', () => {
    let rect = { x: 10, y: 10, width: 10, height: 10 };
    // Segment passes right through the middle of the rect
    let p1 = { x: 5, y: 15 };
    let p2 = { x: 25, y: 15 };
    assert.equal(isEdgeIntersectingRect(p1, p2, rect), true);

    // Segment is completely outside
    let p3 = { x: 0, y: 0 };
    let p4 = { x: 5, y: 5 };
    assert.equal(isEdgeIntersectingRect(p3, p4, rect), false);
  });

  it('alignNodes aligns left, right, top, bottom, horizontal center, and vertical center correctly', () => {
    let positions = {
      n1: { x: 10, y: 20 },
      n2: { x: 50, y: 40 },
    };
    let sizes = {
      n1: { width: 100, height: 40 },
      n2: { width: 80, height: 60 },
    };

    // Align left should align both to x=10
    let alignedLeft = alignNodes(positions, sizes, ['n1', 'n2'], 'left');
    assert.equal(alignedLeft.n1.x, 10);
    assert.equal(alignedLeft.n2.x, 10);

    // Align right should align both to max right edge: max(10+100, 50+80) = 130.
    // n1.x becomes 130 - 100 = 30. n2.x becomes 130 - 80 = 50.
    let alignedRight = alignNodes(positions, sizes, ['n1', 'n2'], 'right');
    assert.equal(alignedRight.n1.x, 30);
    assert.equal(alignedRight.n2.x, 50);

    // Align top should align both to y=20
    let alignedTop = alignNodes(positions, sizes, ['n1', 'n2'], 'top');
    assert.equal(alignedTop.n1.y, 20);
    assert.equal(alignedTop.n2.y, 20);

    // Align bottom should align both to max bottom edge: max(20+40, 40+60) = 100.
    // n1.y becomes 100 - 40 = 60. n2.y becomes 100 - 60 = 40.
    let alignedBottom = alignNodes(positions, sizes, ['n1', 'n2'], 'bottom');
    assert.equal(alignedBottom.n1.y, 60);
    assert.equal(alignedBottom.n2.y, 40);

    // Align horizontal center (average along Y-axis center)
    // n1 center Y = 20 + 20 = 40. n2 center Y = 40 + 30 = 70. Avg = 55.
    // n1.y = 55 - 20 = 35. n2.y = 55 - 30 = 25.
    let alignedH = alignNodes(positions, sizes, ['n1', 'n2'], 'horizontal');
    assert.equal(alignedH.n1.y, 35);
    assert.equal(alignedH.n2.y, 25);

    // Align vertical center (average along X-axis center)
    // n1 center X = 10 + 50 = 60. n2 center X = 50 + 40 = 90. Avg = 75.
    // n1.x = 75 - 50 = 25. n2.x = 75 - 40 = 35.
    let alignedV = alignNodes(positions, sizes, ['n1', 'n2'], 'vertical');
    assert.equal(alignedV.n1.x, 25);
    assert.equal(alignedV.n2.x, 35);
  });

  it('distributeNodes distributes nodes evenly horizontally and vertically', () => {
    let positions = {
      n1: { x: 0, y: 0 },
      n2: { x: 40, y: 0 },
      n3: { x: 200, y: 0 },
    };
    let sizes = {
      n1: { width: 50, height: 20 },
      n2: { width: 50, height: 20 },
      n3: { width: 50, height: 20 },
    };

    // Distribute horizontally
    // Sort order: n1, n2, n3.
    // Total span: 200 + 50 - 0 = 250. Total width: 150. Total gap = 100. Gap count = 2. Gap size = 50.
    // n1.x = 0, n2.x = 100, n3.x = 200.
    let distH = distributeNodes(positions, sizes, ['n1', 'n2', 'n3'], 'horizontal');
    assert.equal(distH.n1.x, 0);
    assert.equal(distH.n2.x, 100);
    assert.equal(distH.n3.x, 200);
  });
});

describe('Selector Model Extensions', () => {
  it('selects, toggles and checks nodes/connections', () => {
    let selector = new Selector();
    selector.selectNode('node-a');
    assert.equal(selector.isNodeSelected('node-a'), true);

    selector.toggleNode('node-a');
    assert.equal(selector.isNodeSelected('node-a'), false);

    selector.selectNodes(['node-a', 'node-b']);
    assert.deepEqual(Array.from(selector.getSelectedNodes()), ['node-a', 'node-b']);

    selector.selectConnections(['conn-1']);
    assert.deepEqual(Array.from(selector.getSelectedConnections()), ['conn-1']);

    selector.toggleConnection('conn-1');
    assert.equal(selector.isConnectionSelected('conn-1'), false);
  });

  it('can retain selected nodes while adding marquee-selected connections', () => {
    let selector = new Selector();
    selector.selectNodes(['node-a', 'node-b']);
    selector.selectConnections(['conn-1'], true);

    assert.deepEqual(Array.from(selector.getSelectedNodes()), ['node-a', 'node-b']);
    assert.deepEqual(Array.from(selector.getSelectedConnections()), ['conn-1']);
  });

  it('returns selection snapshots instead of mutable internal sets', () => {
    let selector = new Selector();
    selector.selectNodes(['node-a']);
    selector.selectConnections(['conn-1'], true);

    selector.getSelectedNodes().add('external-node');
    selector.getSelectedConnections().delete('conn-1');

    assert.deepEqual(Array.from(selector.getSelectedNodes()), ['node-a']);
    assert.deepEqual(Array.from(selector.getSelectedConnections()), ['conn-1']);
  });
});

describe('Group/Subgraph Model Helpers', () => {
  it('keeps graph model JSON schema aligned with root group metadata', async () => {
    let schema = JSON.parse(await readFile(new URL('../schemas/graph-model-v1.json', import.meta.url), 'utf8'));

    assert.equal(schema.properties.groups.type, 'array');
    assert.equal(schema.properties.groups.items.$ref, '#/$defs/group');
  });

  it('performs grouping and ungrouping on node graph data structures', () => {
    let store = createCanvasGraphStore({
      nodes: [
        { id: 'node-1', kind: 'action' },
        { id: 'node-2', kind: 'action' },
      ],
      edges: [],
      rootNodes: ['node-1', 'node-2'],
      groups: {},
    });

    let mockEditor = {
      nodes: new Map([
        ['node-1', { id: 'node-1', kind: 'action' }],
        ['node-2', { id: 'node-2', kind: 'action' }],
      ]),
      getNodes() { return Array.from(this.nodes.values()); },
      addNode(node) { this.nodes.set(node.id, node); },
      removeNode(nodeId) { this.nodes.delete(nodeId); },
      getNode(id) { return this.nodes.get(id); },
      emit() {},
    };

    // Group nodes
    groupNodes(mockEditor, ['node-1', 'node-2'], 'group-abc', 'My Group');

    let groupNode = mockEditor.getNode('group-abc');
    assert.ok(groupNode);
    assert.equal(groupNode.isGroup, true);
    assert.equal(groupNode.label, 'My Group');
    assert.deepEqual(groupNode.children, ['node-1', 'node-2']);

    assert.equal(mockEditor.getNode('node-1').parentId, 'group-abc');
    assert.equal(mockEditor.getNode('node-2').parentId, 'group-abc');

    // Remove node-1 from group
    removeNodesFromGroup(mockEditor, ['node-1']);
    assert.equal(mockEditor.getNode('node-1').parentId, null);
    assert.deepEqual(mockEditor.getNode('group-abc').children, ['node-2']);

    // Add node-1 back to group
    addNodesToGroup(mockEditor, 'group-abc', ['node-1']);
    assert.deepEqual(mockEditor.getNode('group-abc').children, ['node-2', 'node-1']);

    // Ungroup nodes
    ungroupNodes(mockEditor, 'group-abc');
    assert.equal(mockEditor.getNode('group-abc'), undefined);
    assert.equal(mockEditor.getNode('node-1').parentId, null);
    assert.equal(mockEditor.getNode('node-2').parentId, null);
  });
});

describe('ViewportActions Clipboard & History & Alignment Intents', () => {
  it('aligns selected nodes only when enough nodes are selected', () => {
    let emitted = [];
    let mockEditor = {
      getNode(id) { return { id, label: 'Node ' + id }; },
      removeNode() {},
      removeConnection() {},
      emit(type, detail) {
        emitted.push({ type, detail });
      },
    };
    let selector = new Selector();
    let actions = new ViewportActions({
      editor: mockEditor,
      selector,
      nodeViews: new Map([
        ['a', { _position: { x: 10, y: 20 }, offsetWidth: 100, offsetHeight: 40 }],
        ['b', { _position: { x: 50, y: 60 }, offsetWidth: 100, offsetHeight: 40 }],
      ]),
      canvas: document.createElement('div'),
    });

    selector.selectNode('a');
    actions.alignSelectedHorizontal();
    assert.deepEqual(emitted, []);

    selector.selectNode('b', true);
    actions.alignSelectedHorizontal();
    assert.deepEqual(emitted.map((entry) => entry.detail), [
      { nodeId: 'a', x: 10, y: 40 },
      { nodeId: 'b', x: 50, y: 40 },
    ]);
  });

  it('dispatches undo, redo, clipboard and alignment CustomEvents', () => {
    let mockCanvas = document.createElement('div');
    document.body.append(mockCanvas);

    let eventsDispatched = [];
    let recordEvent = (e) => {
      eventsDispatched.push({ type: e.type, detail: e.detail });
    };

    mockCanvas.addEventListener('sn-clipboard-copy', recordEvent);
    mockCanvas.addEventListener('sn-clipboard-cut', recordEvent);
    mockCanvas.addEventListener('sn-clipboard-paste', recordEvent);
    mockCanvas.addEventListener('sn-undo', recordEvent);
    mockCanvas.addEventListener('sn-redo', recordEvent);

    let mockEditor = {
      getNode(id) { return { id, label: 'Node ' + id }; },
      removeNode() {},
      removeConnection() {},
      emit() {},
    };
    let selector = new Selector();
    selector.selectNode('a');

    let actions = new ViewportActions({
      editor: mockEditor,
      selector,
      nodeViews: new Map([
        ['a', { _position: { x: 10, y: 20 }, offsetWidth: 100, offsetHeight: 40 }]
      ]),
      canvas: mockCanvas,
    });

    let triggerKey = (key, ctrl) => {
      let e = new window.Event('keydown', { bubbles: true, cancelable: true });
      Object.defineProperties(e, {
        key: { value: key },
        ctrlKey: { value: !!ctrl },
        metaKey: { value: !!ctrl },
      });
      actions.handleKeydown(e);
    };

    // Copy keyboard shortcut
    triggerKey('c', true);
    // Cut keyboard shortcut
    triggerKey('x', true);
    // Paste keyboard shortcut
    triggerKey('v', true);
    // Undo
    triggerKey('z', true);
    // Redo
    triggerKey('y', true);

    assert.equal(eventsDispatched.length, 5);
    assert.equal(eventsDispatched[0].type, 'sn-clipboard-copy');
    assert.deepEqual(eventsDispatched[0].detail.nodeIds, ['a']);
    assert.equal(eventsDispatched[1].type, 'sn-clipboard-cut');
    assert.equal(eventsDispatched[2].type, 'sn-clipboard-paste');
    assert.equal(eventsDispatched[3].type, 'sn-undo');
    assert.equal(eventsDispatched[4].type, 'sn-redo');

    mockCanvas.remove();
  });
});
