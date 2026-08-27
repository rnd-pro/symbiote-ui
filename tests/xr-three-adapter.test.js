import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE_REAL from 'three';

import {
  XR_THREE_WEBXR_ADAPTER,
  createXRThreeSessionController,
  createXRThreeWebXRAdapter,
} from '../xr/three-webxr-adapter.js';
import {
  computeXRPanelChromeLayout,
  createXRPanelFrame,
  hitTestXRPanelFrame,
} from '../xr/panel-frame.js';
import { createSpatialTarget } from './xr-spatial-fixtures.js';

if (typeof globalThis.OffscreenCanvas !== 'function') {
  globalThis.OffscreenCanvas = class {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() {
      return {
        clearRect() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, fill() {},
        save() {}, restore() {}, translate() {}, arc() {}, stroke() {}, strokeRect() {},
        lineTo() {}, scale() {}, rotate() {}, fillText() {},
        measureText(value) { return { width: String(value).length * 10 }; },
      };
    }
  };
}

function readPanelSize(mesh) {
  return mesh.userData?.xrSize || [0.8, 0.45];
}

function applyPanelSize(mesh, size) {
  if (!mesh || !Array.isArray(size)) return;
  let next = [
    Math.max(0.05, Number(size[0] || 0.8)),
    Math.max(0.05, Number(size[1] || 0.45)),
  ];
  mesh.userData ||= {};
  mesh.userData.xrSize = next;
  if (mesh.userData.panel) {
    mesh.userData.panel = { ...mesh.userData.panel, size: next };
  }
}

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    return this;
  }
  copy(v) {
    this.x = v.x; this.y = v.y; this.z = v.z;
    return this;
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
  add(v) {
    this.x += v.x; this.y += v.y; this.z += v.z;
    return this;
  }
  sub(v) {
    this.x -= v.x; this.y -= v.y; this.z -= v.z;
    return this;
  }
  normalize() {
    let len = Math.hypot(this.x, this.y, this.z) || 1;
    this.x /= len; this.y /= len; this.z /= len;
    return this;
  }
  applyQuaternion(q) {
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
}

class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  set(x, y, z, w) {
    this.x = x; this.y = y; this.z = z; this.w = w;
    return this;
  }
  copy(q) {
    this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w;
    return this;
  }
  clone() {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }
}

class Plane {
  setFromNormalAndCoplanarPoint(n, p) {
    this.normal = n.clone();
    this.point = p.clone();
    return this;
  }
  clone() {
    let p = new Plane();
    p.normal = this.normal.clone();
    p.point = this.point.clone();
    return p;
  }
}

class Scene {
  constructor() {
    this.children = [];
  }
  add(object) {
    this.children.push(object);
    object.parent = this;
  }
  remove(object) {
    this.children = this.children.filter((candidate) => candidate !== object);
  }
}

class Group {
  constructor() {
    this.userData = {};
    this.position = new Vector3();
    this.quaternion = new Quaternion();
    this.rotation = {
      values: [0, 0, 0, 'XYZ'],
      fromArray(v) { this.values = [...v]; },
      set(x, y, z, order) { this.values = [x, y, z, order]; }
    };
    this.children = [];
  }
  add(object) {
    this.children.push(object);
    object.parent = this;
  }
  getWorldPosition(target) {
    target.copy(this.position);
    if (this.parent && typeof this.parent.getWorldPosition === 'function') {
      let parentPos = new Vector3();
      this.parent.getWorldPosition(parentPos);
      target.add(parentPos);
    }
    return target;
  }
  getWorldQuaternion(target) {
    target.copy(this.quaternion);
    return target;
  }
  worldToLocal(v) {
    v.sub(this.position);
    return v;
  }
}

class Renderer {
  constructor() {
    this.xr = { enabled: false };
  }
}

class Mesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.position = new Vector3();
    this.quaternion = new Quaternion();
    this.rotation = {
      values: [0, 0, 0, 'XYZ'],
      fromArray(v) { this.values = [...v]; },
      set(x, y, z, order) { this.values = [x, y, z, order]; }
    };
    this.userData = {};
    this.children = [];
  }
  add(object) {
    this.children.push(object);
    object.parent = this;
  }
  getWorldPosition(target) {
    target.copy(this.position);
    if (this.parent && typeof this.parent.getWorldPosition === 'function') {
      let parentPos = new Vector3();
      this.parent.getWorldPosition(parentPos);
      target.add(parentPos);
    }
    return target;
  }
  getWorldQuaternion(target) {
    target.copy(this.quaternion);
    return target;
  }
}

class Ray {
  constructor() {
    this.origin = new Vector3();
    this.direction = new Vector3(0, 0, -1);
  }
  intersectPlane(plane, target) {
    target.copy(plane.point);
    return target;
  }
}

class Raycaster {
  constructor() {
    this.ray = new Ray();
  }
  set(origin, direction) {
    this.ray.origin.copy(origin);
    this.ray.direction.copy(direction);
  }
  intersectObjects() {
    return [];
  }
}

let THREE = {
  Scene,
  Group,
  PerspectiveCamera: class {
    getWorldPosition(target) {
      target.set(0, 1.6, 2);
    }
  },
  WebGLRenderer: Renderer,
  PlaneGeometry: class {
    constructor(w, h) {
      this.parameters = { width: w, height: h };
    }
  },
  Mesh,
  MeshStandardMaterial: class {},
  MeshBasicMaterial: class {},
  CanvasTexture: class {
    constructor(image) { this.image = image; this.source = image; }
  },
  LinearMipmapLinearFilter: 1008,
  LinearFilter: 1006,
  SRGBColorSpace: 'srgb',
  Raycaster,
  Vector3,
  Quaternion,
  Plane,
};

test('Three adapter publishes committed-root, trusted-select, and audit capabilities', () => {
  for (let capability of [
    'three-world-locked-root-commit',
    'three-trusted-select-receipts',
    'three-spatial-audit-v1',
    'three-scene-interaction-arbiter',
    'three-exact-primitive-capture',
  ]) {
    assert.ok(XR_THREE_WEBXR_ADAPTER.capabilities.includes(capability));
  }
  assert.equal(
    XR_THREE_WEBXR_ADAPTER.capabilities.includes('three-hit-test-placement-receipts'),
    false,
    'pre-root hit-test placement remains a pure product-owned composition contract',
  );
  assert.equal('fallback' in XR_THREE_WEBXR_ADAPTER, false, 'native Three/WebXR has no rendering fallback contract');
});

