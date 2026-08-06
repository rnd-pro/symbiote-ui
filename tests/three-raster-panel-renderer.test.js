import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { createMetaWindowChromeTexture } from '../xr/meta-window-chrome.js';
import { computeXRPanelChromeLayout } from '../xr/panel-frame.js';
import { createSceneInteractionArbiter } from '../xr/scene-interaction-arbiter.js';
import { createThreeRasterPanelRenderer } from '../xr/three-raster-panel-renderer.js';
import { createXRThreeWebXRAdapter } from '../xr/three-webxr-adapter.js';

function context2d(events = []) {
  let state = { fillStyle: '', strokeStyle: '', globalAlpha: 1 };
  return {
    get fillStyle() { return state.fillStyle; },
    set fillStyle(value) { state.fillStyle = value; },
    get strokeStyle() { return state.strokeStyle; },
    set strokeStyle(value) { state.strokeStyle = value; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(value) { state.globalAlpha = value; },
    clearRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, arcTo() {},
    arc(x, y, radius) { events.push({ type: 'arc', x, y, radius, globalAlpha: state.globalAlpha }); },
    stroke() { events.push({ type: 'stroke' }); },
    strokeRect() { events.push({ type: 'stroke-rect' }); },
    save() {}, restore() {}, scale() {}, translate() {}, rotate() {},
    fill() { events.push({ type: 'fill', fillStyle: state.fillStyle, globalAlpha: state.globalAlpha }); },
    fillText(text, x, y) { events.push({ type: 'text', text, x, y, fillStyle: state.fillStyle }); },
    measureText(text) { return { width: String(text).length * 10 }; },
    lineWidth: 1,
    lineCap: 'round',
    lineJoin: 'round',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };
}

function canvasFactory(events = []) {
  return (width, height) => ({ width, height, getContext: () => context2d(events) });
}

function renderer(options = {}) {
  return createThreeRasterPanelRenderer(THREE, {
    panelId: 'layout:chat',
    title: 'Chat',
    sizeMeters: [1.2, 0.8],
    createCanvas: canvasFactory(),
    ...options,
  });
}

function objectNamed(instance, suffix) {
  return instance.getInteractiveObjects().find((object) => object.name.endsWith(suffix));
}

function revealMenu(instance) {
  let content = instance.getContentObject();
  let strip = objectNamed(instance, 'grab-strip');
  instance.setHovered(content.userData.primitiveId);
  instance.syncFrame(100);
  instance.setHovered(strip.userData.primitiveId);
  for (let time = 200; time <= 800; time += 100) instance.syncFrame(time);
  return strip;
}

test('raster renderer mounts one content texture and a stable exact-hit target', () => {
  let changes = [];
  let instance = renderer({ targetGeneration: 7, ownerId: 'workspace', onInteractionTargetChange: (change) => changes.push(change) });
  instance.mount();
  let content = instance.getContentObject();
  let target = instance.createInteractionTarget();
  assert.deepEqual([content.geometry.parameters.width, content.geometry.parameters.height], [1.2, 0.8]);
  assert.equal(instance.group.children.filter((child) => child.name === 'sn-raster-window-content').length, 1);
  assert.equal(target.ownerId, 'workspace');
  assert.equal(target.id, 'layout:chat');
  assert.equal(target.generation, 7);
  let exact = target.resolveHit({ object: content, uv: { x: 0.25, y: 0.75 }, distance: 1.4 });
  assert.equal(exact.primitiveId, 'layout:chat/content');
  assert.deepEqual(exact.contentPoint, { x: 0.25, y: 0.25 });
  assert.equal(exact.operation, 'focus');
  assert.equal(exact.acquire, undefined);

  let priorCandidates = target.getCandidateObjects();
  instance.setSize([1.5, 0.9]);
  instance.setSelected('layout:chat/window-chrome/action-pin');
  assert.equal(instance.getPanel().interactionGeneration, 8, 'structural replacement advances logical target generation');
  assert.equal(changes[0].previousGeneration, 7);
  assert.equal(changes[0].targetGeneration, 8);
  assert.equal(changes[0].createInteractionTarget().generation, 8);
  assert.notDeepEqual(target.getCandidateObjects(), priorCandidates, 'candidate objects refresh without replacing target identity');
});

test('raster texture readiness separates upload from left/right XR render submission', () => {
  let instance = renderer();
  instance.mount();
  let scene = new THREE.Scene();
  scene.add(instance.group);
  let priorUpdates = 0;
  let texture = new THREE.Texture();
  let priorHook = () => { priorUpdates += 1; };
  texture.onUpdate = priorHook;
  texture.needsUpdate = true;
  instance.setTexture(texture, () => texture.dispose());
  let pending = instance.getTextureState();
  assert.equal(pending.materialAttached, true);
  assert.equal(pending.sceneAttached, true);
  assert.equal(pending.uploadAcknowledged, false);
  assert.equal(pending.ready, false);
  texture.onUpdate(texture);
  let ready = instance.getTextureState();
  assert.equal(priorUpdates, 1, 'the caller texture upload hook is preserved');
  assert.equal(ready.uploadAcknowledged, true);
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.presentation.eyeSubmissions, { left: 0, right: 0, unknown: 0 });
  assert.equal(ready.presentation.stereoSubmitted, false, 'upload readiness is not device presentation evidence');
  let leftEye = new THREE.PerspectiveCamera();
  let rightEye = new THREE.PerspectiveCamera();
  let xrCamera = new THREE.ArrayCamera([leftEye, rightEye]);
  let webglRenderer = { xr: { getCamera: () => xrCamera } };
  let content = instance.getContentObject();
  content.onBeforeRender(webglRenderer, scene, leftEye);
  let leftSubmitted = instance.getTextureState();
  assert.deepEqual(leftSubmitted.presentation.eyeSubmissions, { left: 1, right: 0, unknown: 0 });
  assert.equal(leftSubmitted.presentation.stereoSubmitted, false);
  content.onBeforeRender(webglRenderer, scene, rightEye);
  let stereoSubmitted = instance.getTextureState();
  assert.deepEqual(stereoSubmitted.presentation.eyeSubmissions, { left: 1, right: 1, unknown: 0 });
  assert.equal(stereoSubmitted.presentation.stereoSubmitted, true);
  assert.equal(stereoSubmitted.presentation.textureId, ready.textureId);
  assert.equal(stereoSubmitted.ready, true, 'presentation facts do not redefine upstream readiness');
  scene.remove(instance.group);
  assert.equal(instance.getTextureState().ready, false, 'detaching the panel invalidates render readiness');
  instance.dispose();
  assert.equal(texture.onUpdate, priorHook, 'dispose removes the renderer observer and restores the caller hook');
});

