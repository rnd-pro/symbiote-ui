import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NATIVE_PANEL_LAYOUT_VERSION,
  NATIVE_PANEL_LAYERS,
  compileNativePanelPrimitives,
  projectXRPanelsToPlane,
  resolveNativePanelHit,
} from '../xr/native-panel-layout.js';
import { createThreeNativePanelRenderer } from '../xr/three-native-panel-renderer.js';

function createPanels() {
  return [
    {
      id: 'activity',
      panelType: 'list-panel',
      relativeRect: { x: 0, y: 0, width: 0.4, height: 1 },
      metadata: { order: 0 },
    },
    {
      id: 'pipeline',
      panelType: 'graph-panel',
      relativeRect: { x: 0.4, y: 0, width: 0.35, height: 1 },
    },
    {
      id: 'inspector',
      panelType: 'detail-panel',
      relativeRect: { x: 0.75, y: 0, width: 0.25, height: 1 },
    },
  ];
}

function createFamilyData() {
  return {
    activity: {
      family: 'list-table',
      title: 'Activity',
      rows: [
        { id: 'row-a', title: 'Row A', detail: 'Detail A', tone: 'success' },
        { id: 'row-b', title: 'Row B', detail: 'Detail B', tone: 'warning' },
      ],
    },
    pipeline: {
      family: 'workflow-graph',
      title: 'Pipeline',
      nodes: [
        { id: 'node-in', label: 'In' },
        { id: 'node-mid', label: 'Mid' },
        { id: 'node-out', label: 'Out' },
      ],
      edges: [
        { source: 'node-in', target: 'node-mid' },
        { source: 'node-mid', target: 'node-out' },
      ],
    },
    inspector: {
      family: 'detail-actions',
      title: 'Inspector',
      fields: [
        { id: 'field-state', label: 'State', value: 'Ready' },
      ],
      actions: [
        { id: 'apply', label: 'Apply', tone: 'accent' },
        { id: 'reset', label: 'Reset', tone: 'danger' },
      ],
    },
  };
}

function createProjected() {
  return projectXRPanelsToPlane(createPanels(), {
    planeWidth: 1.6,
    planeHeight: 0.9,
    gap: 0.02,
    z: -1.4,
  });
}

function createCompiled() {
  let projected = createProjected();
  return compileNativePanelPrimitives(projected.panels, createFamilyData());
}

function createTheme(revision = 1) {
  return {
    revision,
    roles: {
      'surface': '#202020',
      'surface-raised': '#272727',
      'surface-sunken': '#151515',
      'text': '#f0f0f0',
      'text-dim': '#aaaaaa',
      'outline': '#444444',
      'accent': '#4c8bf5',
      'success': '#34a853',
      'warning': '#fbbc04',
      'danger': '#f44336',
    },
    metrics: { fontSize: 13, labelSize: 11, radius: 6, density: 1 },
  };
}

function toNormalized(panel, bounds) {
  return {
    x: bounds.x / panel.size[0] + 0.5,
    y: 0.5 - bounds.y / panel.size[1],
  };
}

function createMockThree() {
  class MockColor {
    constructor(value) {
      this.value = value ?? null;
    }
    set(value) {
      this.value = value;
      return this;
    }
  }
  class MockVector {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
  }
  class MockPlaneGeometry {
    constructor(width, height) {
      this.width = width;
      this.height = height;
      this.disposed = false;
    }
    dispose() {
      this.disposed = true;
    }
  }
  class MockMeshBasicMaterial {
    constructor(params = {}) {
      Object.assign(this, params);
      this.color = new MockColor(params.color);
      this.disposed = false;
    }
    dispose() {
      this.disposed = true;
    }
  }
  class MockObject3D {
    constructor() {
      this.children = [];
      this.parent = null;
      this.userData = {};
      this.position = new MockVector();
      this.scale = new MockVector(1, 1, 1);
      this.rotation = new MockVector();
    }
    add(...objects) {
      for (let object of objects) {
        object.parent = this;
        this.children.push(object);
      }
      return this;
    }
    remove(...objects) {
      for (let object of objects) {
        let index = this.children.indexOf(object);
        if (index >= 0) this.children.splice(index, 1);
        object.parent = null;
      }
      return this;
    }
    removeFromParent() {
      this.parent?.remove(this);
      return this;
    }
    clear() {
      this.remove(...this.children);
      return this;
    }
    traverse(callback) {
      callback(this);
      for (let child of [...this.children]) {
        child.traverse(callback);
      }
    }
  }
  class MockGroup extends MockObject3D {}
  class MockMesh extends MockObject3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
    }
  }
  return {
    Group: MockGroup,
    Mesh: MockMesh,
    PlaneGeometry: MockPlaneGeometry,
    MeshBasicMaterial: MockMeshBasicMaterial,
    Color: MockColor,
    REVISION: '180',
  };
}