test('Three hit reticle aligns its +Z axis to a curved mesh world surface normal', () => {
  let adapter = createXRThreeWebXRAdapter({ THREE: THREE_REAL });
  let scene = new THREE_REAL.Scene();
  let reticle = adapter.createPanelHitReticleVisual(scene);
  assert.equal(reticle.ok, true);

  let root = new THREE_REAL.Group();
  root.position.set(0.4, 0.7, -1.2);
  root.rotation.set(-0.25, 0.6, 0.18);
  let surface = new THREE_REAL.Mesh(
    new THREE_REAL.SphereGeometry(0.6, 16, 12),
    new THREE_REAL.MeshBasicMaterial(),
  );
  surface.rotation.set(0.35, -0.45, 0.22);
  surface.scale.set(0.65, 1.4, 0.85);
  root.add(surface);
  scene.add(root);
  scene.updateMatrixWorld(true);

  let localNormal = new THREE_REAL.Vector3(0.38, 0.81, 0.44).normalize();
  let point = surface.localToWorld(localNormal.clone().multiplyScalar(0.6));
  let updated = adapter.updatePanelHitReticleVisual(reticle, {
    object: surface,
    point,
    face: { normal: localNormal },
    distance: 1.25,
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.visible, true);
  assert.equal(updated.panelId, null, 'the shared reticle must not require a panel target');

  scene.updateMatrixWorld(true);
  let actualNormal = new THREE_REAL.Vector3(0, 0, 1)
    .transformDirection(reticle.object.matrixWorld);
  let expectedNormal = localNormal.clone()
    .applyMatrix3(new THREE_REAL.Matrix3().getNormalMatrix(surface.matrixWorld))
    .normalize();
  assert.ok(actualNormal.distanceTo(expectedNormal) < 1e-7);

  surface.geometry.dispose();
  surface.material.dispose();
  reticle.object.geometry.dispose();
  reticle.object.material.dispose();
});

test('Three hit reticle falls back to target world rotation when a face normal is absent', () => {
  let adapter = createXRThreeWebXRAdapter({ THREE: THREE_REAL });
  let scene = new THREE_REAL.Scene();
  let reticle = adapter.createPanelHitReticleVisual(scene);
  assert.equal(reticle.ok, true);

  let root = new THREE_REAL.Group();
  root.rotation.set(0.3, -0.5, 0.15);
  let target = new THREE_REAL.Object3D();
  target.rotation.set(-0.2, 0.4, -0.35);
  root.add(target);
  scene.add(root);
  scene.updateMatrixWorld(true);

  let point = new THREE_REAL.Vector3(0.2, 1.1, -0.8);
  let updated = adapter.updatePanelHitReticleVisual(reticle, { object: target, point, distance: 0.9 });
  assert.equal(updated.ok, true);

  scene.updateMatrixWorld(true);
  let expectedQuaternion = target.getWorldQuaternion(new THREE_REAL.Quaternion());
  let actualQuaternion = reticle.object.getWorldQuaternion(new THREE_REAL.Quaternion());
  assert.ok(actualQuaternion.angleTo(expectedQuaternion) < 1e-7);
  assert.ok(reticle.object.getWorldPosition(new THREE_REAL.Vector3()).distanceTo(point) < 1e-7);

  reticle.object.geometry.dispose();
  reticle.object.material.dispose();
});

test('Three adapter exposes its world-lockable scene root', () => {
  let adapter = createXRThreeWebXRAdapter({ THREE });
  let renderer = new Renderer();
  assert.equal(adapter.createRenderer({ renderer }).ok, true);
  assert.equal(renderer.xr.enabled, true);
  let result = adapter.setScene({ id: 'scene-1', panels: [] }, { mode: 'immersive-ar' });
  assert.equal(result.ok, true);
  assert.equal(adapter.getSceneRoot(), result.rootGroup);
  assert.equal(adapter.getSceneRoot().userData.xrSceneRoot, true);
});

test('Three adapter applies provider Euler rotations in Rz Ry Rx order', () => {
  let adapter = createXRThreeWebXRAdapter({ THREE });
  let renderer = new Renderer();
  assert.equal(adapter.createRenderer({ renderer }).ok, true);

  let result = adapter.setScene({
    id: 'scene-rotation-order',
    panels: [{
      id: 'chat',
      position: [0, 1.25, -1.4],
      rotation: [-8, 18, 0],
      size: [0.8, 0.6],
    }],
  }, { mode: 'immersive-ar' });

  assert.equal(result.ok, true);
  assert.deepEqual(adapter.getPanelMesh('chat').rotation.values, [
    -8 * Math.PI / 180,
    18 * Math.PI / 180,
    0,
    'ZYX',
  ]);
});

test('spatial evidence root cannot be committed without an active XR session', () => {
  let controller = createXRThreeSessionController({
    globalThis: {},
    adapter: {},
  });
  assert.deepEqual(controller.commitSpatialEvidence({}), {
    ok: false,
    reason: 'session-not-active',
  });
});

test('Three adapter handles world space dragging with a translated parent root group', () => {
  const mockRaycaster = new Raycaster();
  const adapter = createXRThreeWebXRAdapter({ THREE, raycaster: mockRaycaster });
  const renderer = new Renderer();
  assert.equal(adapter.createRenderer({ renderer }).ok, true);

  const result = adapter.setScene({
    id: 'scene-drag-test',
    panels: [{
      id: 'p-drag',
      position: [0, 0.5, 0], // Local starting position
      rotation: [0, 0, 0],
      size: [0.8, 0.6],
    }],
  }, { mode: 'immersive-ar' });

  assert.equal(result.ok, true);
  const mesh = adapter.getPanelMesh('p-drag');
  const rootGroup = adapter.getSceneRoot();

  rootGroup.position.set(0, 1.0, -1.0);

  let initialWorldPos = new Vector3();
  mesh.getWorldPosition(initialWorldPos);
  assert.deepEqual(initialWorldPos, new Vector3(0, 1.5, -1.0));

  const rayAdapter = adapter.controllerRays;
  const mockController = new Group();
  mockController.position.set(0, 1.6, 1.0);
  const mockCamera = new THREE.PerspectiveCamera();

  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(0.1, 1.5, -1.0);
    return target;
  };

  let beginResult = rayAdapter.beginDrag(mockController, mesh, mockCamera);
  assert.equal(beginResult.ok, true);

  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(0.2, 1.6, -0.9);
    return target;
  };

  let updateResult = rayAdapter.updateDrag(mockController);
  assert.equal(updateResult.ok, true);

  assert.equal(Math.abs(mesh.position.x - 0.072) < 0.001, true);
  assert.equal(Math.abs(mesh.position.y - 0.572) < 0.001, true);
  assert.equal(Math.abs(mesh.position.z - 0.072) < 0.001, true);
});

test('Three session controller manages frame timing, initial panel state, and final session snapshot', async () => {
  let sessionListeners = new Map();
  let session = {
    visibilityState: 'visible',
    enabledFeatures: ['local-floor'],
    inputSources: [],
    frameRate: 90,
    addEventListener(type, listener) {
      sessionListeners.set(type, listener);
    },
    removeEventListener(type) {
      sessionListeners.delete(type);
    },
    async end() {
      sessionListeners.get('end')?.();
    },
  };

  let animationLoop = null;
  let renderer = {
    xr: {
      async setSession() {},
      setAnimationLoop(callback) {
        animationLoop = callback;
      },
    },
  };

  let panelMesh = new Mesh();
  panelMesh.position.set(1, 2, 3);
  panelMesh.userData = {
    panelId: 'panel-a',
    panel: {
      portable: true,
      pinned: false,
      focused: false,
    },
  };
  let adapter = {
    async setSession(s) {
      return { ok: true, session: s, referenceSpace: {} };
    },
    listPanelMeshes() {
      return [panelMesh];
    },
    getDiagnostics() {
      return {};
    },
  };

  let globalThis = {
    navigator: {
      xr: {
        async requestSession() {
          return session;
        },
      },
    },
  };

  let controller = createXRThreeSessionController({
    globalThis,
    adapter,
  });

  let started = await controller.start('immersive-vr', {
    target: { ok: true, renderer, camera: {}, scene: new Scene() },
    controllerRayVisuals: false,
    panelHitReticle: false,
  });

  assert.equal(started.ok, true);

  // Record a few frames
  animationLoop(1000, { predictedDisplayTime: 1000 });
  animationLoop(1016, { predictedDisplayTime: 1016 });
  animationLoop(1033, { predictedDisplayTime: 1033 });

  // Stop the session
  await controller.stop();

  // Retrieve the final snapshot
  let snapshot = controller.getFinalSessionSnapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.version, 'xr-final-session-snapshot-v1');
  assert.equal(snapshot.facts.teardownReason, 'stop-called');
  assert.equal(snapshot.receipts.length, 0);
  assert.equal(snapshot.frameTiming.nominalFrameRate, 90);
  assert.equal(snapshot.frameTiming.sampleCount, 3);
  assert.equal(snapshot.panelState.panels[0].id, 'panel-a');
  assert.deepEqual(snapshot.panelState.panels[0].current.position, [1, 2, 3]);
});