test('structural rebuild cancels the old capture once while texture-only updates preserve it', () => {
  let arbiter = createSceneInteractionArbiter();
  let cancellations = [];
  let handlers = { onCancel: (identity, details) => cancellations.push({ identity, details }) };
  let register = (target) => arbiter.registerTarget(target);
  let unregister = null;
  let instance = renderer({
    targetGeneration: 5,
    ownerId: 'workspace',
    onInteractionTargetChange: (change) => { unregister = register(change.createInteractionTarget(handlers)); },
  });
  instance.mount();
  unregister = register(instance.createInteractionTarget(handlers));
  let corner = objectNamed(instance, 'resize-northEast');
  let update = (object) => arbiter.updateFrame(
    [{ id: 'right' }],
    () => ({ origin: { x: 0, y: 0, z: 1 }, direction: { x: 0, y: 0, z: -1 } }),
    () => [{ object, distance: 1, point: { x: 0.6, y: 0.4, z: 0 }, uv: { x: 0.5, y: 0.5 } }],
  );
  update(corner);
  assert.equal(arbiter.handlePress('right').ok, true);

  let texture = { id: 'same' };
  let release = () => {};
  assert.equal(instance.setTexture(texture, release), true);
  assert.equal(instance.setTexture(texture, release), false);
  assert.equal(instance.getPanel().interactionGeneration, 5);
  assert.equal(arbiter.getCapture('right')?.identity.targetGeneration, 5);

  instance.setSize([1.4, 0.9]);
  assert.equal(instance.getPanel().interactionGeneration, 6);
  assert.equal(cancellations.length, 1);
  assert.equal(cancellations[0].details.reason, 'target-generation-replaced');
  assert.equal(cancellations[0].identity.targetGeneration, 5);
  assert.equal(arbiter.getCapture('right'), null);
  let nextCorner = objectNamed(instance, 'resize-northEast');
  assert.notEqual(nextCorner, corner);
  update(nextCorner);
  assert.equal(arbiter.handlePress('right').ok, true);
  assert.equal(arbiter.getCapture('right').identity.targetGeneration, 6);
  unregister();
});