test('projectXRPanelsToPlane maps relativeRect into deterministic centered meter space', () => {
  let first = createProjected();
  let second = createProjected();
  assert.deepEqual(first, second);
  assert.equal(first.version, NATIVE_PANEL_LAYOUT_VERSION);
  assert.equal(first.unit, 'meter');
  assert.equal(first.panels.length, 3);

  let activity = first.panels.find((panel) => panel.id === 'activity');
  assert.equal(activity.panelType, 'list-panel');
  assert.deepEqual(activity.metadata, { order: 0 });
  assert.deepEqual(activity.relativeRect, { x: 0, y: 0, width: 0.4, height: 1 });
  assert.equal(activity.position[2], -1.4);
  assert.ok(Math.abs(activity.position[0] - -0.48) < 1e-9);
  assert.equal(activity.position[1], 0);
  assert.ok(Math.abs(activity.size[0] - 0.62) < 1e-9);
  assert.ok(Math.abs(activity.size[1] - 0.88) < 1e-9);

  let inspector = first.panels.find((panel) => panel.id === 'inspector');
  assert.ok(Math.abs(inspector.position[0] - 0.6) < 1e-9);
});

test('projectXRPanelsToPlane rejects invalid input with actionable errors', () => {
  assert.throws(() => projectXRPanelsToPlane(null), /non-empty array/);
  assert.throws(() => projectXRPanelsToPlane([]), /non-empty array/);
  assert.throws(
    () => projectXRPanelsToPlane([{ id: 'broken' }]),
    /relativeRect/,
  );
  assert.throws(
    () => projectXRPanelsToPlane(createPanels(), { planeWidth: 0 }),
    /planeWidth/,
  );
  assert.throws(
    () => projectXRPanelsToPlane([
      { id: 'dup', relativeRect: { x: 0, y: 0, width: 0.5, height: 1 } },
      { id: 'dup', relativeRect: { x: 0.5, y: 0, width: 0.5, height: 1 } },
    ]),
    /Duplicate panel id "dup"/,
  );
});

test('compileNativePanelPrimitives compiles three families across four finite layers', () => {
  let compiled = createCompiled();
  assert.deepEqual([...NATIVE_PANEL_LAYERS], ['surface', 'content', 'controls', 'focus']);
  assert.equal(compiled.version, NATIVE_PANEL_LAYOUT_VERSION);
  assert.equal(compiled.panels.length, 3);
  assert.equal(compiled.panels.find((panel) => panel.id === 'activity').family, 'list-table');
  assert.equal(compiled.panels.find((panel) => panel.id === 'pipeline').family, 'workflow-graph');
  assert.equal(compiled.panels.find((panel) => panel.id === 'inspector').family, 'detail-actions');

  let usedLayers = new Set();
  let totalPrimitives = 0;
  for (let panel of compiled.panels) {
    assert.ok(panel.primitives.length > 0, `panel ${panel.id} has primitives`);
    for (let primitive of panel.primitives) {
      usedLayers.add(primitive.layer);
      totalPrimitives += 1;
      assert.ok(
        NATIVE_PANEL_LAYERS.includes(primitive.layer),
        `primitive ${primitive.id} layer ${primitive.layer} is in the finite layer list`,
      );
      assert.ok(Number.isFinite(primitive.bounds.x), `primitive ${primitive.id} x is finite`);
      assert.ok(Number.isFinite(primitive.bounds.y), `primitive ${primitive.id} y is finite`);
      assert.ok(primitive.bounds.width > 0, `primitive ${primitive.id} width is positive`);
      assert.ok(primitive.bounds.height > 0, `primitive ${primitive.id} height is positive`);
      assert.ok(Number.isFinite(primitive.z), `primitive ${primitive.id} z is finite`);
      assert.equal(typeof primitive.themeRole, 'string');
    }
  }
  assert.deepEqual([...usedLayers].sort(), [...NATIVE_PANEL_LAYERS].sort());
  assert.equal(compiled.counts.primitives, totalPrimitives);
  assert.equal(compiled.counts.panels, 3);
  for (let layer of NATIVE_PANEL_LAYERS) {
    assert.ok(compiled.counts.byLayer[layer] > 0, `layer ${layer} counted`);
  }

  let again = createCompiled();
  assert.deepEqual(compiled, again);
});