test('session controller routes exact primitive capture through one arbiter ray and recreates it on restart', async () => {
  let targetObject = new THREE_REAL.Object3D();
  let hit = {
    object: targetObject,
    distance: 0.75,
    point: new THREE_REAL.Vector3(0, 0, -0.75),
    primitive: 'window/resize-northEast',
  };
  let intersections = 0;
  let interactionRaycaster = {
    ray: { origin: new THREE_REAL.Vector3(), direction: new THREE_REAL.Vector3(0, 0, -1) },
    set(origin, direction) {
      this.ray.origin.copy(origin);
      this.ray.direction.copy(direction);
    },
    intersectObjects(objects) {
      intersections += 1;
      assert.deepEqual(objects, [targetObject]);
      return hit ? [hit] : [];
    },
  };
  let controllerObject = new THREE_REAL.Group();
  let controllerObjects = [controllerObject, new THREE_REAL.Group()];
  let controllerGrips = [new THREE_REAL.Group(), new THREE_REAL.Group()];
  controllerGrips[0].position.set(0.2, 1.3, -0.1);
  let renderer = {
    xr: {
      getController: (index) => controllerObjects[index],
      getControllerGrip: (index) => controllerGrips[index],
      setAnimationLoop(callback) { this.loop = callback; },
    },
    render() {},
  };
  let sessions = [];
  let makeSession = (source) => {
    let listeners = new Map();
    let session = {
      source,
      listeners,
      visibilityState: 'visible',
      inputSources: [source],
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type) { listeners.delete(type); },
      async end() { listeners.get('end')?.(); },
    };
    sessions.push(session);
    return session;
  };
  let sourceOne = { id: 'right-1', handedness: 'right', targetRayMode: 'tracked-pointer', profiles: [] };
  let sourceTwo = { id: 'right-2', handedness: 'right', targetRayMode: 'tracked-pointer', profiles: [] };
  let requested = [makeSession(sourceOne), makeSession(sourceTwo)];
  let adapter = {
    async setSession(session) { return { ok: true, session, referenceSpace: {} }; },
    listPanelMeshes: () => [],
    controllerRays: { getHits() { throw new Error('legacy acquisition path used'); } },
    getDiagnostics: () => ({}),
  };
  let controller = createXRThreeSessionController({
    globalThis: { navigator: { xr: { requestSession: async () => requested.shift() } } },
    adapter,
    THREE: THREE_REAL,
    interactionRaycaster,
  });
  let events = [];
  controller.registerInteractionTarget({
    ownerId: 'raster-layouts',
    id: 'chat',
    generation: 9,
    objects: [targetObject],
    resolveHit: (rawHit) => ({
      primitiveId: rawHit.primitive,
      contentPoint: { x: 0.9, y: 0.1 },
    }),
    onPress: (identity, details) => events.push(['press', identity, details]),
    onMove: (identity, details) => events.push(['move', identity, details]),
    onRelease: (identity, details) => events.push(['release', identity, details]),
    onCancel: (identity, details) => events.push(['cancel', identity, details]),
  });
  let target = { ok: true, renderer, camera: new THREE_REAL.PerspectiveCamera(), scene: new THREE_REAL.Scene() };
  assert.equal((await controller.start('immersive-vr', {
    target, controllerRayVisuals: false, panelHitReticle: false, renderFrame: false,
  })).ok, true);
  controllerObject.dispatchEvent({ type: 'connected', data: sourceOne });
  renderer.xr.loop(100, { predictedDisplayTime: 100, getViewerPose: () => null });
  assert.equal(intersections, 1);
  controllerObject.dispatchEvent({ type: 'selectstart', data: sourceOne });
  assert.equal(intersections, 1, 'selectstart consumes the frame winner without re-raycasting');
  let press = events.at(-1);
  assert.equal(press[0], 'press');
  assert.deepEqual(press[1], {
    sourceId: 'right-1', ownerId: 'raster-layouts', targetId: 'chat', targetGeneration: 9,
  });
  assert.equal(press[2].hit.resolved.primitiveId, 'window/resize-northEast');
  assert.deepEqual(press[2].source.controllerPose.position, { x: 0.2, y: 1.3, z: -0.1 });
  assert.deepEqual(press[2].source.controllerPose.quaternion, [0, 0, 0, 1]);
  assert.equal(controller.getDiagnostics().lastPressTransition?.phase, 'selectstart');
  assert.equal(controller.getDiagnostics().lastPressTransition?.sourceId, 'right-1');

  hit = { ...hit, primitive: 'window/content', distance: 0.5 };
  renderer.xr.loop(116, { predictedDisplayTime: 116, getViewerPose: () => null });
  let move = events.find(([phase]) => phase === 'move');
  assert.equal(move[2].captureHit.resolved.primitiveId, 'window/resize-northEast');
  assert.equal(move[2].winningHit, null, 'active capture does not raycast or replace its latched hit');
  controllerObject.dispatchEvent({ type: 'selectend', data: sourceOne });
  assert.equal(intersections, 1, 'captured frames and selectend avoid re-raycast');
  let release = events.find(([phase]) => phase === 'release');
  assert.equal(release[2].captureHit.resolved.primitiveId, 'window/resize-northEast');
  assert.equal(controller.getDiagnostics().lastReleaseTransition?.phase, 'selectend');
  assert.equal(controller.getDiagnostics().lastReleaseTransition?.sourceId, 'right-1');

  renderer.xr.loop(132, { predictedDisplayTime: 132, getViewerPose: () => null });
  controllerObject.dispatchEvent({ type: 'selectstart', data: sourceOne });
  sessions[0].visibilityState = 'hidden';
  sessions[0].listeners.get('visibilitychange')?.();
  assert.equal(events.at(-1)[0], 'cancel');
  assert.equal(events.at(-1)[2].reason, 'visibility-hidden');

  sessions[0].visibilityState = 'visible';
  sessions[0].listeners.get('visibilitychange')?.();
  renderer.xr.loop(148, { predictedDisplayTime: 148, getViewerPose: () => null });
  controllerObject.dispatchEvent({ type: 'selectstart', data: sourceOne });
  sessions[0].inputSources = [];
  sessions[0].listeners.get('inputsourceschange')?.({ removed: [sourceOne], added: [] });
  assert.equal(events.at(-1)[2].reason, 'source-lost');

  await controller.stop();
  assert.equal(controller.getInteractionDiagnostics().active, false);
  assert.deepEqual(controller.getDiagnostics().resources, {
    geometries: 0,
    textures: 0,
    renderTargets: 0,
    calls: 0,
    triangles: 0,
    controllers: 0,
    controllerGrips: 0,
    controllerListeners: 0,
    interactionTargets: 1,
    interactionCaptures: 0,
  });
  assert.equal((await controller.start('immersive-vr', {
    target, controllerRayVisuals: false, panelHitReticle: false, renderFrame: false,
  })).ok, true);
  controllerObject.dispatchEvent({ type: 'connected', data: sourceTwo });
  renderer.xr.loop(200, { predictedDisplayTime: 200, getViewerPose: () => null });
  controllerObject.dispatchEvent({ type: 'selectstart', data: sourceTwo });
  assert.equal(events.at(-1)[0], 'press', 'persistent registration is active on a fresh session arbiter');
  await controller.stop();
});