test('resize preview scales the mounted panel without replacing its captured interaction target', () => {
  let arbiter = createSceneInteractionArbiter();
  let cancellations = [];
  let instance = renderer({ targetGeneration: 3, ownerId: 'workspace' });
  instance.mount();
  arbiter.registerTarget(instance.createInteractionTarget({
    onCancel: (_identity, details) => cancellations.push(details.reason),
  }));
  let corner = objectNamed(instance, 'resize-southEast');
  arbiter.updateFrame(
    [{ id: 'right' }],
    () => ({ origin: { x: 0, y: 0, z: 1 }, direction: { x: 0, y: 0, z: -1 } }),
    () => [{ object: corner, distance: 1 }],
  );
  assert.equal(arbiter.handlePress('right').ok, true);

  instance.previewSize([1.5, 1]);
  assert.deepEqual(instance.group.scale.toArray(), [1.25, 1.25, 1]);
  assert.equal(instance.getPanel().interactionGeneration, 3);
  assert.equal(arbiter.getCapture('right')?.identity.targetGeneration, 3);
  assert.deepEqual(cancellations, []);
  instance.clearPreviewSize();
  assert.deepEqual(instance.group.scale.toArray(), [1, 1, 1]);
});

test('failed structural build preserves prior topology generation geometry and capture', () => {
  let failCanvas = false;
  let arbiter = createSceneInteractionArbiter();
  let cancellations = [];
  let instance = renderer({
    targetGeneration: 2,
    createCanvas: (width, height) => failCanvas
      ? { width, height, getContext: () => null }
      : { width, height, getContext: () => context2d() },
    onInteractionTargetChange: (change) => arbiter.registerTarget(change.createInteractionTarget({
      onCancel: (identity, details) => cancellations.push({ identity, details }),
    })),
  });
  instance.mount();
  arbiter.registerTarget(instance.createInteractionTarget({
    onCancel: (identity, details) => cancellations.push({ identity, details }),
  }));
  let corner = objectNamed(instance, 'resize-southEast');
  let oldGeometry = instance.getContentObject().geometry;
  arbiter.updateFrame(
    [{ id: 'source' }],
    () => ({ origin: { x: 0, y: 0, z: 1 }, direction: { x: 0, y: 0, z: -1 } }),
    () => [{ object: corner, distance: 1 }],
  );
  assert.equal(arbiter.handlePress('source').ok, true);
  failCanvas = true;
  assert.throws(() => instance.setSize([1.5, 1]), /could not create a 2D canvas texture/);
  assert.equal(instance.getPanel().interactionGeneration, 2);
  assert.deepEqual(instance.getPanel().sizeMeters, [1.2, 0.8]);
  assert.equal(instance.getContentObject().geometry, oldGeometry);
  assert.equal(objectNamed(instance, 'resize-southEast'), corner);
  assert.equal(arbiter.getCapture('source')?.identity.targetGeneration, 2);
  assert.equal(cancellations.length, 0);
});

