/**
 * @file xr/three-raster-panel-renderer.js
 * @description Three presentation for one event-rasterized spatial layout.
 * The layout image, spatial chrome, hit contract and texture lifetime remain
 * separate so a future non-raster content backend can reuse this shell.
 */

import { createMetaWindowChromeTexture } from './meta-window-chrome.js';
import { createXRPanelFrame, hitTestXRPanelFrame } from './panel-frame.js';
import { XR_DEFAULT_DESIGN_TOKENS } from './chrome-theme.js';

export const THREE_RASTER_PANEL_RENDERER_VERSION = 'three-raster-panel-renderer-v1';

const ISLAND_INTERACTION_THRESHOLD = 0.82;
const ISLAND_STRIP_INTERACTION_THRESHOLD = 0.05;
const ISLAND_HANDOFF_COMPLETE = 0.9;
const ISLAND_SETTLE_EPSILON = 0.025;
const ISLAND_HOLD_MS = 420;

function finitePositive(value, fallback) {
  let number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function panelSize(value) {
  return [
    finitePositive(value?.[0], 1),
    finitePositive(value?.[1], 0.7),
  ];
}

function disposeMaterial(material, { disposeMap = true } = {}) {
  if (Array.isArray(material)) {
    material.forEach((entry) => disposeMaterial(entry, { disposeMap }));
    return;
  }
  if (disposeMap) material?.map?.dispose?.();
  material?.dispose?.();
}

function disposeMesh(mesh, options) {
  mesh?.geometry?.dispose?.();
  disposeMaterial(mesh?.material, options);
}

function requireThree(THREE) {
  let missing = ['Group', 'Mesh', 'PlaneGeometry', 'MeshBasicMaterial', 'Matrix4', 'Quaternion', 'Vector3']
    .filter((name) => typeof THREE?.[name] !== 'function');
  if (missing.length) {
    throw new Error(`Three raster panel renderer requires ${missing.join(', ')}.`);
  }
}

function rectForZone(zone, size) {
  let width = Number(size[0]);
  let height = Number(size[1]);
  let zoneWidth = Number(zone.width) * width;
  let zoneHeight = Number(zone.height) * height;
  return {
    width: zoneWidth,
    height: zoneHeight,
    x: -width / 2 + Number(zone.x) * width + zoneWidth / 2,
    y: height / 2 - Number(zone.y) * height - zoneHeight / 2,
  };
}

function readableTitle(value, fallback) {
  let title = String(value || '').trim();
  return title || String(fallback || 'Window');
}

function createChromeMesh(THREE, panel, frame, zone, metadata) {
  let rect = rectForZone(zone, frame.size);
  let material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: metadata.texture || null,
    transparent: true,
    opacity: metadata.opacity ?? 1,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  let mesh = new THREE.Mesh(new THREE.PlaneGeometry(rect.width, rect.height), material);
  mesh.name = `sn-raster-window-${metadata.name}`;
  mesh.position.set(rect.x, rect.y, metadata.z ?? 0.012);
  mesh.renderOrder = 48;
  mesh.userData = {
    kind: 'raster-window-chrome',
    panelId: panel.id,
    primitiveId: `${panel.id}/window-chrome/${metadata.name}`,
    targetId: `${panel.id}/window-chrome/${metadata.name}`,
    targetGeneration: metadata.targetGeneration,
    operation: metadata.operation || null,
    action: metadata.action || null,
    handle: metadata.handle || null,
    baseOpacity: metadata.opacity ?? 1,
    hoverOpacity: metadata.hoverOpacity ?? 1,
    acquire: metadata.acquire !== false,
  };
  return mesh;
}

function chromeTheme(options = {}) {
  let theme = options.theme || {};
  let roles = theme.roles || {};
  return {
    background: options.chromeBackground || roles['surface-raised'] || roles['surface-panel'] || roles.surface || XR_DEFAULT_DESIGN_TOKENS.colors.surfacePanel,
    foreground: options.chromeForeground || roles['on-surface'] || roles.text || roles['on-surface-dim'] || XR_DEFAULT_DESIGN_TOKENS.colors.onSurface,
  };
}

/**
 * Creates a renderer-neutral spatial shell whose content is exactly one
 * disposable bitmap texture. The caller owns bitmap decoding and provides a
 * release function whenever a texture is replaced.
 */
export function createThreeRasterPanelRenderer(THREE, options = {}) {
  requireThree(THREE);
  let group = new THREE.Group();
  let panel = {
    id: String(options.panelId || ''),
    title: readableTitle(options.title, options.panelId),
    size: panelSize(options.sizeMeters),
    closable: options.closable !== false,
    pinned: Boolean(options.pinned),
    proportional: options.proportional !== false,
    component: options.component || 'panel',
  };
  let content = null;
  let menuChrome = null;
  let panelChrome = null;
  let interactive = [];
  let releaseTexture = null;
  let hoveredPrimitiveId = null;
  let selectedPrimitiveId = null;
  let disposed = false;
  let textureUpdates = 0;
  let islandObjects = [];
  let islandAnchor = null;
  let grabStrip = null;
  let islandHitArea = null;
  let groupHandle = null;
  let stripVisibility = 0;
  let stripTargetVisibility = 0;
  let menuVisibility = 0;
  let menuTargetVisibility = 0;
  let islandLastFrameAt = null;
  let islandHoldRemainingMs = 0;
  let islandTransitionMs = Math.max(60, finitePositive(options.controlBarTransitionMs, 150));
  let interactionGeneration = Number(options.targetGeneration ?? 0);
  if (!Number.isInteger(interactionGeneration) || interactionGeneration < 0) {
    throw new TypeError('targetGeneration must be a non-negative integer.');
  }
  let interactionTargetListeners = new Set();
  if (typeof options.onInteractionTargetChange === 'function') {
    interactionTargetListeners.add(options.onInteractionTargetChange);
  }
  let noOpFrames = 0;
  let materialUpdates = 0;
  let textureUpload = {
    texture: null,
    uploadAcknowledged: false,
    previousOnUpdate: null,
    observer: null,
  };
  let texturePresentation = {
    texture: null,
    textureId: null,
    eyeSubmissions: { left: 0, right: 0, unknown: 0 },
  };

  function textureId(texture) {
    return texture?.uuid || texture?.id || null;
  }

  function resetTexturePresentation(texture = null) {
    texturePresentation = {
      texture,
      textureId: textureId(texture),
      eyeSubmissions: { left: 0, right: 0, unknown: 0 },
    };
  }

  function noteTexturePresentation(renderer, camera) {
    let texture = content?.material?.map || null;
    if (!texture || texture !== texturePresentation.texture) return false;
    let xrCamera = renderer?.xr?.getCamera?.() || null;
    let eyeCameras = Array.isArray(xrCamera?.cameras) ? xrCamera.cameras : [];
    let index = eyeCameras.indexOf(camera);
    let eye = index === 0 ? 'left' : index === 1 ? 'right' : 'unknown';
    texturePresentation.eyeSubmissions[eye] += 1;
    return true;
  }

  function detachTextureUploadObserver() {
    let tracked = textureUpload;
    if (tracked.texture && tracked.texture.onUpdate === tracked.observer) {
      tracked.texture.onUpdate = tracked.previousOnUpdate;
    }
    textureUpload = {
      texture: null,
      uploadAcknowledged: false,
      previousOnUpdate: null,
      observer: null,
    };
  }

  function observeTextureUpload(texture) {
    detachTextureUploadObserver();
    if (!texture) return;
    let previousOnUpdate = typeof texture.onUpdate === 'function' ? texture.onUpdate : null;
    let observer = (...args) => {
      textureUpload.uploadAcknowledged = true;
      previousOnUpdate?.apply(texture, args);
    };
    textureUpload = {
      texture,
      uploadAcknowledged: false,
      previousOnUpdate,
      observer,
    };
    texture.onUpdate = observer;
  }

  function isSceneAttached() {
    if (!content || content.parent !== group || !group.parent) return false;
    let root = group;
    while (root.parent) root = root.parent;
    return root.isScene === true;
  }

  function getTextureState() {
    let texture = content?.material?.map || null;
    let materialAttached = Boolean(texture && texture === textureUpload.texture);
    let sceneAttached = isSceneAttached();
    let uploadAcknowledged = materialAttached && textureUpload.uploadAcknowledged === true;
    return Object.freeze({
      textureId: textureId(texture),
      materialAttached,
      sceneAttached,
      uploadAcknowledged,
      ready: materialAttached && sceneAttached && uploadAcknowledged,
      presentation: Object.freeze({
        textureId: texturePresentation.textureId,
        eyeSubmissions: Object.freeze({ ...texturePresentation.eyeSubmissions }),
        stereoSubmitted: texturePresentation.eyeSubmissions.left > 0
          && texturePresentation.eyeSubmissions.right > 0,
      }),
    });
  }

  function frame() {
    let defaultActions = ['reset', 'fullscreen', 'aspect', 'pin'];
    if (panel.closable) defaultActions.push('close');
    let result = createXRPanelFrame({
      id: panel.id,
      component: panel.component,
      size: panel.size,
      closable: panel.closable,
      state: { pinned: panel.pinned },
    }, {
      ...(options.panelFrame || {}),
      actions: options.panelFrame?.actions || defaultActions,
      panelSizeMeters: panel.size,
      closable: panel.closable,
    });
    result.size = [...panel.size];
    return result;
  }

  function applyInteraction() {
    let changed = false;
    for (let object of [...(menuChrome?.children || []), ...(panelChrome?.children || [])]) {
      let material = object?.material;
      if (!material || object.userData?.kind !== 'raster-window-chrome') continue;
      let isHovered = object.userData.primitiveId === hoveredPrimitiveId;
      let isSelected = object.userData.primitiveId === selectedPrimitiveId;
      let emphasizedOpacity = (isHovered || isSelected) ? object.userData.hoverOpacity : object.userData.baseOpacity;
      let opacity;
      if (object === islandHitArea) {
        opacity = 0;
      } else if (object === grabStrip) {
        opacity = stripVisibility * (1 - menuVisibility) * emphasizedOpacity;
      } else if (object.userData.menuPrimitive === true) {
        opacity = menuVisibility * emphasizedOpacity;
      } else {
        opacity = emphasizedOpacity;
      }
      if (Math.abs(Number(material.opacity) - opacity) <= 1e-6) continue;
      material.opacity = opacity;
      material.needsUpdate = true;
      materialUpdates += 1;
      changed = true;
    }
    return changed;
  }

  function applyIslandScale(scale) {
    if (!islandAnchor) return false;
    let changed = false;
    for (let object of islandObjects) {
      let base = object?.userData?.islandBasePosition;
      if (!base) continue;
      let x = islandAnchor.x + (base.x - islandAnchor.x) * scale;
      let y = islandAnchor.y + (base.y - islandAnchor.y) * scale;
      if (Math.abs(Number(object.position?.x) - x) > 1e-6
        || Math.abs(Number(object.position?.y) - y) > 1e-6
        || Math.abs(Number(object.scale?.x) - scale) > 1e-6
        || Math.abs(Number(object.scale?.y) - scale) > 1e-6) {
        object.position?.set?.(x, y, base.z);
        object.scale?.set?.(scale, scale, 1);
        changed = true;
      }
    }
    return changed;
  }

  function isIslandPrimitive(primitiveId) {
    return islandObjects.some((object) => object?.userData?.primitiveId === primitiveId);
  }

  function chromeState() {
    return {
      menuChrome,
      panelChrome,
      interactive,
      islandObjects,
      islandAnchor,
      grabStrip,
      islandHitArea,
      groupHandle,
    };
  }

  function useChromeState(state) {
    menuChrome = state.menuChrome;
    panelChrome = state.panelChrome;
    interactive = state.interactive;
    islandObjects = state.islandObjects;
    islandAnchor = state.islandAnchor;
    grabStrip = state.grabStrip;
    islandHitArea = state.islandHitArea;
    groupHandle = state.groupHandle;
  }

  function emptyChromeState() {
    return {
      menuChrome: null,
      panelChrome: null,
      interactive: content ? [content] : [],
      islandObjects: [],
      islandAnchor: null,
      grabStrip: null,
      islandHitArea: null,
      groupHandle: null,
    };
  }

  function disposeChromeState(state) {
    for (let owner of [state.menuChrome, state.panelChrome]) {
      if (!owner) continue;
      for (let child of [...(owner.children || [])]) disposeMesh(child);
      group.remove?.(owner);
    }
  }

  function clearChrome() {
    let previous = chromeState();
    useChromeState(emptyChromeState());
    disposeChromeState(previous);
  }

  function buildChromeCandidate(generation = interactionGeneration) {
    let previous = chromeState();
    useChromeState(emptyChromeState());
    try {
    let currentFrame = frame();
    let colors = chromeTheme(options);
    let actionNames = Object.keys(currentFrame.zones.actions);
    let controlBarZone = currentFrame.zones.controlBar;
    let actionRects = actionNames.map((action) => {
      let zone = currentFrame.zones.actions[action];
      return {
        action,
        x: (zone.x - controlBarZone.x) / controlBarZone.width,
        y: (zone.y - controlBarZone.y) / controlBarZone.height,
        width: zone.width / controlBarZone.width,
        height: zone.height / controlBarZone.height,
      };
    });
    menuChrome = new THREE.Group();
    menuChrome.name = 'sn-raster-window-menu-chrome';
    menuChrome.userData = { kind: 'raster-window-menu-chrome-group', panelId: panel.id };
    panelChrome = new THREE.Group();
    panelChrome.name = 'sn-raster-window-panel-chrome';
    panelChrome.userData = { kind: 'raster-window-panel-chrome-group', panelId: panel.id };
    let controlBarAspect = (currentFrame.zones.controlBar.width * panel.size[0]) / (currentFrame.zones.controlBar.height * panel.size[1]);
    let controlBar = createChromeMesh(THREE, panel, currentFrame, currentFrame.zones.controlBar, {
      name: 'control-bar',
      operation: options.component === 'global-menu' ? 'move-menu' : 'move',
      texture: createMetaWindowChromeTexture(THREE, 'control-bar', {
        createCanvas: options.createCanvas,
        anisotropy: options.anisotropy,
        aspect: controlBarAspect,
        title: panel.title,
        actions: actionNames,
        actionRects,
        activeActions: [
          ...(panel.proportional ? ['aspect'] : []),
          ...(panel.pinned ? ['pin'] : []),
        ],
        background: colors.background,
        foreground: colors.foreground,
      }),
      opacity: 1,
      targetGeneration: generation,
    });
    controlBar.userData.menuPrimitive = true;
    menuChrome.add(controlBar);
    interactive.push(controlBar);
    islandAnchor = { x: controlBar.position.x, y: controlBar.position.y };
    islandObjects.push(controlBar);
    let grabStripZone = {
      x: currentFrame.zones.controlBar.x + currentFrame.zones.controlBar.width * 0.26,
      y: currentFrame.zones.controlBar.y + currentFrame.zones.controlBar.height * 0.16,
      width: currentFrame.zones.controlBar.width * 0.48,
      height: currentFrame.zones.controlBar.height * 0.68,
    };
    let grabStripAspect = (grabStripZone.width * panel.size[0]) / (grabStripZone.height * panel.size[1]);
    grabStrip = createChromeMesh(THREE, panel, currentFrame, grabStripZone, {
      name: 'grab-strip',
      operation: 'reveal',
      acquire: false,
      opacity: 1,
      hoverOpacity: 1,
      z: 0.03,
      texture: createMetaWindowChromeTexture(THREE, 'grab-strip', {
        createCanvas: options.createCanvas,
        anisotropy: options.anisotropy,
        aspect: grabStripAspect,
        color: colors.background,
      }),
      targetGeneration: generation,
    });
    menuChrome.add(grabStrip);
    interactive.push(grabStrip);
    let corridorTop = 1 - 0.012 / panel.size[1];
    let corridorBottom = currentFrame.zones.controlBar.y + currentFrame.zones.controlBar.height * 1.55;
    islandHitArea = createChromeMesh(THREE, panel, currentFrame, {
      x: currentFrame.zones.controlBar.x - currentFrame.zones.controlBar.width * 0.12,
      y: corridorTop,
      width: currentFrame.zones.controlBar.width * 1.24,
      height: corridorBottom - corridorTop,
    }, {
      name: 'island-hit-area',
      operation: 'reveal',
      acquire: false,
      opacity: 0,
      hoverOpacity: 0,
      z: 0.006,
      targetGeneration: generation,
    });
    menuChrome.add(islandHitArea);
    interactive.push(islandHitArea);
    for (let [handle, zone] of Object.entries(currentFrame.zones.resize)) {
      let mesh = createChromeMesh(THREE, panel, currentFrame, zone, {
        name: `resize-${handle}`,
        operation: 'resize',
        handle,
        opacity: 0,
        hoverOpacity: 1,
        texture: createMetaWindowChromeTexture(THREE, 'corner', {
          createCanvas: options.createCanvas,
          anisotropy: options.anisotropy,
          handle,
          color: colors.background,
        }),
        targetGeneration: generation,
      });
      mesh.userData.proximityPrimitive = true;
      panelChrome.add(mesh);
      interactive.push(mesh);
    }
    for (let [action, zone] of Object.entries(currentFrame.zones.actions)) {
      let mesh = createChromeMesh(THREE, panel, currentFrame, zone, {
        name: `action-${action}`,
        operation: 'action',
        action,
        handle: action,
        opacity: 0,
        hoverOpacity: 0.18,
        z: 0.014,
        texture: createMetaWindowChromeTexture(THREE, 'action-highlight', {
          createCanvas: options.createCanvas,
          anisotropy: options.anisotropy,
          color: colors.foreground,
        }),
        acquire: false,
        targetGeneration: generation,
      });
      menuChrome.add(mesh);
      islandObjects.push(mesh);
    }
    if (currentFrame.zones.groupHandle) {
      let handleAspect = (currentFrame.zones.groupHandle.width * panel.size[0])
        / (currentFrame.zones.groupHandle.height * panel.size[1]);
      groupHandle = createChromeMesh(THREE, panel, currentFrame, currentFrame.zones.groupHandle, {
        name: 'group-handle',
        operation: 'move-group',
        texture: createMetaWindowChromeTexture(THREE, 'grab-strip', {
          createCanvas: options.createCanvas,
          anisotropy: options.anisotropy,
          aspect: handleAspect,
          color: colors.background,
        }),
        opacity: 1,
        hoverOpacity: 1,
        z: 0.03,
        targetGeneration: generation,
      });
      groupHandle.userData.menuPrimitive = true;
      menuChrome.add(groupHandle);
      interactive.push(groupHandle);
      islandObjects.push(groupHandle);
    }
    for (let object of islandObjects) {
      object.userData.islandBasePosition = {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
      };
    }
    applyIslandScale(menuVisibility);
    applyInteraction();
    let candidate = chromeState();
    useChromeState(previous);
    return candidate;
    } catch (error) {
      let candidate = chromeState();
      useChromeState(previous);
      disposeChromeState(candidate);
      throw error;
    }
  }

  function notifyInteractionTargetChange(reason, previousGeneration) {
    let event = Object.freeze({
      version: 'three-raster-interaction-target-change-v1',
      panelId: panel.id,
      reason,
      previousGeneration,
      targetGeneration: interactionGeneration,
      createInteractionTarget: (handlers = {}) => createInteractionTarget(handlers),
    });
    for (let listener of [...interactionTargetListeners]) listener(event);
  }

  function commitChrome(candidate, generation, nextSize = null) {
    let previous = chromeState();
    let previousGeometry = null;
    let nextGeometry = null;
    if (nextSize) {
      try {
        nextGeometry = new THREE.PlaneGeometry(...nextSize);
      } catch (error) {
        disposeChromeState(candidate);
        throw error;
      }
    }
    try {
      group.add(candidate.panelChrome);
      group.add(candidate.menuChrome);
    } catch (error) {
      disposeChromeState(candidate);
      nextGeometry?.dispose?.();
      throw error;
    }
    useChromeState(candidate);
    interactionGeneration = generation;
    if (content?.userData) content.userData.targetGeneration = generation;
    if (nextSize) {
      previousGeometry = content.geometry;
      content.geometry = nextGeometry;
      panel.size = [...nextSize];
    }
    disposeChromeState(previous);
    previousGeometry?.dispose?.();
    applyIslandScale(menuVisibility);
    applyInteraction();
  }

  function rebuildChrome(reason, { size = null } = {}) {
    let previousGeneration = interactionGeneration;
    let nextGeneration = previousGeneration + 1;
    let previousSize = panel.size;
    if (size) panel.size = [...size];
    let candidate;
    try {
      candidate = buildChromeCandidate(nextGeneration);
    } finally {
      if (size) panel.size = previousSize;
    }
    commitChrome(candidate, nextGeneration, size);
    notifyInteractionTargetChange(reason, previousGeneration);
  }

  function mount() {
    if (content) return group;
    let material = new THREE.MeshBasicMaterial({
      color: 0x111820,
      transparent: false,
      depthTest: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    content = new THREE.Mesh(new THREE.PlaneGeometry(...panel.size), material);
    content.name = 'sn-raster-window-content';
    content.renderOrder = 20;
    content.userData = {
      kind: 'raster-window-content',
      panelId: panel.id,
      primitiveId: `${panel.id}/content`,
      targetId: `${panel.id}/content`,
      targetGeneration: interactionGeneration,
      operation: 'focus',
      acquire: true,
    };
    content.onBeforeRender = (renderer, _scene, camera) => {
      noteTexturePresentation(renderer, camera);
    };
    group.userData = { kind: 'raster-window-group', panelId: panel.id };
    group.add(content);
    interactive = [content];
    commitChrome(buildChromeCandidate(interactionGeneration), interactionGeneration);
    return group;
  }

  function setTexture(texture, nextRelease = null) {
    if (disposed) {
      nextRelease?.();
      return false;
    }
    mount();
    let nextTexture = texture || null;
    if (content.material.map === nextTexture) {
      let nextOwner = typeof nextRelease === 'function' ? nextRelease : null;
      if (releaseTexture && nextOwner && releaseTexture !== nextOwner) {
        throw new Error('Three raster panel texture is already owned by a different release callback.');
      }
      if (!releaseTexture && nextOwner) releaseTexture = nextOwner;
      return false;
    }
    let previousRelease = releaseTexture;
    releaseTexture = typeof nextRelease === 'function' ? nextRelease : null;
    observeTextureUpload(nextTexture);
    resetTexturePresentation(nextTexture);
    content.material.map = nextTexture;
    if (nextTexture) nextTexture.needsUpdate = true;
    if (content.material.color?.set) content.material.color.set(texture ? 0xffffff : 0x111820);
    else content.material.color = texture ? 0xffffff : 0x111820;
    content.material.needsUpdate = true;
    textureUpdates += 1;
    if (previousRelease) previousRelease();
    return true;
  }

  function setSize(sizeMeters) {
    let next = panelSize(sizeMeters);
    mount();
    if (next[0] === panel.size[0] && next[1] === panel.size[1]) return [...next];
    rebuildChrome('panel-size', { size: next });
    return [...next];
  }

  function previewSize(sizeMeters) {
    let next = panelSize(sizeMeters);
    mount();
    group.scale.set(next[0] / panel.size[0], next[1] / panel.size[1], 1);
    return [...next];
  }

  function clearPreviewSize() {
    mount();
    group.scale.set(1, 1, 1);
    return [...panel.size];
  }

  function setPanel(next = {}) {
    let previousPanel = { ...panel, size: [...panel.size] };
    let previousGeneration = interactionGeneration;
    let needsChrome = false;
    if (next.id !== undefined && String(next.id) !== panel.id) {
      throw new Error('Three raster panel renderer cannot change panel id after mount.');
    }
    if (next.title !== undefined) {
      let title = readableTitle(next.title, panel.id);
      needsChrome ||= title !== panel.title;
      panel.title = title;
    }
    if (next.pinned !== undefined) {
      let pinned = Boolean(next.pinned);
      needsChrome ||= pinned !== panel.pinned;
      panel.pinned = pinned;
    }
    if (next.proportional !== undefined) {
      let proportional = next.proportional !== false;
      needsChrome ||= proportional !== panel.proportional;
      panel.proportional = proportional;
    }
    if (next.closable !== undefined) {
      let closable = next.closable !== false;
      needsChrome ||= closable !== panel.closable;
      panel.closable = closable;
    }
    try {
      if (next.sizeMeters) {
        let size = panelSize(next.sizeMeters);
        let sizeChanged = size[0] !== panel.size[0] || size[1] !== panel.size[1];
        if (sizeChanged) setSize(size);
        else if (needsChrome && content) rebuildChrome('panel-state');
      } else if (needsChrome && content) rebuildChrome('panel-state');
    } catch (error) {
      if (interactionGeneration === previousGeneration) panel = previousPanel;
      throw error;
    }
    return getPanel();
  }

  function getPanel() {
    return {
      id: panel.id,
      component: panel.component,
      title: panel.title,
      sizeMeters: [...panel.size],
      pinned: panel.pinned,
      proportional: panel.proportional,
      closable: panel.closable,
      interactionGeneration,
    };
  }

  function setSelected(primitiveId) {
    let next = primitiveId || null;
    if (next !== selectedPrimitiveId) {
      selectedPrimitiveId = next;
      applyInteraction();
    }
    return selectedPrimitiveId;
  }

  function createInteractionTarget(handlers = {}) {
    mount();
    return {
      id: panel.id,
      ownerId: String(options.ownerId || panel.id),
      generation: interactionGeneration,
      priority: Number(options.interactionPriority || 0),
      acquire: true,
      getCandidateObjects: () => [...interactive],
      resolveHit: (intersection) => resolveIntersection(intersection),
      onHover: handlers.onHover,
      onPress(identity, details) {
        setSelected(details?.hit?.resolved?.primitiveId || null);
        return handlers.onPress?.(identity, details);
      },
      onMove: handlers.onMove,
      onRelease(identity, details) {
        try {
          return handlers.onRelease?.(identity, details);
        } finally {
          setSelected(null);
        }
      },
      onCancel(identity, details) {
        try {
          return handlers.onCancel?.(identity, details);
        } finally {
          setSelected(null);
        }
      },
    };
  }

  function resolveIntersection(intersection) {
    let object = intersection?.object || null;
    while (object) {
      let data = object.userData || {};
      if (data.kind === 'raster-window-content') {
        let point = {
          x: Number(intersection?.uv?.x ?? 0.5),
          y: 1 - Number(intersection?.uv?.y ?? 0.5),
        };
        let target = hitTestXRPanelFrame(frame(), point, { defaultContentOperation: 'focus' });
        return target ? {
          ...target,
          primitiveId: data.primitiveId,
          contentPoint: point,
          distance: intersection?.distance ?? null,
        } : null;
      }
      if (data.kind === 'raster-window-chrome') {
        if (data.menuPrimitive === true && menuVisibility < ISLAND_INTERACTION_THRESHOLD) return null;
        if (object === islandHitArea && stripVisibility < ISLAND_STRIP_INTERACTION_THRESHOLD) return null;
        if (object === grabStrip && (
          stripVisibility < ISLAND_STRIP_INTERACTION_THRESHOLD
          || menuVisibility >= ISLAND_HANDOFF_COMPLETE
        )) return null;
        if (data.menuPrimitive === true && (data.operation === 'move' || data.operation === 'move-menu')) {
          let point = {
            x: Number(intersection?.uv?.x ?? 0.5),
            y: 1 - Number(intersection?.uv?.y ?? 0.5),
          };
          let currentFrame = frame();
          let zone = currentFrame.zones.controlBar;
          let target = hitTestXRPanelFrame(currentFrame, {
            x: zone.x + point.x * zone.width,
            y: zone.y + point.y * zone.height,
          });
          if (target?.operation === 'action') {
            return {
              ...target,
              primitiveId: `${panel.id}/window-chrome/action-${target.action}`,
              acquire: true,
            };
          }
        }
        return {
          panelId: panel.id,
          primitiveId: data.primitiveId,
          operation: data.operation,
          action: data.action,
          handle: data.handle,
          acquire: data.acquire !== false,
          zone: data.operation === 'resize' ? 'resize' : 'panel-chrome',
          distance: intersection?.distance ?? null,
        };
      }
      object = object.parent;
    }
    return null;
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    interactionTargetListeners.clear();
    let release = releaseTexture;
    releaseTexture = null;
    let releaseError = null;
    try {
      release?.();
    } catch (error) {
      releaseError = error;
    } finally {
      detachTextureUploadObserver();
      resetTexturePresentation();
      clearChrome();
      if (content) {
        group.remove?.(content);
        if (content.material) content.material.map = null;
        disposeMesh(content, { disposeMap: false });
        content = null;
      }
      interactive = [];
    }
    if (releaseError) throw releaseError;
    return true;
  }

  return {
    version: THREE_RASTER_PANEL_RENDERER_VERSION,
    group,
    mount,
    setTexture,
    setSize,
    previewSize,
    clearPreviewSize,
    setPanel,
    getPanel,
    getInteractiveObjects: () => [...interactive],
    getContentObject: () => content,
    getTextureState,
    createInteractionTarget,
    resolveIntersection,
    onInteractionTargetChange(listener) {
      if (typeof listener !== 'function') throw new TypeError('Interaction target change listener must be a function.');
      interactionTargetListeners.add(listener);
      let active = true;
      return () => {
        if (!active) return false;
        active = false;
        return interactionTargetListeners.delete(listener);
      };
    },
    setHovered(primitiveId) {
      let nextHoveredPrimitiveId = primitiveId || null;
      let hoverChanged = nextHoveredPrimitiveId !== hoveredPrimitiveId;
      hoveredPrimitiveId = nextHoveredPrimitiveId;
      let contentHovered = hoveredPrimitiveId === content?.userData?.primitiveId;
      let stripHovered = hoveredPrimitiveId === grabStrip?.userData?.primitiveId;
      let hitAreaHovered = hoveredPrimitiveId === islandHitArea?.userData?.primitiveId;
      let menuHovered = isIslandPrimitive(hoveredPrimitiveId);
      if (stripHovered || hitAreaHovered || menuHovered) islandHoldRemainingMs = ISLAND_HOLD_MS;
      let holdingIsland = stripHovered || hitAreaHovered || menuHovered || islandHoldRemainingMs > 0;
      stripTargetVisibility = contentHovered || holdingIsland ? 1 : 0;
      menuTargetVisibility = holdingIsland ? 1 : 0;
      if (hoverChanged) applyInteraction();
    },
    syncFrame(timestamp = Date.now()) {
      let now = Number(timestamp);
      if (!Number.isFinite(now)) now = Date.now();
      let elapsed = islandLastFrameAt === null ? 16 : Math.min(80, Math.max(1, now - islandLastFrameAt));
      islandLastFrameAt = now;
      let islandHovered = isIslandPrimitive(hoveredPrimitiveId)
        || hoveredPrimitiveId === grabStrip?.userData?.primitiveId
        || hoveredPrimitiveId === islandHitArea?.userData?.primitiveId;
      if (islandHovered) islandHoldRemainingMs = ISLAND_HOLD_MS;
      else islandHoldRemainingMs = Math.max(0, islandHoldRemainingMs - elapsed);
      let contentHovered = hoveredPrimitiveId === content?.userData?.primitiveId;
      let holdingIsland = islandHovered || islandHoldRemainingMs > 0;
      menuTargetVisibility = holdingIsland ? 1 : 0;
      stripTargetVisibility = contentHovered || holdingIsland ? 1 : 0;
      let alpha = 1 - Math.exp(-elapsed / islandTransitionMs);
      let nextStrip = stripVisibility + (stripTargetVisibility - stripVisibility) * alpha;
      let nextMenu = menuVisibility + (menuTargetVisibility - menuVisibility) * alpha;
      if (Math.abs(stripTargetVisibility - nextStrip) < ISLAND_SETTLE_EPSILON) nextStrip = stripTargetVisibility;
      if (Math.abs(menuTargetVisibility - nextMenu) < ISLAND_SETTLE_EPSILON) nextMenu = menuTargetVisibility;
      let visibilityChanged = nextStrip !== stripVisibility || nextMenu !== menuVisibility;
      stripVisibility = nextStrip;
      menuVisibility = nextMenu;

      if (visibilityChanged) {
        applyIslandScale(menuVisibility);
        applyInteraction();
      }
      let changed = visibilityChanged;
      if (!changed) noOpFrames += 1;
      return changed;

    },
    setSelected,
    getDiagnostics() {
      return {
        version: THREE_RASTER_PANEL_RENDERER_VERSION,
        panel: getPanel(),
        mounted: Boolean(content),
        textureUpdates,
        texture: getTextureState(),
        interactiveCount: interactive.length,
        selectedPrimitiveId,
        hoveredPrimitiveId,
        stripVisibility,
        stripTargetVisible: stripTargetVisibility === 1,
        menuVisibility,
        menuTargetVisible: menuTargetVisibility === 1,
        islandHoldRemainingMs,
        interactionGeneration,
        noOpFrames,
        materialUpdates,
        resources: {
          geometries: [...new Set(group.children.flatMap((owner) => [owner, ...(owner.children || [])]).map((object) => object.geometry).filter(Boolean))].length,
          materials: [...new Set(group.children.flatMap((owner) => [owner, ...(owner.children || [])]).flatMap((object) => Array.isArray(object.material) ? object.material : [object.material]).filter(Boolean))].length,
          textures: [...new Set(group.children.flatMap((owner) => [owner, ...(owner.children || [])]).flatMap((object) => {
            let materials = Array.isArray(object.material) ? object.material : [object.material];
            return materials.map((material) => material?.map).filter(Boolean);
          }))].length,
          renderTargets: 0,
          interactionTargetListeners: interactionTargetListeners.size,
        },
      };
    },
    dispose,
  };
}