test('session controller keeps independent focus and reticle state for both controllers', async () => {
  let leftObject = new THREE_REAL.Mesh(new THREE_REAL.PlaneGeometry(0.2, 0.2), new THREE_REAL.MeshBasicMaterial());
  let rightObject = new THREE_REAL.Mesh(new THREE_REAL.PlaneGeometry(0.2, 0.2), new THREE_REAL.MeshBasicMaterial());
  leftObject.userData.panelId = 'left-panel';
  rightObject.userData.panelId = 'right-panel';
  let controllers = [new THREE_REAL.Group(), new THREE_REAL.Group()];
  controllers[0].position.x = -0.2;
  controllers[1].position.x = 0.2;
  let renderer = {
    xr: {
      getController: (index) => controllers[index],
      getControllerGrip: () => null,
      setAnimationLoop(callback) { this.loop = callback; },
    },
    render() {},
  };
  let leftSource = { id: 'left', handedness: 'left', targetRayMode: 'tracked-pointer', profiles: [] };
  let rightSource = { id: 'right', handedness: 'right', targetRayMode: 'tracked-pointer', profiles: [] };
  let listeners = new Map();
  let session = {
    visibilityState: 'visible',
    inputSources: [leftSource, rightSource],
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    async end() { listeners.get('end')?.(); },
  };
  let intersectionsBySide = { left: 0, right: 0 };
  let raycaster = {
    ray: { origin: new THREE_REAL.Vector3(), direction: new THREE_REAL.Vector3(0, 0, -1) },
    set(origin, direction) { this.ray.origin.copy(origin); this.ray.direction.copy(direction); },
    intersectObjects() {
      intersectionsBySide[this.ray.origin.x < 0 ? 'left' : 'right'] += 1;
      let object = this.ray.origin.x < 0 ? leftObject : rightObject;
      return [{
        object,
        distance: 1,
        point: new THREE_REAL.Vector3(this.ray.origin.x, 0, -1),
        face: { normal: new THREE_REAL.Vector3(0, 0, 1) },
      }];
    },
  };
  let visualAdapter = createXRThreeWebXRAdapter({ THREE: THREE_REAL });
  let adapter = {
    THREE: THREE_REAL,
    async setSession(next) { return { ok: true, session: next, referenceSpace: {} }; },
    listPanelMeshes: () => [],
    getDiagnostics: () => ({}),
    createPanelHitReticleVisual: visualAdapter.createPanelHitReticleVisual,
    updatePanelHitReticleVisual: visualAdapter.updatePanelHitReticleVisual,
  };
  let controller = createXRThreeSessionController({
    globalThis: { navigator: { xr: { requestSession: async () => session } } },
    adapter,
    THREE: THREE_REAL,
    interactionRaycaster: raycaster,
  });
  controller.registerInteractionTarget({
    ownerId: 'workspace',
    id: 'panels',
    generation: 1,
    objects: [leftObject, rightObject],
    resolveHit: (hit) => ({
      primitiveId: `${hit.object.userData.panelId}/content`,
      operation: hit.object.userData.operation || 'focus',
    }),
    onPress: (_identity, details) => {
      if (details.hit?.object?.userData?.kind !== 'equipment-hit-proxy') return;
      leftObject.position.set(-0.05, 0.12, -0.08);
      leftObject.rotation.set(-0.17, 0.24, -0.11);
      leftObject.scale.setScalar(1.2);
      leftObject.updateMatrixWorld(true);
    },
  });
  let scene = new THREE_REAL.Scene();
  assert.equal((await controller.start('immersive-ar', {
    target: { ok: true, renderer, camera: new THREE_REAL.PerspectiveCamera(), scene },
    controllerRayVisuals: false,
    renderFrame: false,
  })).ok, true);
  controllers[0].dispatchEvent({ type: 'connected', data: leftSource });
  controllers[1].dispatchEvent({ type: 'connected', data: rightSource });
  renderer.xr.loop(100, { predictedDisplayTime: 100, getViewerPose: () => null });
  let diagnostics = controller.getDiagnostics();
  assert.deepEqual(diagnostics.hovers.map((hover) => [hover.sourceId, hover.panelId]), [
    ['left', 'left-panel'],
    ['right', 'right-panel'],
  ]);
  let reticles = scene.children.filter((object) => object.userData?.snPanelHitReticle);
  assert.equal(reticles.length, 2);
  assert.ok(reticles.every((reticle) => reticle.visible));
  assert.notEqual(reticles[0].position.x, reticles[1].position.x);

  rightObject.userData.operation = 'move-menu';
  renderer.xr.loop(108, { predictedDisplayTime: 108, getViewerPose: () => null });
  let rightStart = reticles[1].position.clone();
  controllers[1].dispatchEvent({ type: 'selectstart', data: rightSource });
  controllers[1].position.x = 0.45;
  renderer.xr.loop(116, { predictedDisplayTime: 116, getViewerPose: () => null });
  assert.notEqual(reticles[1].position.x, rightStart.x, 'menu capture reticle follows current controller pose without raycasting');
  assert.equal(controller.getDiagnostics().hovers[1].reticleControllerFollowing, true);
  controllers[1].dispatchEvent({ type: 'selectend', data: rightSource });

  leftObject.userData.kind = 'equipment-hit-proxy';
  leftObject.userData.operation = 'move';
  renderer.xr.loop(132, { predictedDisplayTime: 132, getViewerPose: () => null });
  let equipmentHitWorld = reticles[0].position.clone();
  let equipmentLocalAnchor = leftObject.worldToLocal(equipmentHitWorld.clone());
  controllers[0].dispatchEvent({ type: 'selectstart', data: leftSource });
  let leftIntersectionsAtCapture = intersectionsBySide.left;
  leftObject.position.set(0.45, 0.3, -0.25);
  leftObject.rotation.set(0.32, -0.48, 0.21);
  leftObject.scale.setScalar(1.6);
  leftObject.updateMatrixWorld(true);
  let expectedEquipmentReticle = leftObject.localToWorld(equipmentLocalAnchor.clone());
  renderer.xr.loop(148, { predictedDisplayTime: 148, getViewerPose: () => null });
  assert.ok(
    reticles[0].position.distanceTo(expectedEquipmentReticle) < 1e-9,
    'equipment reticle follows the original object-local hit through translation, rotation and scale',
  );
  assert.equal(
    intersectionsBySide.left,
    leftIntersectionsAtCapture,
    'captured equipment reticle pose never raycasts that controller again',
  );
  assert.equal(controller.getDiagnostics().hovers[0].reticleFrozen, true);
  assert.equal(controller.getDiagnostics().hovers[0].reticleObjectAnchored, true);
  controllers[0].dispatchEvent({ type: 'selectend', data: leftSource });
  renderer.xr.loop(164, { predictedDisplayTime: 164, getViewerPose: () => null });
  assert.ok(intersectionsBySide.left > leftIntersectionsAtCapture, 'ordinary focus raycasts resume after release');
  await controller.stop();
  leftObject.geometry.dispose();
  leftObject.material.dispose();
  rightObject.geometry.dispose();
  rightObject.material.dispose();
});