test('collapsed strip is non-acquiring, expands one menu and keeps actions aligned with their physical zones', () => {
  let instance = renderer();
  instance.mount();
  let strip = objectNamed(instance, 'grab-strip');
  let controlBar = objectNamed(instance, 'control-bar');
  instance.setHovered(instance.getContentObject().userData.primitiveId);
  instance.syncFrame(100);
  assert.equal(instance.resolveIntersection({ object: strip })?.acquire, false);
  assert.equal(controlBar.material.opacity, 0);
  revealMenu(instance);
  assert.ok(controlBar.material.opacity > 0.9);
  assert.ok(strip.material.opacity < 0.1, 'the strip morphs into the menu instead of leaving a duplicate island');

  let frame = computeXRPanelChromeLayout([1.2, 0.8], { actions: ['reset', 'fullscreen', 'aspect', 'pin', 'close'] });
  for (let [action, zone] of Object.entries(frame.actions)) {
    let uv = {
      x: (zone.x + zone.width / 2 - frame.controlBar.x) / frame.controlBar.width,
      y: 0.5,
    };
    let hit = instance.resolveIntersection({ object: controlBar, uv, distance: 1 });
    assert.equal(hit.operation, 'action');
    assert.equal(hit.action, action);
    assert.equal(hit.primitiveId, `layout:chat/window-chrome/action-${action}`);
    assert.equal(hit.acquire, true);
    assert.equal(Object.hasOwn(hit, 'distance'), false, 'the arbiter owns the canonical intersection distance');
    assert.ok(Math.abs(zone.width * 1.2 - zone.height * 0.8) < 1e-12, `${action} hit zone is physically square`);
  }
});

test('hover corridor continuously bridges the panel to the collapsed strip under arbitrary transforms', () => {
  let instance = renderer();
  instance.mount();
  instance.group.position.set(0.35, 1.2, -1.4);
  instance.group.quaternion.setFromEuler(new THREE.Euler(0.28, -0.48, 0.22, 'XYZ'));
  instance.group.updateMatrixWorld(true);
  let content = instance.getContentObject();
  let corridor = objectNamed(instance, 'island-hit-area');
  let strip = objectNamed(instance, 'grab-strip');
  instance.setHovered(content.userData.primitiveId);
  instance.syncFrame(100);
  instance.syncFrame(160);
  instance.group.updateMatrixWorld(true);
  let viewer = new THREE.Vector3(0, 1.6, 0.2);
  for (let object of [corridor, strip]) {
    let point = object.getWorldPosition(new THREE.Vector3());
    let raycaster = new THREE.Raycaster(viewer, point.clone().sub(viewer).normalize());
    let intersection = raycaster.intersectObject(object, false)[0];
    assert.ok(intersection, `${object.name} remains a real world-space ray target`);
    let hit = instance.resolveIntersection(intersection);
    assert.equal(hit?.operation, 'reveal');
    instance.setHovered(hit.primitiveId);
    instance.syncFrame(object === corridor ? 240 : 320);
    instance.group.updateMatrixWorld(true);
    assert.equal(instance.getDiagnostics().stripTargetVisible, true, `${object.name} holds reveal`);
  }
  assert.ok(
    corridor.geometry.parameters.height > 0.05,
    'the invisible corridor spans the physical gap instead of matching only the visual strip',
  );
});