test('compileNativePanelPrimitives emits unique stable hit ids and validates families', () => {
  let compiled = createCompiled();
  let hitIds = compiled.panels
    .flatMap((panel) => panel.primitives)
    .filter((primitive) => primitive.hit)
    .map((primitive) => primitive.hit.id);
  assert.ok(hitIds.length > 0);
  assert.equal(new Set(hitIds).size, hitIds.length);
  assert.equal(compiled.counts.hitTargets, hitIds.length);
  assert.ok(hitIds.includes('activity/hit/row-row-a'));
  assert.ok(hitIds.includes('pipeline/hit/node-node-mid'));
  assert.ok(hitIds.includes('inspector/hit/action-apply'));

  let projected = createProjected();
  assert.throws(
    () => compileNativePanelPrimitives(projected.panels, {
      ...createFamilyData(),
      activity: { family: 'mystery' },
    }),
    /Unknown native panel family "mystery"\. Supported: detail-actions, list-table, workflow-graph/,
  );
  assert.throws(
    () => compileNativePanelPrimitives(projected.panels, {}),
    /family data/,
  );
});

test('resolveNativePanelHit resolves normalized panel coordinates to stable targets', () => {
  let compiled = createCompiled();
  let activity = compiled.panels.find((panel) => panel.id === 'activity');
  let rowControl = activity.primitives.find(
    (primitive) => primitive.hit?.actionId === 'select-row' && primitive.hit?.targetId === 'row-a',
  );
  let hit = resolveNativePanelHit(activity, toNormalized(activity, rowControl.bounds));
  assert.equal(hit.panelId, 'activity');
  assert.equal(hit.primitiveId, rowControl.id);
  assert.equal(hit.hitId, 'activity/hit/row-row-a');
  assert.equal(hit.actionId, 'select-row');
  assert.equal(hit.targetId, 'row-a');
  assert.equal(hit.layer, 'controls');
  assert.ok(hit.point.x >= 0 && hit.point.x <= 1);
  assert.ok(hit.point.y >= 0 && hit.point.y <= 1);

  let headerControl = activity.primitives.find((primitive) => primitive.hit?.actionId === 'drag-panel');
  let headerHit = resolveNativePanelHit(activity, toNormalized(activity, headerControl.bounds));
  assert.equal(headerHit.actionId, 'drag-panel');
  assert.equal(headerHit.targetId, 'activity');

  let inspector = compiled.panels.find((panel) => panel.id === 'inspector');
  let actionControl = inspector.primitives.find((primitive) => primitive.hit?.actionId === 'apply');
  let actionHit = resolveNativePanelHit(inspector, toNormalized(inspector, actionControl.bounds));
  assert.equal(actionHit.actionId, 'apply');
  assert.equal(actionHit.targetId, 'apply');

  assert.equal(resolveNativePanelHit(activity, { x: -0.1, y: 0.5 }), null);
  assert.equal(resolveNativePanelHit(activity, { x: 0.5, y: 1.1 }), null);
});