test('session controller keeps explicit controller bindings when inputSources reorder', async () => {
  let targetObject = new THREE_REAL.Object3D();
  let interactionRaycaster = {
    ray: { origin: new THREE_REAL.Vector3(), direction: new THREE_REAL.Vector3(0, 0, -1) },
    set(origin, direction) {
      this.ray.origin.copy(origin);
      this.ray.direction.copy(direction);
    },
    intersectObjects() {
      return [{
        object: targetObject,
        distance: 1,
        point: new THREE_REAL.Vector3(this.ray.origin.x, 0, -1),
      }];
    },
  };
  let leftController = new THREE_REAL.Group();
  leftController.position.x = -1;
  let rightController = new THREE_REAL.Group();
  rightController.position.x = 1;
  let renderer = {
    xr: {
      getController: (index) => [leftController, rightController][index],
      setAnimationLoop(callback) { this.loop = callback; },
    },
    render() {},
  };
  let left = { id: 'left-source', handedness: 'left', targetRayMode: 'tracked-pointer', profiles: [] };
  let right = { id: 'right-source', handedness: 'right', targetRayMode: 'tracked-pointer', profiles: [] };
  let listeners = new Map();
  let session = {
    visibilityState: 'visible',
    inputSources: [right, left],
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type) { listeners.delete(type); },
    async end() { listeners.get('end')?.(); },
  };
  let adapter = {
    async setSession(value) { return { ok: true, session: value, referenceSpace: {} }; },
    listPanelMeshes: () => [],
    getDiagnostics: () => ({}),
  };
  let controller = createXRThreeSessionController({
    globalThis: { navigator: { xr: { requestSession: async () => session } } },
    adapter,
    THREE: THREE_REAL,
    interactionRaycaster,
  });
  let events = [];
  controller.registerInteractionTarget({
    ownerId: 'panels', id: 'chat', generation: 1, objects: [targetObject],
    resolveHit: () => ({ primitiveId: 'chat/content' }),
    onPress: (identity, details) => events.push(['press', identity, details.ray.origin.x]),
    onMove: (identity, details) => events.push(['move', identity, details.ray.origin.x]),
  });
  let target = { ok: true, renderer, camera: new THREE_REAL.PerspectiveCamera(), scene: new THREE_REAL.Scene() };
  assert.equal((await controller.start('immersive-vr', {
    target, controllerRayVisuals: false, panelHitReticle: false, renderFrame: false,
  })).ok, true);
  leftController.dispatchEvent({ type: 'connected', data: left });
  rightController.dispatchEvent({ type: 'connected', data: right });
  renderer.xr.loop(100, { predictedDisplayTime: 100, getViewerPose: () => null });
  leftController.dispatchEvent({ type: 'selectstart', data: left });
  assert.deepEqual(events[0], [
    'press',
    { sourceId: 'left-source', ownerId: 'panels', targetId: 'chat', targetGeneration: 1 },
    -1,
  ]);

  session.inputSources = [left, right];
  renderer.xr.loop(116, { predictedDisplayTime: 116, getViewerPose: () => null });
  let move = events.find(([phase]) => phase === 'move');
  assert.equal(move[1].sourceId, 'left-source');
  assert.equal(move[2], -1, 'reordering session sources cannot transfer the left source to the right controller');
  leftController.dispatchEvent({ type: 'selectend', data: left });
  await controller.stop();
});

test('controller ray visual stops at the nearest winner and fades transparently at both ends', () => {
  let adapter = createXRThreeWebXRAdapter({ THREE: THREE_REAL });
  let controller = new THREE_REAL.Group();
  let visual = adapter.createControllerRayVisual(controller, { length: 4, opacity: 0.8 });
  assert.equal(visual.ok, true);
  let line = visual.object;
  assert.equal(line.material.type, 'ShaderMaterial');
  assert.deepEqual([...line.geometry.getAttribute('snRayAlpha').array], [0, 0.800000011920929, 0]);
  assert.equal(line.userData.updateHitDistance(1.5), 1.5);
  assert.deepEqual([...line.geometry.getAttribute('position').array], [0, 0, 0, 0, 0, -0.75, 0, 0, -1.5]);
  assert.equal(line.userData.updateHitDistance(Infinity), 4);
});

test('Three adapter handles world space dragging with a transformed root containing translation and rotation', () => {
  const mockRaycaster = new Raycaster();
  const adapter = createXRThreeWebXRAdapter({ THREE, raycaster: mockRaycaster, dragSmoothing: 1.0, maxDragStep: 99.0 });
  const renderer = new Renderer();
  assert.equal(adapter.createRenderer({ renderer }).ok, true);

  const result = adapter.setScene({
    id: 'scene-rotated-drag',
    panels: [{
      id: 'p-rotated-drag',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      size: [0.8, 0.6],
    }],
  }, { mode: 'immersive-ar' });

  assert.equal(result.ok, true);
  const mesh = adapter.getPanelMesh('p-rotated-drag');
  const rootGroup = adapter.getSceneRoot();

  // Set translation and rotation on rootGroup
  rootGroup.position.set(1.0, 2.0, -3.0);
  rootGroup.quaternion.set(0, 0.7071, 0, 0.7071);

  rootGroup.worldToLocal = (v) => {
    v.sub(rootGroup.position);
    let tempX = v.z;
    let tempZ = -v.x;
    v.x = tempX;
    v.z = tempZ;
    return v;
  };

  const rayAdapter = adapter.controllerRays;
  const mockController = new Group();
  mockController.position.set(0, 0, 0);
  const mockCamera = new THREE.PerspectiveCamera();

  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(2.0, 3.0, -1.0);
    return target;
  };

  let beginResult = rayAdapter.beginDrag(mockController, mesh, mockCamera);
  assert.equal(beginResult.ok, true);

  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(3.0, 4.0, 0.0);
    return target;
  };

  let updateResult = rayAdapter.updateDrag(mockController);
  assert.equal(updateResult.ok, true);

  assert.equal(Math.abs(mesh.position.x - 1.0) < 0.001, true);
  assert.equal(Math.abs(mesh.position.y - 1.0) < 0.001, true);
  assert.equal(Math.abs(mesh.position.z - (-1.0)) < 0.001, true);
});

test('Three adapter resizes symmetrically from the window center', () => {
  const mockRaycaster = new Raycaster();
  const adapter = createXRThreeWebXRAdapter({ THREE, raycaster: mockRaycaster });
  const renderer = new Renderer();
  assert.equal(adapter.createRenderer({ renderer }).ok, true);

  const result = adapter.setScene({
    id: 'scene-resize-test',
    panels: [{
      id: 'p-resize',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      size: [0.8, 0.6],
    }],
  }, { mode: 'immersive-ar' });

  assert.equal(result.ok, true);
  const mesh = adapter.getPanelMesh('p-resize');

  const rayAdapter = adapter.controllerRays;
  const mockController = new Group();
  const mockCamera = new THREE.PerspectiveCamera();

  // Test East resizing
  mesh.position.set(0, 0, 0);
  mesh.userData.xrSize = [0.8, 0.6];
  mesh.userData.baseSize = [0.8, 0.6];
  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(0, 0, 0);
    return target;
  };

  mesh.userData.lastFrameTarget = {
    version: 'xr-panel-frame-target-v1',
    panelId: 'p-resize',
    zone: 'resize',
    operation: 'resize',
    handle: 'east',
  };

  let beginResult = rayAdapter.beginDrag(mockController, mesh, mockCamera);
  assert.equal(beginResult.ok, true);

  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(0.2, 0, 0);
    return target;
  };

  let updateResult = rayAdapter.updateDrag(mockController);
  assert.equal(updateResult.ok, true);

  let currentSize = readPanelSize(mesh);
  assert.deepEqual(currentSize, [1.2000000000000002, 0.6]);
  assert.equal(mesh.position.x, 0);
  assert.equal(mesh.position.y, 0);
  assert.equal(mesh.position.z, 0);

  // Test West resizing
  mesh.position.set(0, 0, 0);
  mesh.userData.xrSize = [0.8, 0.6];
  mesh.userData.baseSize = [0.8, 0.6];
  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(0, 0, 0);
    return target;
  };
  mesh.userData.lastFrameTarget.handle = 'west';

  beginResult = rayAdapter.beginDrag(mockController, mesh, mockCamera);
  assert.equal(beginResult.ok, true);

  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(0.2, 0, 0);
    return target;
  };

  updateResult = rayAdapter.updateDrag(mockController);
  assert.equal(updateResult.ok, true);

  currentSize = readPanelSize(mesh);
  assert.equal(Math.abs(currentSize[0] - 0.4) < 0.001, true);
  assert.equal(Math.abs(currentSize[1] - 0.6) < 0.001, true);
  assert.equal(mesh.position.x, 0);
});