test('resize corners stay hidden until proximity and remain tight to the physical panel corners', () => {
  let instance = renderer({ panelFrame: { handleSizeMeters: 0.056 } });
  instance.mount();
  let corner = objectNamed(instance, 'resize-southEast');
  assert.equal(corner.material.opacity, 0);
  assert.equal(instance.resolveIntersection({ object: corner })?.handle, 'southEast');
  instance.setHovered(corner.userData.primitiveId);
  assert.equal(corner.material.opacity, 1);
  let halfWidth = 1.2 / 2;
  let halfHeight = 0.8 / 2;
  assert.ok(Math.abs(corner.position.x - halfWidth) <= corner.geometry.parameters.width / 2);
  assert.ok(Math.abs(corner.position.y + halfHeight) <= corner.geometry.parameters.height / 2);
  assert.equal(instance.getInteractiveObjects().some((object) => object.name.includes('edge-south')), false, 'no second lower drag strip exists');
});

test('individual menu chrome inherits the full panel transform', () => {
  let instance = renderer();
  instance.mount();
  let menu = instance.group.getObjectByName('sn-raster-window-menu-chrome');
  let panelChrome = instance.group.getObjectByName('sn-raster-window-panel-chrome');
  instance.group.quaternion.setFromEuler(new THREE.Euler(0.45, 0.35, -0.28, 'XYZ'));
  instance.group.updateMatrixWorld(true);
  instance.syncFrame(100);
  instance.group.updateMatrixWorld(true);

  let menuWorld = menu.getWorldQuaternion(new THREE.Quaternion());
  let panelWorld = panelChrome.getWorldQuaternion(new THREE.Quaternion());
  let groupWorld = instance.group.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(1 - Math.abs(menuWorld.dot(groupWorld)) < 1e-10, 'menu follows panel pitch, yaw and roll');
  assert.ok(1 - Math.abs(panelWorld.dot(groupWorld)) < 1e-10, 'resize/focus chrome follows the same panel transform');
});

test('all five individual menu actions keep stable world-space hits across viewer poses and panel rotation', () => {
  let instance = renderer();
  instance.mount();
  revealMenu(instance);
  instance.group.position.set(0.4, 1.1, -1.7);
  instance.group.quaternion.setFromEuler(new THREE.Euler(0.34, -0.52, 0.27, 'XYZ'));
  instance.group.updateMatrixWorld(true);
  let target = instance.createInteractionTarget();
  let actions = ['reset', 'fullscreen', 'aspect', 'pin', 'close'];
  let viewerPositions = [
    new THREE.Vector3(0, 1.6, 0),
    new THREE.Vector3(-0.7, 1.35, -0.2),
    new THREE.Vector3(1.1, 1.8, 0.25),
  ];
  for (let action of actions) {
    let mesh = instance.group.getObjectByName(`sn-raster-window-action-${action}`);
    assert.ok(mesh, `${action} has a dedicated stable hit mesh`);
    let point = mesh.getWorldPosition(new THREE.Vector3());
    for (let viewer of viewerPositions) {
      let raycaster = new THREE.Raycaster(viewer, point.clone().sub(viewer).normalize());
      let hit = raycaster.intersectObjects(target.getCandidateObjects(), true)
        .map((intersection) => target.resolveHit(intersection))
        .find(Boolean);
      assert.equal(hit?.operation, 'action', `${action} resolves from viewer ${viewer.toArray()}`);
      assert.equal(hit?.action, action);
      instance.setHovered(hit.primitiveId);
      assert.ok(mesh.material.opacity > 0, `${action} hover highlight is independent of viewer pose`);
    }
  }
});

