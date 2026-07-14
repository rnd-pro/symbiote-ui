# Layout and Spatial Contracts

## Layout Behavior

`symbiote-ui/layout` exposes SSR-safe layout behavior helpers for hosts and
agents that compose dynamic workspaces:

```js
import {
  LayoutTree,
  resumeLayoutSubtree,
  resolveLayoutMinSize,
  resolveResponsiveLayoutState,
  suspendLayoutSubtree,
} from 'symbiote-ui/layout';

let root = LayoutTree.createSplit(
  'horizontal',
  LayoutTree.createPanel('graph', {}, { importance: 90, minInlineSize: 420 }),
  LayoutTree.createPanel('chat', {}, { importance: 40, minInlineSize: 320 }),
  0.58
);

let minSize = resolveLayoutMinSize(root);
let state = resolveResponsiveLayoutState(
  { collapse: 'auto', overflow: 'scroll-inline', responsiveMode: 'scroll-inline' },
  { inlineSize: 520, blockSize: 420, layoutMinSize: minSize }
);

suspendLayoutSubtree(workspaceEl, { reason: 'workspace-inactive' });
resumeLayoutSubtree(workspaceEl, { reason: 'workspace-active' });
```

`panel-layout` uses the same contract at runtime. Root `layoutBehavior`
is host-applied responsive policy and is not persisted into the saved layout
tree; per-panel or per-branch `behavior` belongs on layout nodes and is
persisted with the tree. `importance` decides auto-collapse order, minimum
inline/block sizes decide when panels no longer fit, `collapse` controls
whether a panel may auto-collapse, `overflow` selects collapse versus
horizontal/vertical scroll fallback, and `responsiveMode` selects mobile
preserve, vertical stack, horizontal scroll, or drawer behavior. In drawer
mode the same layout tree stays mounted: one `mobileDock: 'primary'` panel
remains central while `mobileDock: 'start'` and `mobileDock: 'end'` panels are
projected as gesture-capable side drawers. Minimum footprint resolution
accounts for split ratios, so a skewed split still reserves enough scrollable
space for both child branches.
At runtime `panel-layout` exposes resolved scroll axes through
`scroll-inline-active` and `scroll-block-active` attributes so CSS, browser
smoke tests, and agents can distinguish requested policy from active fallback.
Separate `panel-layout` roots that are adjacent in a host shell can opt into the
same `layout-peer-group`. Visible peers in the group expose root-panel collapse
controls even when each layout has a single panel; the component resolves the
collapse axis/side from peer geometry and reflects `layout-peer-active`,
`layout-peer-collapse-dir`, `layout-peer-collapse-side`, `root-collapsed`,
`root-collapse-dir`, and `root-collapse-side` for host flex/dock chrome.
Drawer projection exposes `drawer-mode-active`, `drawer-start-open`, and
`drawer-end-open` runtime attributes; opening drawers changes only presentation
state and does not save or mutate the host layout tree.
`layout-sidebar` owns only its sidebar configuration and width persistence; its
reset control clears that state and emits `layout-sidebar-reset` for host-owned
layout resets instead of clearing host storage or reloading the page.
`suspendLayoutSubtree()` and `resumeLayoutSubtree()` call public
`suspendLayout()`/`resumeLayout()` methods on reusable components and host
adapters in a hidden layout subtree. `chat-workspace`, `chat-composer`, and
`cell-bg` implement this contract so hidden workspace groups stop animated
backgrounds, wake listeners, voice capture, and UI timers without destroying
host-owned chat, route, or layout state.

## Node Canvas Layout

`node-canvas.applyLayout()` supports `auto`, `tree`, `flow`, and `crystal`.
Every algorithm returns top-left positions. Non-flow algorithms measure the
rendered node rectangles by default, batch position writes, refresh connections
once, and fit the viewport only when `fit: true` is supplied.

```js
let result = canvas.applyLayout({
  algorithm: 'crystal',
  rootNodeId: 'workspace-root',
  groups: {
    'cluster-a': ['cluster-a', 'leaf-a', 'leaf-b'],
  },
  startX: 80,
  startY: 64,
  crystalRingDistance: 120,
  crystalSpokes: 6,
  crystalAngleJitter: 0.12,
  fit: true,
});
```