test('Three adapter real Three.js conformed tests with rotated root', () => {
  // Create a real Three.js scene
  const scene = new THREE_REAL.Scene();

  // Create a rotated root group with translation
  const root = new THREE_REAL.Group();
  root.position.set(1.2, -0.8, 1.5);
  root.rotation.set(0.2, -0.4, 0.1);
  scene.add(root);
  scene.updateMatrixWorld(true);

  // Create a mock raycaster that returns the intersection point in world space
  const mockRaycaster = new THREE_REAL.Raycaster();

  // Initialize the adapter with real THREE, mock raycaster, and disable smoothing
  const adapter = createXRThreeWebXRAdapter({ THREE: THREE_REAL, raycaster: mockRaycaster, dragSmoothing: 1.0 });

  // Set the scene in the adapter
  const result = adapter.setScene({
    id: 'real-scene',
    panels: [{
      id: 'panel-real',
      position: [0.5, 0.2, -0.3], // parent-local coordinates
      rotation: [0, 0, 0],
      size: [0.8, 0.6]
    }]
  }, { mode: 'immersive-vr' });

  assert.equal(result.ok, true);

  // Retrieve the panel mesh and add it to the rotated root group
  const mesh = adapter.getPanelMesh('panel-real');
  assert.ok(mesh);
  root.add(mesh); // Add to the rotated root group!
  scene.updateMatrixWorld(true);

  // 1. Prove local settlement equals root.worldToLocal(expectedWorld)
  const expectedWorldPos = new THREE_REAL.Vector3(2.5, 1.0, -0.5);
  const expectedLocalPos = expectedWorldPos.clone();
  root.worldToLocal(expectedLocalPos);

  // Update mesh position directly
  mesh.position.copy(expectedLocalPos);
  scene.updateMatrixWorld(true);

  // Verify that the local position of the mesh equals root.worldToLocal(expectedWorld)
  const actualWorldPos = new THREE_REAL.Vector3();
  mesh.getWorldPosition(actualWorldPos);

  // The mesh's world position should be exactly expectedWorldPos (within numerical tolerance)
  assert.ok(actualWorldPos.distanceTo(expectedWorldPos) < 1e-5);
  assert.ok(mesh.position.distanceTo(expectedLocalPos) < 1e-5);

  // 2. Prove east resize expands symmetrically around the window center
  // Start with a clean setup: panel size 0.8 x 0.6, parent-local position (0.5, 0.2, -0.3)
  mesh.position.set(0.5, 0.2, -0.3);
  mesh.rotation.set(0, 0, 0);
  applyPanelSize(mesh, [0.8, 0.6]);
  scene.updateMatrixWorld(true);

  // Record initial west edge in world space
  const initialWestLocal = new THREE_REAL.Vector3(-0.4, 0, 0); // -width/2
  const initialWestWorld = new THREE_REAL.Vector3();
  mesh.localToWorld(initialWestWorld.copy(initialWestLocal));

  // Mock a drag resize operation from the East handle
  const rayAdapter = adapter.controllerRays;
  const mockController = new THREE_REAL.Group();
  mockController.position.set(0, 0, 0);
  const mockCamera = new THREE_REAL.PerspectiveCamera();

  // Let's call beginDrag with the mock raycaster

  // Let's mock a resize operation.
  // We set lastFrameTarget on the mesh userData:
  mesh.userData.lastFrameTarget = {
    version: 'xr-panel-frame-target-v1',
    panelId: 'panel-real',
    zone: 'resize',
    operation: 'resize',
    handle: 'east',
  };

  // Start intersection is at local x = 0.4 (the east edge)
  const startLocalIntersection = new THREE_REAL.Vector3(0.4, 0, 0);
  const startWorldIntersection = new THREE_REAL.Vector3();
  mesh.localToWorld(startWorldIntersection.copy(startLocalIntersection));

  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.copy(startWorldIntersection);
    return target;
  };

  let beginResult = rayAdapter.beginDrag(mockController, mesh, mockCamera);
  assert.equal(beginResult.ok, true);

  // Drag the intersection 0.2 meters along the x-axis in world space (which is east)
  // Get the world x-axis of the panel:
  const worldQuaternion = new THREE_REAL.Quaternion();
  mesh.getWorldQuaternion(worldQuaternion);
  const xAxis = new THREE_REAL.Vector3(1, 0, 0);
  xAxis.applyQuaternion(worldQuaternion).normalize();

  const endWorldIntersection = startWorldIntersection.clone().addScaledVector(xAxis, 0.2);
  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.copy(endWorldIntersection);
    return target;
  };

  // Update drag. This will calculate the new size and shift the mesh position
  let updateResult = rayAdapter.updateDrag(mockController);
  assert.equal(updateResult.ok, true);
  scene.updateMatrixWorld(true);

  // A 0.2 m corner delta adds 0.4 m to the full width.
  const currentSize = readPanelSize(mesh);
  assert.ok(Math.abs(currentSize[0] - 1.2) < 1e-4);

  const finalWestLocal = new THREE_REAL.Vector3(-0.6, 0, 0);
  const finalWestWorld = new THREE_REAL.Vector3();
  mesh.localToWorld(finalWestWorld.copy(finalWestLocal));

  assert.ok(finalWestWorld.distanceTo(initialWestWorld) > 0.19);
  assert.ok(mesh.position.distanceTo(new THREE_REAL.Vector3(0.5, 0.2, -0.3)) < 1e-5);

  // 3. Prove frame corners remain aligned and handles have scale (1,1,1)
  const visualSummary = mesh.userData.panelFrameVisuals;
  assert.ok(visualSummary.ok);
  assert.equal(visualSummary.type, 'panel-frame-visuals');

  // Verify the northWest handle
  const nwHandle = mesh.children.find(child => child.name === 'sn-xr-panel-frame-resize-northWest');
  assert.ok(nwHandle, "northWest resize handle not found");

  // Handle scale must be exactly 1,1,1 (rebuilt in unscaled coordinates)
  assert.equal(nwHandle.scale.x, 1);
  assert.equal(nwHandle.scale.y, 1);
  assert.equal(nwHandle.scale.z, 1);

  // Horizon-style grips are placed completely outside the corners, so the nwHandle centers on the
  // north-west offset corner.
  const expectedNWLocalX = -1.2 / 2;
  const expectedNWLocalY = 0.6 / 2;

  assert.ok(Math.abs(nwHandle.position.x - expectedNWLocalX) < 1e-5);
  assert.ok(Math.abs(nwHandle.position.y - expectedNWLocalY) < 1e-5);
});


test('panel frame meter chrome keeps constant physical size across panel sizes', () => {
  const legacy = createXRPanelFrame({ id: 'p' });
  assert.equal(legacy.version, 'xr-panel-frame-v1');
  assert.ok(Math.abs(legacy.zones.move.height * 0.45 - 0.064) < 1e-9);
  assert.ok(Math.abs((legacy.zones.move.y - 1) * 0.45 - 0.045) < 1e-9);
  assert.ok(Math.abs(legacy.zones.resize.northWest.width * 0.8 - 0.044) < 1e-9);
  assert.ok(Math.abs(legacy.zones.actions.close.width * 0.8 - 0.038) < 1e-9);
  assert.equal(Object.keys(legacy.zones.edges).length, 4);

  const meterOptions = {
    handleSizeMeters: 0.024,
    footerHeightMeters: 0.035,
    actionSizeMeters: 0.030,
    footerGapMeters: 0.008,
    edgeGapMeters: 0.002,
    edgeHitDepthMeters: 0.005,
  };
  let previous = null;
  for (const size of [[0.8, 0.45], [1.6, 0.9]]) {
    const frame = createXRPanelFrame({ id: 'p', size }, meterOptions);
    // The exported layout helper is the single source of truth for zones.
    assert.deepEqual(frame.zones, computeXRPanelChromeLayout(size, meterOptions));
    // UV zone * panel size = constant physical meters at both sizes.
    assert.ok(Math.abs(frame.zones.move.height * size[1] - 0.042) < 1e-9);
    assert.ok(Math.abs((frame.zones.move.y - 1) * size[1] - 0.027) < 1e-9);
    assert.ok(Math.abs(frame.zones.actions.close.width * size[0] - 0.030) < 1e-9);
    assert.ok(Math.abs(frame.zones.resize.northWest.width * size[0] - 0.024) < 1e-9);
    assert.ok(Math.abs(frame.zones.resize.northWest.height * size[1] - 0.024) < 1e-9);
    if (previous) {
      assert.ok(
        frame.zones.move.height < previous.zones.move.height,
        'UV chrome must shrink as the panel grows',
      );
    }
    previous = frame;
  }
});