test('latched panel capture survives a transient ray miss and releases only on explicit lifecycle events', () => {
  let arbiter = createSceneInteractionArbiter();
  let moves = [];
  let releases = [];
  let cancellations = [];
  let instance = renderer();
  instance.mount();
  let target = instance.createInteractionTarget({
    onMove: (_identity, details) => moves.push(details),
    onRelease: (_identity, details) => releases.push(details),
    onCancel: (_identity, details) => cancellations.push(details),
  });
  arbiter.registerTarget(target);
  let content = instance.getContentObject();
  let hit = [{ object: content, distance: 1, uv: new THREE.Vector2(0.5, 0.5) }];
  let intersections = hit;
  let update = () => arbiter.updateFrame(
    [{ id: 'right', controller: {} }],
    () => ({ origin: { x: 0, y: 0, z: 1 }, direction: { x: 0, y: 0, z: -1 } }),
    () => intersections,
  );
  update();
  assert.equal(arbiter.handlePress('right').ok, true);
  intersections = [];
  update();
  assert.equal(arbiter.getCapture('right')?.identity.targetId, 'layout:chat');
  assert.equal(moves.length, 1, 'captured move continues without a current ray winner');
  assert.equal(arbiter.handleRelease('right').ok, true);
  assert.equal(releases.length, 1);
  assert.equal(cancellations.length, 0);

  intersections = hit;
  update();
  assert.equal(arbiter.handlePress('right').ok, true);
  intersections = [];
  update();
  assert.equal(arbiter.handleCancel('right', 'select-cancelled'), true);
  assert.equal(cancellations.at(-1).reason, 'select-cancelled');
  assert.equal(arbiter.getCapture('right'), null);
});

test('global menu has a separate group handle; menu-body drag does not move equipment', () => {
  let globalMenu = renderer({ panelId: 'global', component: 'global-menu' });
  globalMenu.mount();
  revealMenu(globalMenu);
  let controlBar = objectNamed(globalMenu, 'control-bar');
  let groupHandle = objectNamed(globalMenu, 'group-handle');
  assert.equal(globalMenu.resolveIntersection({ object: controlBar, uv: { x: 0.05, y: 0.5 } })?.operation, 'move-menu');
  assert.equal(globalMenu.resolveIntersection({ object: groupHandle })?.operation, 'move-group');

  for (let component of ['workspace', 'equipment']) {
    let panel = renderer({ panelId: component, component });
    panel.mount();
    assert.equal(objectNamed(panel, 'group-handle'), undefined, `${component} has no group-wide drag primitive`);
  }
});

test('global menu preserves its manually authored pose when the viewer moves', () => {
  let instance = renderer({ panelId: 'global', component: 'global-menu' });
  instance.mount();
  instance.group.quaternion.setFromEuler(new THREE.Euler(0.4, -0.2, 0.3));
  let before = instance.group.getWorldQuaternion(new THREE.Quaternion());
  let yaw = Math.PI / 3;
  let viewer = new THREE.Matrix4().makeRotationY(yaw).toArray();
  instance.syncFrame(100, { transform: { matrix: viewer } });
  instance.group.updateMatrixWorld(true);
  let menu = instance.group.getObjectByName('sn-raster-window-menu-chrome');
  let world = menu.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(1 - Math.abs(world.dot(before)) < 1e-10, 'viewer pose never overwrites the free menu quaternion');
});