test('three native panel renderer constructs Node-safe with a minimal contract mock', () => {
  let compiled = createCompiled();
  let THREE = createMockThree();
  let renderer = createThreeNativePanelRenderer(THREE, {
    threeRevision: '0.180.0',
    createLabelPlane: (three, primitive) => new three.Mesh(
      new three.PlaneGeometry(1, 1),
      new three.MeshBasicMaterial(),
    ),
  });
  renderer.mount(compiled, { theme: createTheme() });

  assert.equal(renderer.group.children.length, 3);
  let panelIds = renderer.group.children.map((group) => group.userData.panelId).sort();
  assert.deepEqual(panelIds, ['activity', 'inspector', 'pipeline']);
  assert.equal(
    renderer.getPanelObject('activity'),
    renderer.group.children.find((group) => group.userData.panelId === 'activity'),
  );
  assert.equal(renderer.getPanelObject('missing'), null);

  let interactive = renderer.getInteractiveObjects();
  assert.equal(interactive.length, compiled.counts.hitTargets);
  for (let object of interactive) {
    assert.equal(typeof object.userData.panelId, 'string');
    assert.equal(typeof object.userData.primitiveId, 'string');
    assert.equal(typeof object.userData.actionId, 'string');
    assert.ok(NATIVE_PANEL_LAYERS.includes(object.userData.layer));
  }

  let diagnostics = renderer.getDiagnostics();
  assert.equal(diagnostics.panels, 3);
  assert.equal(diagnostics.primitives, compiled.counts.primitives);
  assert.equal(diagnostics.interactive, compiled.counts.hitTargets);
  assert.equal(diagnostics.threeRevision, '0.180.0');
  assert.equal(diagnostics.themeRevision, 1);

  let beforeTheme = new Set();
  renderer.group.traverse((object) => beforeTheme.add(object));
  let nextTheme = createTheme(2);
  nextTheme.roles.accent = 'rgb(1, 2, 3)';
  renderer.updateTheme(nextTheme);
  let afterTheme = new Set();
  renderer.group.traverse((object) => afterTheme.add(object));
  assert.equal(afterTheme.size, beforeTheme.size);
  for (let object of beforeTheme) {
    assert.ok(afterTheme.has(object), 'theme update preserves object identity');
  }
  let updatedDiagnostics = renderer.getDiagnostics();
  assert.equal(updatedDiagnostics.themeUpdates, 1);
  assert.equal(updatedDiagnostics.themeRevision, 2);
  assert.equal(updatedDiagnostics.builds, 1);

  renderer.setLayerExplode(0.05);
  let panelGroup = renderer.group.children[0];
  let layerZ = panelGroup.children.map((layerGroup) => layerGroup.position.z);
  assert.equal(layerZ.length, NATIVE_PANEL_LAYERS.length);
  assert.deepEqual([...layerZ].sort((a, b) => a - b), layerZ);
  assert.ok(layerZ[NATIVE_PANEL_LAYERS.length - 1] > layerZ[0]);

  renderer.mount(createCompiled(), { theme: createTheme(3) });
  assert.equal(renderer.group.children.length, 3);
  assert.equal(renderer.getDiagnostics().builds, 2);

  renderer.dispose();
  assert.equal(renderer.group.children.length, 0);
  assert.equal(renderer.getInteractiveObjects().length, 0);
});

test('three native panel renderer group renders under a host scene and dispose detaches it', () => {
  let THREE = createMockThree();
  let scene = new THREE.Group();
  let renderer = createThreeNativePanelRenderer(THREE, {
    threeRevision: '0.180.0',
    createLabelPlane: (three) => new three.Mesh(
      new three.PlaneGeometry(1, 1),
      new three.MeshBasicMaterial(),
    ),
  });
  scene.add(renderer.group);
  renderer.mount(createCompiled(), { theme: createTheme() });

  assert.equal(renderer.group.parent, scene);
  assert.equal(scene.children.filter((child) => child === renderer.group).length, 1);
  assert.ok(renderer.group.children.length > 0, 'host scene subtree contains the mounted panels');

  renderer.dispose();
  assert.equal(renderer.group.parent, null);
  assert.equal(scene.children.length, 0);
});

test('three native panel renderer fails loud without THREE or a label factory', () => {
  assert.throws(
    () => createThreeNativePanelRenderer(null),
    /THREE/,
  );
  let bare = createThreeNativePanelRenderer(createMockThree());
  assert.throws(
    () => bare.mount(createCompiled(), { theme: createTheme() }),
    /createLabelPlane/,
  );
});