Crystal layout is deterministic for equivalent node, edge, and group data.
`rootNodeId` selects the growth root and takes precedence over the
force-layout-only `activeVisualNodeId`. An invalid explicit root resolves to a
deterministic graph root instead of following transient focus. `startX` and
`startY` anchor the resolved root's top-left corner. `groups` identify generic
hub/member clusters; the layout does not infer product-specific ownership.
`crystalRingDistance` must be positive, `crystalSpokes` is normalized to 3–12,
and `crystalAngleJitter` is normalized to 0–0.22. Successive rings increase
their capacity by the configured spoke count, producing bounded hexagonal
growth instead of adding one fixed-size ring per spoke batch. Explicit groups
are authoritative layout hubs; automatic degree-based hubs are used only when
the graph supplies no groups. In a grouped graph, an explicit semantic hub
accepts only its declared members. Nodes not claimed by an explicit group or
an existing `isGroup`/`children` structural hub fall back to the root. This
keeps article/media clusters local without absorbing adjacent skills, sections,
or timeline nodes.

The Node-safe `computeCrystalTargets()` planner uses center coordinates for
force simulation. Each target also exposes `layoutParentId`: `null` for the
root, the root ID for hub targets, and the assigned hub ID for member targets.
Agents and diagnostics can therefore verify semantic ownership without
inferring it from proximity. `ForceLayout` sends those canonical targets to the
classic worker, which applies forces without maintaining a second crystal planner.
`computeCrystalLayout()` adapts the same plan to top-left node-canvas
coordinates and ignores prior node positions during explicit relayout.

## Graph Layout Quality

`symbiote-ui/graph` exposes a pure, Node-safe quality audit for settled 2D graph
geometry. It does not move nodes or choose a layout algorithm. Hosts provide a
JSON-compatible snapshot with final node bounds, connections, optional routed
points, viewport, and baseline; the analyzer returns stable finding codes with
the exact node and edge IDs that need attention.

```js
import { analyzeGraphLayout } from 'symbiote-ui/graph';

let report = analyzeGraphLayout({
  version: 'graph-layout-snapshot-v1',
  nodes: [
    { id: 'article', bounds: { x: 0, y: 0, width: 240, height: 160 } },
    {
      id: 'media',
      parentId: 'article',
      bounds: { x: 320, y: 30, width: 180, height: 120 },
    },
  ],
  edges: [
    { id: 'article-media', sourceId: 'article', targetId: 'media' },
  ],
  viewport: { width: 960, height: 640, padding: 48 },
  policy: { idealEdgeLength: 160 },
});
```

The report uses `graph-layout-quality-v1` and contains:

- `status`: `pass`, `warn`, `fail`, or `incomplete`;
- `pass` and `complete` for CI and agent gates;
- normalized node, edge, bounds, viewport, locality, and stability metrics;
- `findings[]` with `ruleId`, severity, involved IDs, actual value, and limit;
- `coverage` where every check records its `required` entity-pair count,
  `complete` or `skipped-budget` status, and worst-case primitive
  geometry-comparison `budgetCost`;
- the resolved `policy` and normalization basis needed to reproduce the result.

Overlaps above the area-valued `overlapTolerance` and connections crossing the
interior of unrelated nodes are failures. Invalid input, malformed geometry,
invalid parent or baseline data, and an exhausted geometry-comparison budget are
blocking `incomplete` results. Edge crossings, excessive distances, unreadable viewport
fit, and layout instability are warnings by default. Routed `points` enable
checks against the rendered connection path; otherwise the analyzer evaluates
a straight center-to-center segment. Boundary tangency does not count as an
interior node intersection.

Baseline nodes may be an array of `{ id, bounds }` or flat
`{ id, x, y, width, height }` records, or an ID-keyed object whose values are
bounds or `{ bounds }`. Duplicate IDs are never resolved by input order: every
ambiguous occurrence is skipped and reported.

Node and edge IDs are canonical non-empty strings without leading or trailing
whitespace. Geometry and route points stay inside the published numeric domain,
which keeps distances, areas, normalization ratios, and serialized reports
finite across very small and very large layouts. Coverage records malformed
entries through `skippedCount` and `unidentifiedCount`; it never invents IDs
that could collide with graph data. If a non-zero derived center delta, area,
ratio, fit scale, rendered size, or aggregate ratio materializes as zero in
IEEE-754, the audit returns `incomplete` with `layout.numeric-underflow`
instead of silently passing. Center differences use cancellation-stable bounds
arithmetic before distance and baseline calculations.