test('renderer hover uses the interaction target and the single session reticle', () => {
  let instance = renderer();
  instance.mount();
  let scene = new THREE.Scene();
  scene.add(instance.group);
  let adapter = createXRThreeWebXRAdapter({ THREE });
  let reticle = adapter.createPanelHitReticleVisual(scene);
  assert.equal(reticle.ok, true);
  assert.equal(instance.group.getObjectByName('sn-raster-window-focus-ring'), undefined);
  let sessionReticles = [];
  scene.traverse((object) => {
    if (object.userData?.snPanelHitReticle) sessionReticles.push(object);
  });
  assert.deepEqual(sessionReticles, [reticle.object], 'the scene owns exactly one shared reticle');

  let content = instance.getContentObject();
  scene.updateMatrixWorld(true);
  let arbiter = createSceneInteractionArbiter();
  arbiter.registerTarget(instance.createInteractionTarget({
    onHover(_identity, details) {
      instance.setHovered(details.phase === 'leave' ? null : details.hit?.resolved?.primitiveId);
    },
  }));
  let update = (intersections) => arbiter.updateFrame(
    [{ id: 'right' }],
    () => ({ origin: { x: 0, y: 0, z: 1 }, direction: { x: 0, y: 0, z: -1 } }),
    () => intersections,
  );
  let point = content.localToWorld(new THREE.Vector3(0.1, -0.15, 0));
  update([{
    object: content,
    distance: 1,
    point,
    uv: new THREE.Vector2(0.58, 0.31),
    face: { normal: new THREE.Vector3(0, 0, 1) },
  }]);
  let winner = arbiter.getWinningHit('right');
  adapter.updatePanelHitReticleVisual(reticle, winner?.resolved?.hit || winner);
  assert.equal(instance.getDiagnostics().hoveredPrimitiveId, content.userData.primitiveId);
  assert.equal(instance.getDiagnostics().stripTargetVisible, true);
  assert.equal(reticle.object.visible, true);
  assert.ok(reticle.object.position.distanceTo(point) < 1e-12);

  update([]);
  adapter.updatePanelHitReticleVisual(reticle, arbiter.getWinningHit('right'));
  assert.equal(instance.getDiagnostics().hoveredPrimitiveId, null);
  assert.equal(reticle.object.visible, false);

  let released = [];
  let one = { id: 'one' };
  let two = { id: 'two' };
  let releaseOne = () => released.push('one');
  instance.setTexture(one, releaseOne);
  assert.equal(instance.setTexture(one, releaseOne), false);
  assert.throws(
    () => instance.setTexture(one, () => released.push('duplicate-one')),
    /already owned by a different release callback/,
  );
  assert.deepEqual(released, []);
  instance.setTexture(two, () => released.push('two'));
  assert.deepEqual(released, ['one']);
  assert.equal(content.material.map, two);
  assert.equal(instance.dispose(), true);
  assert.deepEqual(released, ['one', 'two']);
  assert.equal(instance.dispose(), false);
  arbiter.dispose();
  reticle.object.geometry.dispose();
  reticle.object.material.dispose();
});

test('selected chrome stays highlighted independently of the current hover target', () => {
  let instance = renderer();
  instance.mount();
  revealMenu(instance);
  let pin = instance.group.getObjectByName('sn-raster-window-action-pin');
  let close = instance.group.getObjectByName('sn-raster-window-action-close');
  let target = instance.createInteractionTarget();
  target.onPress({}, { hit: { resolved: { primitiveId: pin.userData.primitiveId } } });
  instance.setHovered(close.userData.primitiveId);
  assert.ok(pin.material.opacity > 0, 'pressed action remains selected');
  assert.ok(close.material.opacity > 0, 'hovered action remains independently highlighted');
  target.onRelease({}, {});
  assert.equal(pin.material.opacity, 0);
  assert.ok(close.material.opacity > 0);
});

test('stable hover and settled chrome do not dirty materials on every XR frame', () => {
  let instance = renderer();
  instance.mount();
  let content = instance.getContentObject();
  let strip = revealMenu(instance);
  instance.setHovered(strip.userData.primitiveId);
  instance.syncFrame(1_000);
  let materials = [];
  instance.group.traverse((object) => {
    if (object.material) materials.push(object.material);
  });
  let before = materials.map((material) => material.version);
  for (let frame = 1; frame <= 120; frame += 1) {
    instance.setHovered(strip.userData.primitiveId);
    instance.syncFrame(1_000 + frame * 13.9);
  }
  assert.deepEqual(
    materials.map((material) => material.version),
    before,
    'a settled island does not schedule redundant GPU material uploads',
  );
  assert.equal(instance.getDiagnostics().noOpFrames >= 120, true);
  assert.equal(content.material.version, 0);
  instance.dispose();
});