test('Three adapter rebuilds meter-chrome hit zones and chrome surface after resize', () => {
  const mockRaycaster = new Raycaster();
  const adapter = createXRThreeWebXRAdapter({ THREE, raycaster: mockRaycaster });
  const renderer = new Renderer();
  assert.equal(adapter.createRenderer({ renderer }).ok, true);

  const meterFrame = {
    handleSizeMeters: 0.024,
    footerHeightMeters: 0.12,
    actionSizeMeters: 0.030,
    footerGapMeters: 0.008,
  };
  const result = adapter.setScene({
    id: 'scene-meter-chrome',
    panels: [{
      id: 'p-meter',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      size: [0.8, 0.6],
    }],
  }, { mode: 'immersive-ar', panelFrameVisuals: { frame: meterFrame } });
  assert.equal(result.ok, true);
  const mesh = adapter.getPanelMesh('p-meter');

  // The hit-test frame sees the same meter options as the visuals.
  const before = mesh.userData.panelFrame;
  assert.ok(Math.abs(before.zones.move.height * 0.6 - 0.12) < 1e-9);
  assert.ok(Math.abs(before.zones.resize.northWest.width * 0.8 - 0.024) < 1e-9);

  // Chrome hit surface extends past the footer band: gap + footer + margin,
  // which here exceeds the legacy fractional floor (max(0.1, 0.6*0.18)).
  const extendBefore = mesh.userData.chromeSurface.userData.extend;
  assert.ok(Math.abs(extendBefore.y - (0.045 + 0.12 + 0.02)) < 1e-9);
  assert.ok(Math.abs(extendBefore.x - Math.max(0.06, 0.8 * 0.08)) < 1e-9);

  // Simulate a center-anchored east drag-resize: 0.8 -> 1.2 m wide.
  mesh.userData.lastFrameTarget = {
    version: 'xr-panel-frame-target-v1',
    panelId: 'p-meter',
    zone: 'resize',
    operation: 'resize',
    handle: 'east',
  };
  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(0, 0, 0);
    return target;
  };
  const rayAdapter = adapter.controllerRays;
  const mockController = new Group();
  const mockCamera = new THREE.PerspectiveCamera();
  assert.equal(rayAdapter.beginDrag(mockController, mesh, mockCamera).ok, true);
  mockRaycaster.ray.intersectPlane = (plane, target) => {
    target.set(0.2, 0, 0);
    return target;
  };
  assert.equal(rayAdapter.updateDrag(mockController).ok, true);
  assert.deepEqual(readPanelSize(mesh), [1.2000000000000002, 0.6]);

  // The hit-test frame was rebuilt for the new size, not left stale.
  const after = mesh.userData.panelFrame;
  assert.notEqual(after, before);
  assert.ok(Math.abs(after.zones.move.height * 0.6 - 0.12) < 1e-9);
  assert.ok(Math.abs(after.zones.resize.northWest.width * 1.2 - 0.024) < 1e-9);
  assert.ok(Math.abs(after.zones.actions.close.width * 1.2 - 0.030) < 1e-9);
  assert.ok(after.zones.resize.northWest.width < before.zones.resize.northWest.width);

  // Hit-zone correctness: a point inside the OLD grip UV but outside the new
  // one must no longer hit resize; the move bar stays hittable at its center.
  const probe = { x: -0.012, y: 0 };
  assert.equal(hitTestXRPanelFrame(before, probe)?.zone, 'resize');
  assert.equal(hitTestXRPanelFrame(after, probe), null);
  const moveCenter = {
    x: after.zones.move.x + after.zones.move.width / 2,
    y: after.zones.move.y + after.zones.move.height / 2,
  };
  assert.equal(hitTestXRPanelFrame(after, moveCenter)?.zone, 'move');

  // Chrome surface extents were recomputed from the rebuilt frame.
  const extendAfter = mesh.userData.chromeSurface.userData.extend;
  assert.ok(Math.abs(extendAfter.y - (0.045 + 0.12 + 0.02)) < 1e-9);
  assert.ok(Math.abs(extendAfter.x - Math.max(0.06, 1.2 * 0.08)) < 1e-9);
});

// --- Portable panel close/restore (window chrome close action) ---