test('three native panel renderer normalizes rgba theme roles into color plus alpha semantics', () => {
  let THREE = createMockThree();
  let renderer = createThreeNativePanelRenderer(THREE, {
    threeRevision: '0.180.0',
    createLabelPlane: (three) => new three.Mesh(
      new three.PlaneGeometry(1, 1),
      new three.MeshBasicMaterial(),
    ),
  });
  let theme = createTheme();
  theme.roles.outline = 'rgba(158, 158, 158, 0)';
  theme.roles.accent = 'rgba(76, 139, 245, 0.9)';
  renderer.mount(createCompiled(), { theme });

  let materials = [];
  renderer.group.traverse((object) => {
    if (object.material && !materials.includes(object.material)) materials.push(object.material);
  });
  assert.ok(materials.length > 0);
  for (let material of materials) {
    assert.doesNotMatch(String(material.color.value), /rgba\(/i, 'no rgba string reaches THREE.Color');
  }

  let outlineMaterial = materials.find((material) => material.color.value === 'rgb(158, 158, 158)');
  assert.ok(outlineMaterial, 'outline role material uses the normalized rgb color');
  assert.equal(outlineMaterial.opacity, 0);
  assert.equal(outlineMaterial.transparent, true);

  let hitMaterial = renderer.getInteractiveObjects()
    .find((object) => object.userData.control === 'hit')?.material;
  assert.ok(hitMaterial, 'hit region material exists');
  assert.equal(hitMaterial.color.value, 'rgb(76, 139, 245)');
  assert.equal(hitMaterial.opacity, 0, 'explicitly invisible hit material keeps its opacity');

  let nextTheme = createTheme(2);
  nextTheme.roles.outline = '#444444';
  renderer.updateTheme(nextTheme);
  assert.equal(outlineMaterial.color.value, '#444444');
  assert.equal(outlineMaterial.opacity, 1, 'opaque theme update resets alpha-driven opacity');
  assert.equal(outlineMaterial.transparent, false);
  assert.equal(hitMaterial.opacity, 0, 'theme update does not corrupt hit material opacity');

  renderer.dispose();
});

test('three native panel renderer reports unsupported CSS color functions instead of feeding them to THREE.Color', () => {
  let THREE = createMockThree();
  let renderer = createThreeNativePanelRenderer(THREE, {
    threeRevision: '0.180.0',
    createLabelPlane: (three) => new three.Mesh(
      new three.PlaneGeometry(1, 1),
      new three.MeshBasicMaterial(),
    ),
  });
  let theme = createTheme();
  theme.roles.accent = 'oklch(0.7 0.1 200)';
  theme.roles.outline = 'color(srgb 0.5 0.5 0.5)';
  renderer.mount(createCompiled(), { theme });

  renderer.group.traverse((object) => {
    if (object.material) {
      assert.doesNotMatch(
        String(object.material.color.value),
        /oklch\(|color\(srgb/i,
        'no unsupported CSS color function reaches THREE.Color',
      );
    }
  });
  let reported = (renderer.getDiagnostics().unsupportedColors || []).map((entry) => entry.value);
  assert.ok(reported.includes('oklch(0.7 0.1 200)'), 'unsupported oklch role is explicit in diagnostics');
  assert.ok(reported.includes('color(srgb 0.5 0.5 0.5)'), 'unsupported color() role is explicit in diagnostics');

  renderer.updateTheme(createTheme(2));
  assert.deepEqual(
    renderer.getDiagnostics().unsupportedColors,
    [],
    'a clean theme update clears the unsupported color diagnostic',
  );
  renderer.dispose();
});

test('three native panel renderer honors additive primitive resolved styles', async () => {
  let { compileSpatialSnapshot } = await import('../xr/spatial-snapshot-compile.js');
  let { createReferenceSnapshot } = await import('./fixtures/spatial-snapshot-reference.js');
  let compiled = compileSpatialSnapshot(createReferenceSnapshot(), { planeWidth: 1.28 });
  let THREE = createMockThree();
  let renderer = createThreeNativePanelRenderer(THREE, {
    threeRevision: '0.180.0',
    createLabelPlane: (three) => new three.Mesh(
      new three.PlaneGeometry(1, 1),
      new three.MeshBasicMaterial(),
    ),
    createIconPlane: (three) => new three.Mesh(
      new three.PlaneGeometry(1, 1),
      new three.MeshBasicMaterial(),
    ),
  });
  renderer.mount(compiled, { theme: createTheme() });

  let surfaceObject = renderer.getPrimitiveObject('panel:project/surface/panel:project');
  assert.ok(surfaceObject, 'resolved-style panel surface exists');
  assert.equal(surfaceObject.material.color.value, 'rgb(32, 32, 32)');

  let saveButton = renderer.getPrimitiveObject('panel:source/controls/panel:source/control:save');
  assert.ok(saveButton, 'resolved-style control exists');
  assert.equal(saveButton.material.color.value, 'rgb(76, 139, 245)');
  assert.equal(saveButton.userData.resolvedStyle, true);

  let nextTheme = createTheme(2);
  nextTheme.roles.surface = 'rgb(9, 9, 9)';
  renderer.updateTheme(nextTheme);
  assert.equal(
    surfaceObject.material.color.value,
    'rgb(32, 32, 32)',
    'theme updates must not recolor measured resolved styles',
  );
  assert.equal(saveButton.material.color.value, 'rgb(76, 139, 245)');

  renderer.setHovered(saveButton.userData.primitiveId);
  assert.equal(
    saveButton.material.color.value,
    'rgb(76, 139, 245)',
    'hover recolor must not override measured resolved styles',
  );

  renderer.dispose();
});