test('chrome textures preserve physical aspect, theme roles and bounded high resolution', () => {
  let events = [];
  let instance = renderer({
    theme: { roles: { 'on-surface': '#f4f4f4', 'surface-raised': '#4a4a4a' } },
    createCanvas: canvasFactory(events),
  });
  instance.mount();
  let controlBar = objectNamed(instance, 'control-bar');
  let strip = objectNamed(instance, 'grab-strip');
  for (let mesh of [controlBar, strip]) {
    let physicalAspect = mesh.geometry.parameters.width / mesh.geometry.parameters.height;
    let image = mesh.material.map.image;
    assert.ok(Math.abs(image.width / image.height - physicalAspect) <= 1 / image.height);
    assert.ok(image.height >= 384);
  }
  assert.ok(events.some((event) => event.fillStyle === '#f4f4f4'));
  assert.ok(events.some((event) => event.fillStyle === '#4a4a4a'));

  let widthForAspect = (aspect) => {
    let texture = createMetaWindowChromeTexture(THREE, 'control-bar', {
      createCanvas: canvasFactory(),
      aspect,
    });
    return texture.image.width;
  };
  assert.equal(widthForAspect(0.01), 32);
  assert.equal(widthForAspect(100), 4096);
  assert.equal(widthForAspect(4), 1536);
});

test('pin and aspect active states render together as centered unclipped circular highlights', () => {
  let events = [];
  let instance = renderer({ pinned: true, proportional: true, createCanvas: canvasFactory(events) });
  instance.mount();
  let controlBar = objectNamed(instance, 'control-bar');
  let image = controlBar.material.map.image;
  let layout = computeXRPanelChromeLayout([1.2, 0.8], { actions: ['reset', 'fullscreen', 'aspect', 'pin', 'close'] });
  let controlZone = layout.controlBar;
  let highlightedArcs = events.filter((event) => event.type === 'arc' && event.globalAlpha === 0.12);
  assert.equal(highlightedArcs.length, 2);
  for (let action of ['aspect', 'pin']) {
    let zone = layout.actions[action];
    let expectedX = ((zone.x + zone.width / 2 - controlZone.x) / controlZone.width) * image.width;
    let expectedY = ((zone.y + zone.height / 2 - controlZone.y) / controlZone.height) * image.height;
    let highlight = highlightedArcs.find((event) => Math.abs(event.x - expectedX) < 1e-9);
    assert.ok(highlight, `${action} highlight uses its exact hit-zone center`);
    assert.ok(Math.abs(highlight.y - expectedY) < 1e-9);
    assert.ok(highlight.x - highlight.radius >= 0 && highlight.x + highlight.radius <= image.width);
    assert.ok(highlight.y - highlight.radius >= 0 && highlight.y + highlight.radius <= image.height);
  }
});

test('model selector chrome uses bounded vector glyphs instead of letter placeholders', () => {
  let events = [];
  let instance = renderer({
    panelId: 'global',
    component: 'global-menu',
    createCanvas: canvasFactory(events),
    panelFrame: { actions: ['planetary-gear', 'hover-engine', 'lego-motor', 'pneumatic-engine'] },
  });
  instance.mount();
  let text = events.filter((event) => event.type === 'text').map((event) => event.text);
  assert.equal(text.some((value) => ['PG', 'HE', 'LM', 'PE'].includes(value)), false);
  assert.ok(events.filter((event) => event.type === 'stroke').length >= 8);
  assert.ok(events.some((event) => event.type === 'stroke-rect'));
});

test('unsupported chrome resources fail with actionable errors instead of silent fallback', () => {
  assert.throws(() => createMetaWindowChromeTexture({}, 'control-bar'), /requires THREE\.CanvasTexture/);
  assert.throws(() => createMetaWindowChromeTexture(THREE, 'unknown', { createCanvas: canvasFactory() }), /Unknown Meta window chrome/);
  assert.throws(
    () => createMetaWindowChromeTexture(THREE, 'control-bar', { createCanvas: () => ({ getContext: () => null }) }),
    /could not create a 2D canvas texture/,
  );
});