Agents discover the operation, exact input/output schema, report invariants,
status semantics, stable rule catalog with payload schemas, types and units,
default policy, per-field policy constraints, and numeric domain through
`symbiote-ui discover` at `manifest.graphAnalysis`. They can import the function
or run the same contract from a file:

```sh
symbiote-ui layout-audit graph-layout-snapshot.json
```

The CLI prints the JSON report and exits non-zero for `fail` or `incomplete`.
It does not persist reports, mutate graph state, or apply product-specific
article/media policy.

## Spatial Algorithms

`symbiote-ui/xr` includes a set of dependency-free spatial primitives for 3D
graph visualization, force-directed layout, spatial indexing, and multi-view
coordination. All algorithmic cores are pure JavaScript, renderer-neutral, and
Node-safe. Three.js and WebXR adapters accept runtime dependencies through
injection, never as hard imports.

### Octree / Spatial Index

High-performance 3D octree for spatial queries and Barnes-Hut force
approximation:

```js
import { createOctree } from 'symbiote-ui/xr/spatial-index';

let tree = createOctree();
tree.insertAll([
  { x: 1, y: 2, z: 3 },
  { x: 4, y: 5, z: 6 },
  { x: 0, y: 0, z: 0 },
]);

let nearest = tree.nearest(1, 1, 1);
let box = tree.queryBox(0, 0, 0, 3, 3, 3);

tree.visit((node, x0, y0, z0, x1, y1, z1) => {
  // depth-first traversal of octants
});
```

### Spatial Graph Model

Pure functions to create and query a renderer-agnostic 3D graph model
conforming to the `spatial-graph-v1` contract:

```js
import {
  createSpatialGraphModel,
  updateSpatialNodePosition,
  selectSpatialNode,
  focusSpatialNode,
  pinSpatialNode,
  unpinSpatialNode,
} from 'symbiote-ui/xr/spatial-graph';

let model = createSpatialGraphModel({
  nodes: [
    { id: 'a', label: 'Module A', type: 'module', position: [0, 0, 0] },
    { id: 'b', label: 'Module B', type: 'module' },
  ],
  links: [
    { source: 'a', target: 'b', type: 'dependency' },
  ],
});

model = updateSpatialNodePosition(model, 'a', [1, 2, 3]);
model = selectSpatialNode(model, 'a');
model = focusSpatialNode(model, 'b');
model = pinSpatialNode(model, 'a', [1, 2, 3]);
model = unpinSpatialNode(model, 'a');
```

All functions are pure and return new model objects. Host metadata is preserved
in `node.metadata` without product-specific fields leaking into the contract.

### Force-Directed Layout

3D force simulation with Barnes-Hut many-body repulsion via the built-in
octree. No external dependencies:

```js
import {
  createSimulation,
  forceCenter3D,
  forceLink3D,
  forceManyBody3D,
  forceCluster3D,
} from 'symbiote-ui/xr/force-layout';

let nodes = [
  { id: 'a', x: 0, y: 0, z: 0, category: 'core' },
  { id: 'b', x: 1, y: 0, z: 0, category: 'core' },
  { id: 'c', x: 0, y: 1, z: 0, category: 'util' },
];

let links = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
];

let sim = createSimulation(nodes);
sim.force('center', forceCenter3D(0, 0, 0));
sim.force('charge', forceManyBody3D().strength(-3.5));
sim.force('link', forceLink3D(links));
sim.force('cluster', forceCluster3D().strength(0.15));

for (let i = 0; i < 300; i++) sim.tick();
// nodes[0].x, .y, .z now contain settled positions
```

The `createForceLayoutAdapter` bridge connects a `NodeEditor` to the 3D
simulation:

```js
import { createForceLayoutAdapter } from 'symbiote-ui/xr/force-layout-adapter';

let adapter = createForceLayoutAdapter(editor, {
  strength: -4,
  distance: 1.5,
  useCluster: true,
});

adapter.tick(); // one simulation step, syncs coordinates back to editor nodes
```

### Spherical Layout

Deterministic 3D layout using Fibonacci spiral distribution. Units are meters
for XR compatibility:

```js
import { createSphericalGraphLayout } from 'symbiote-ui/xr/spherical-layout';

let layout = createSphericalGraphLayout(
  [
    { id: 'a', type: 'module' },
    { id: 'b', type: 'module' },
    { id: 'c', type: 'util' },
  ],
  [{ source: 'a', target: 'b' }],
  {
    mode: 'clustered-shell', // 'sphere' | 'shell' | 'clustered-shell'
    radius: 1.6,
    center: [0, 1.55, 0],
    category: (d) => d.type,
  }
);

// layout.nodes[i].position → [x, y, z]
// layout.bounds → { min: [x,y,z], max: [x,y,z] }
```

Fixed nodes are preserved in place. Output is fully deterministic for stable
agent-authored layouts.

### Spatial Drag Controller

Pure ray-sphere intersection math and pointer drag projection. No DOM, Three.js,
or WebXR dependencies:

```js
import {
  intersectRaySphere,
  hitTestSpatialNode,
  projectPointerToDragPlane,
  createSpatialDragController,
} from 'symbiote-ui/xr/spatial-drag-controller';

// Ray-sphere hit test
let dist = intersectRaySphere(
  [0, 0, 5],     // ray origin
  [0, 0, -1],    // ray direction
  [0, 0, 0],     // sphere center
  0.08            // sphere radius
);

// Hit test against spatial graph nodes
let hit = hitTestSpatialNode(model.nodes, {
  origin: [0, 0, 5],
  direction: [0, 0, -1],
});

// Full drag controller
let drag = createSpatialDragController();
let startEvent = drag.startDrag(hit.node, pointer);
let moveEvent = drag.moveDrag(pointer);
let endEvent = drag.endDrag();
// Events follow the spatial-node-drag contract: { type, nodeId, phase, position }
```

### Panel Auto-Tiling

Distributes workspace panels in 3D space with arc, grid, and sphere layouts:

```js
import { autoTileXRPanels } from 'symbiote-ui/xr';

let poses = autoTileXRPanels(
  [
    { id: 'chat', width: 0.6, height: 0.8 },
    { id: 'graph', width: 0.8, height: 0.6 },
    { id: 'inspector', width: 0.4, height: 0.6 },
  ],
  { layout: 'arc', comfortDistance: 1.2 }
);

// poses[i] → { id, position, rotation, ... }
```

### Three.js Adapter

Optional renderer adapter. The host supplies the `THREE` instance to avoid
making Three.js a mandatory dependency:

```js
import { createThreeSpatialGraph } from 'symbiote-ui/xr/three-spatial-graph';

let graph3D = createThreeSpatialGraph(THREE, model);
scene.add(graph3D.group);

// On model change:
graph3D.setModel(updatedModel);

// Cleanup:
graph3D.destroy();
```

Renders spherical nodes, link lines, and selection/focus color states.
Meshes are created, updated, and disposed automatically.

### Dual View Controller

Coordinates state between 2D canvas, 3D desktop preview, and XR immersive
modes:

```js
import { createDualViewController } from 'symbiote-ui/xr/dual-view-controller';

let dualView = createDualViewController({ initialMode: '2d' });

let unsubscribe = dualView.subscribe((state) => {
  console.log(state.mode, state.activeNodeId, state.focusedNodeId);
});

dualView.enter3DPreview();
dualView.focusNode('node-a');
dualView.selectNode('node-b');
dualView.updateNodePosition('node-a', [1, 2, 3]);

// Cleanup
dualView.destroy();
```

State is serializable. The controller does not own product routing, project
loading, or engine execution.

### Standalone Subpath Imports

Each spatial module is available as a standalone subpath export:

| Subpath | Module |
| --- | --- |
| `symbiote-ui/xr/spatial-index` | Octree spatial index |
| `symbiote-ui/xr/spatial-graph` | 3D graph model (spatial-graph-v1) |
| `symbiote-ui/xr/force-layout` | Force-directed 3D simulation |
| `symbiote-ui/xr/force-layout-adapter` | NodeEditor ↔ force-layout bridge |
| `symbiote-ui/xr/spherical-layout` | Fibonacci spherical layout |
| `symbiote-ui/xr/spatial-drag-controller` | Ray/sphere drag math |
| `symbiote-ui/xr/dual-view-controller` | 2D/3D/XR state bridge |
| `symbiote-ui/xr/three-spatial-graph` | Optional Three.js renderer adapter |

All modules are also re-exported from the barrel `symbiote-ui/xr`.