async function createCloseHarness(options = {}) {
  let source = {
    id: 'controller-right',
    handedness: 'right',
    targetRayMode: 'tracked-pointer',
    profiles: ['meta-quest-touch-plus'],
    targetRaySpace: {},
    gripSpace: {},
  };
  let sessionListeners = new Map();
  let session = {
    visibilityState: 'visible',
    enabledFeatures: ['local-floor'],
    inputSources: [source],
    frameRate: 90,
    addEventListener(type, listener) {
      sessionListeners.set(type, listener);
    },
    removeEventListener(type) {
      sessionListeners.delete(type);
    },
    async end() {
      sessionListeners.get('end')?.();
    },
  };
  let animationLoop = null;
  let controllers = [new THREE_REAL.Group(), new THREE_REAL.Group()];
  let renderer = {
    xr: {
      async setSession() {},
      getController(index) {
        return controllers[index];
      },
      setAnimationLoop(callback) {
        animationLoop = callback;
      },
    },
    render() {},
  };
  let sceneRoot = new THREE_REAL.Group();
  let mesh = new THREE_REAL.Mesh(
    new THREE_REAL.PlaneGeometry(0.8, 0.5),
    new THREE_REAL.MeshBasicMaterial(),
  );
  mesh.position.set(0, 1.4, -1);
  mesh.userData = {
    panelId: 'panel-a',
    xrSize: [0.8, 0.5],
    THREE: THREE_REAL,
    panel: {
      portable: true,
      pinned: false,
      focused: false,
      closable: options.closable,
      revision: 0,
      sourceMetadata: {},
      size: [0.8, 0.5],
    },
    updatePanelFrameVisuals() {},
  };
  mesh.userData.panelFrame = createXRPanelFrame({
    id: 'panel-a',
    size: [0.8, 0.5],
    closable: options.closable,
  });
  sceneRoot.add(mesh);

  let hit = null;
  let hitMeshCandidates = [];
  let interactionRaycaster = {
    ray: {
      origin: new THREE_REAL.Vector3(),
      direction: new THREE_REAL.Vector3(0, 0, -1),
    },
    set(origin, direction) {
      this.ray.origin.copy(origin);
      this.ray.direction.copy(direction);
    },
    intersectObjects(objects) {
      hitMeshCandidates.push([...objects]);
      return hit ? [hit] : [];
    },
  };
  let adapter = {
    THREE: THREE_REAL,
    async setSession(nextSession) {
      return { ok: true, session: nextSession, referenceSpace: {} };
    },
    listPanelMeshes() {
      return [mesh];
    },
    getPanelMesh(panelId) {
      return panelId === 'panel-a' ? mesh : null;
    },
    getSceneRoot() {
      return sceneRoot;
    },
    getDiagnostics() {
      return {};
    },
  };
  let receipts = [];
  let diagnosticEvents = [];
  let controller = createXRThreeSessionController({
    globalThis: {
      navigator: {
        xr: {
          async requestSession() {
            return session;
          },
        },
      },
    },
    adapter,
    THREE: THREE_REAL,
    interactionRaycaster,
    panelClosePolicy: options.panelClosePolicy,
    onPanelFullscreen: options.onPanelFullscreen,
    onPortablePanelReceipt(receipt) {
      receipts.push(receipt);
    },
    onDiagnostic(event) {
      diagnosticEvents.push(event);
    },
  });
  let started = await controller.start('immersive-ar', {
    target: {
      ok: true,
      renderer,
      camera: new THREE_REAL.PerspectiveCamera(),
      scene: new THREE_REAL.Scene(),
    },
    controllerRayVisuals: false,
    panelHitReticle: false,
    renderFrame: false,
  });
  assert.equal(started.ok, true);
  controllers[0].dispatchEvent({ type: 'connected', data: source });

  let committed = controller.commitSpatialEvidence({
    spatialTarget: createSpatialTarget(),
    sessionId: 'session-close',
    referenceSpaceId: 'reference-space-1',
    provenance: {
      runtimeId: 'three-webxr',
      runtimeVersion: '1.0.0',
      appId: 'close-test',
      buildHash: 'sha256:close-test',
      deviceId: 'quest-3',
      deviceKind: 'headset',
      emulation: 'native',
    },
    rootPolicy: {
      mode: 'world-locked',
      id: 'root-1',
      commitId: 'root-commit-1',
      matrix: new THREE_REAL.Matrix4().identity().toArray(),
    },
    spatialObjects: [{
      id: 'assembly',
      object: mesh,
      size: [0.2, 0.2, 0.01],
      visible: true,
      getState: () => 'ready',
    }],
    resolveInputSourceId: (candidate) => candidate.id,
  });
  assert.equal(committed.ok, true);

  function frame(time) {
    assert.equal(typeof animationLoop, 'function');
    animationLoop(time, {
      predictedDisplayTime: time,
      getViewerPose() {
        return null;
      },
      getPose() {
        return null;
      },
    });
  }

  function actionTarget(object, action) {
    let zone = object.userData.panelFrame.zones.actions[action];
    assert.ok(zone, `missing ${action} action zone`);
    return { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
  }

  let interactionTime = 1100;
  function selectAction(object, action) {
    hit = {
      object,
      point: new THREE_REAL.Vector3(object.position.x, object.position.y, object.position.z),
      uv: null,
      framePoint: actionTarget(object, action),
      distance: 1,
    };
    frame(interactionTime += 16);
    controllers[0].dispatchEvent({ type: 'selectstart', data: source });
    controllers[0].dispatchEvent({ type: 'selectend', data: source });
  }

  function findRestoreChip() {
    return sceneRoot.children.find((child) => child.userData?.snPanelRestoreChip === true) || null;
  }

  return {
    adapter,
    controller,
    controllers,
    diagnosticEvents,
    findRestoreChip,
    frame,
    hitMeshCandidates,
    mesh,
    receipts,
    sceneRoot,
    selectAction,
    session,
    clearHit() {
      hit = null;
    },
  };
}

test('Three session controller closes a panel, spawns a restore chip, and restores it', async () => {
  assert.ok(XR_THREE_WEBXR_ADAPTER.capabilities.includes('three-portable-panel-close'));

  let harness = await createCloseHarness();
  let { mesh, receipts, sceneRoot } = harness;

  harness.frame(1000);
  harness.selectAction(mesh, 'close');

  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].action, 'close');
  assert.equal(receipts[0].accepted, true);
  assert.equal(receipts[0].phase, 'applied');
  assert.equal(receipts[0].panelId, 'panel-a');
  assert.equal(receipts[0].after.hidden, true);

  // Hiding the panel mesh hides the chrome with it (chrome is mesh-childed).
  assert.equal(mesh.visible, false);

  // A restore chip appears at the hidden panel's pose, parented to the scene
  // root so it rides root re-placement instead of inheriting visible=false.
  let chip = harness.findRestoreChip();
  assert.ok(chip);
  assert.equal(chip.parent, sceneRoot);
  assert.equal(chip.userData.panelId, 'panel-a');
  assert.ok(Math.abs(chip.position.x - 0) < 1e-6);
  assert.ok(Math.abs(chip.position.y - 1.4) < 1e-6);
  assert.ok(Math.abs(chip.position.z - (-1)) < 1e-6);
  assert.equal(
    hitTestXRPanelFrame(chip.userData.panelFrame, { x: 0.5, y: 0.5 })?.action,
    'restore',
  );

  // Hidden panels are excluded from hit candidates; the chip is included.
  harness.clearHit();
  harness.hitMeshCandidates.length = 0;
  harness.frame(1016);
  let candidates = harness.hitMeshCandidates.at(-1) || [];
  assert.equal(candidates.includes(mesh), false);
  assert.equal(candidates.includes(chip), true);

  // The chip is not a drag target.
  assert.equal(isXRFrameDragTargetValue(chip), false);

  // Re-place the root while hidden: the chip rides along as a root child.
  sceneRoot.position.set(1, 0, 0);
  assert.equal(chip.parent, sceneRoot);

  // Selecting the chip restores the panel and disposes the chip.
  harness.selectAction(chip, 'restore');
  assert.equal(receipts.length, 2);
  assert.equal(receipts[1].action, 'restore');
  assert.equal(receipts[1].accepted, true);
  assert.equal(receipts[1].phase, 'applied');
  assert.equal(receipts[1].before.hidden, true);
  assert.equal(mesh.visible, true);
  assert.equal(harness.findRestoreChip(), null);

  await harness.controller.stop();
});

function isXRFrameDragTargetValue(chip) {
  let target = hitTestXRPanelFrame(chip.userData.panelFrame, { x: 0.5, y: 0.5 });
  return target?.operation === 'move' || target?.operation === 'resize';
}

test('Three session controller close policy blocks the store call and emits a diagnostic', async () => {
  let harness = await createCloseHarness({ panelClosePolicy: () => false });

  harness.frame(1000);
  harness.selectAction(harness.mesh, 'close');

  // A blocked close emits no receipt: every receipt consumes a store sequence
  // number, which would deadlock a product-side prelude gate.
  assert.equal(harness.receipts.length, 0);
  assert.ok(harness.diagnosticEvents.includes('spatial-three-close-blocked'));
  assert.notEqual(harness.mesh.visible, false);
  assert.equal(harness.findRestoreChip(), null);

  await harness.controller.stop();
});

test('Three session controller exposes no close primitive for non-closable panels', async () => {
  let harness = await createCloseHarness({ closable: false });

  harness.frame(1000);
  assert.equal(harness.mesh.userData.panelFrame.zones.actions.close, undefined);
  assert.equal(harness.receipts.length, 0);
  assert.notEqual(harness.mesh.visible, false);
  assert.equal(harness.findRestoreChip(), null);

  await harness.controller.stop();
});

test('Three session controller exposes fullscreen as a host-owned window intent', async () => {
  assert.ok(XR_THREE_WEBXR_ADAPTER.capabilities.includes('three-panel-fullscreen-intent'));
  let fullscreenIntents = [];
  let harness = await createCloseHarness({
    onPanelFullscreen(intent) {
      fullscreenIntents.push(intent);
    },
  });

  harness.frame(1000);
  harness.selectAction(harness.mesh, 'fullscreen');

  assert.equal(harness.receipts.length, 0);
  assert.equal(fullscreenIntents.length, 1);
  assert.equal(fullscreenIntents[0].version, 'xr-panel-fullscreen-intent-v1');
  assert.equal(fullscreenIntents[0].panelId, 'panel-a');
  assert.equal(fullscreenIntents[0].intent, 'panel-fullscreen');
  assert.equal(fullscreenIntents[0].context.sessionId, 'session-close');
  assert.ok(harness.diagnosticEvents.includes('spatial-three-panel-fullscreen'));

  await harness.controller.stop();
});
