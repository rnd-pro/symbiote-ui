import {
  WEBXR_FEATURES,
  createWebXRLaunchGateSummary,
  createXRReadinessSummary,
  redactXRDiagnosticUrl,
  requestWebXRSession,
} from './webxr.js';
import {
  createXRHtmlCanvasRenderer,
  createXRPanelTextureSourceSummary,
} from './html-canvas-renderer.js';
import { createXRPanelFrame, hitTestXRPanelFrame } from './panel-frame.js';
import {
  createXRPanelTextureQualitySummary,
  createXRTextureQualityPolicy,
} from './layout-projection.js';
import {
  selectPrimaryXRInputSource,
} from './pointer.js';
import {
  createXRSceneRootTransform,
  createXRViewerPoseSnapshot,
} from './spatial-scene.js';

export const XR_THREE_WEBXR_ADAPTER = Object.freeze({
  name: 'three-webxr',
  status: 'optional-adapter',
  specifier: 'symbiote-ui/xr',
  description: 'Optional Three.js WebXR adapter for Symbiote XR scenes. The host supplies the THREE module.',
  modes: ['immersive-vr', 'immersive-ar'],
  fallback: 'dom-canvas',
  dependency: {
    name: 'three',
    injection: 'host-supplied',
    required: false,
  },
  capabilities: [
    'three-webxr-manager',
    'three-scene-panels',
    'three-controller-rays',
    'three-controller-ray-visuals',
    'three-panel-hit-reticle',
    'three-panel-frame-hit-target',
    'three-panel-frame-visuals',
    'three-frame-target-drag-gate',
    'three-frame-target-resize-persistence',
    'three-interaction-state-diagnostics',
    'three-session-telemetry-snapshot',
    'three-session-runtime-diagnostics',
    'three-session-options-diagnostics',
    'three-session-options-builder',
    'three-session-health-summary',
    'three-session-watchdog',
    'three-diagnostic-payload',
    'three-diagnostic-timeline',
    'three-diagnostic-server-summary',
    'three-troubleshooting-summary',
    'three-raycaster-controller',
    'three-ray-plane-panel-drag',
    'three-drag-response-filter',
    'three-session-controller',
    'three-render-host',
    'three-render-host-diagnostics',
    'three-render-loop',
    'three-dom-texture-material-bridge',
    'three-html-canvas-texture-resolver',
    'three-texture-quality-policy',
    'three-dirty-texture-redraw',
    'three-strict-texture-fail-fast',
    'three-scene-decoration',
    'three-camera-resize',
    'three-controller-select-events',
    'three-primary-input-source',
    'three-animation-loop',
    'three-panel-material-state',
    'three-session-diagnostics',
    'symbiote-xr-scene-adapter',
    'host-supplied-three',
  ],
});

function hasFn(source, name) {
  return typeof source?.[name] === 'function';
}

function assertThree(THREE) {
  let missing = [
    'Scene',
    'PerspectiveCamera',
    'WebGLRenderer',
    'PlaneGeometry',
    'Mesh',
    'MeshStandardMaterial',
    'Raycaster',
  ].filter((name) => typeof THREE?.[name] !== 'function');
  if (missing.length) {
    return {
      ok: false,
      reason: 'missing-three-api',
      missing,
    };
  }
  return { ok: true, missing: [] };
}

function callSetter(target, method, values = []) {
  if (hasFn(target, method)) {
    target[method](...values);
    return true;
  }
  return false;
}

function normalizeStringList(value) {
  if (!value) return [];
  try {
    return [...value].map((item) => String(item)).filter(Boolean);
  } catch {
    return [];
  }
}

function normalizeInputSources(inputSources) {
  if (!inputSources) return [];
  try {
    return [...inputSources].map((source) => ({
      handedness: source?.handedness || '',
      targetRayMode: source?.targetRayMode || '',
      profiles: normalizeStringList(source?.profiles),
    }));
  } catch {
    return [];
  }
}

function summarizeTextureSourceQuality(textureSources = []) {
  let sources = Array.isArray(textureSources) ? textureSources : [];
  let statuses = new Map();
  let warnings = [];
  let recommendations = [];
  for (let source of sources) {
    let status = source?.textureQuality?.status || source?.qualityStatus || null;
    if (status) {
      statuses.set(status, (statuses.get(status) || 0) + 1);
    }
    let sourceWarnings = source?.textureQuality?.warnings || source?.qualityWarnings || [];
    for (let warning of sourceWarnings) {
      warnings.push({
        panelId: source?.panelId || null,
        code: String(warning),
      });
    }
    let sourceRecommendations = source?.textureQuality?.recommendations || source?.qualityRecommendations || [];
    for (let recommendation of sourceRecommendations) {
      recommendations.push({
        panelId: source?.panelId || null,
        code: String(recommendation),
      });
    }
  }
  let priority = new Map([
    ['provide-texture-size', 0],
    ['increase-texture-resolution', 1],
    ['increase-texture-density-to-target', 2],
    ['increase-texture-pixel-ratio', 3],
    ['increase-max-texture-size', 4],
  ]);
  let actionMap = new Map();
  for (let recommendation of recommendations) {
    let code = recommendation.code || 'recommendation';
    let action = actionMap.get(code) || {
      code,
      count: 0,
      panelIds: [],
      priority: priority.get(code) ?? 99,
    };
    action.count += 1;
    if (recommendation.panelId && !action.panelIds.includes(recommendation.panelId)) {
      action.panelIds.push(recommendation.panelId);
    }
    actionMap.set(code, action);
  }
  let actions = [...actionMap.values()]
    .sort((first, second) => first.priority - second.priority || second.count - first.count || first.code.localeCompare(second.code))
    .map(({ priority: _priority, ...action }) => action);
  return {
    total: sources.length,
    target: Number(statuses.get('target') || 0),
    readable: Number(statuses.get('readable') || 0),
    low: Number(statuses.get('low') || 0),
    blocked: Number(statuses.get('blocked') || 0),
    warningCount: warnings.length,
    warnings,
    recommendationCount: recommendations.length,
    recommendations,
    primaryRecommendation: actions[0]?.code || null,
    actions,
  };
}

function applyVector(target, values = []) {
  if (!target) return;
  if (!callSetter(target, 'fromArray', [values])) {
    callSetter(target, 'set', values);
  }
}

function applyRotation(target, values = []) {
  if (!target) return;
  if (hasFn(target, 'set')) {
    target.set(...values.map((value) => Number(value || 0) * Math.PI / 180));
  }
}

function readBounds(source, fallback = {}) {
  let rect = source?.getBoundingClientRect?.() || source || {};
  let width = Number(rect.width || fallback.width || 1280);
  let height = Number(rect.height || fallback.height || 720);
  return {
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  };
}

function clampPixelRatio(value, max = 2) {
  let ratio = Number(value || 1);
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(ratio, Number(max || 2));
}

function nowMs(options = {}) {
  if (typeof options.now === 'function') {
    return Number(options.now());
  }
  let value = Number(options.now);
  return Number.isFinite(value) ? value : Date.now();
}

function normalizeRayVisualOptions(options = {}) {
  let length = Number(options.rayLength ?? options.length ?? 3);
  let color = options.rayColor ?? options.color ?? 0x7fd6ff;
  let opacity = Number(options.rayOpacity ?? options.opacity ?? 0.84);
  return {
    enabled: options.enabled !== false,
    length: Number.isFinite(length) ? Math.max(0.2, Math.min(8, length)) : 3,
    color,
    opacity: Number.isFinite(opacity) ? Math.max(0.05, Math.min(1, opacity)) : 0.84,
  };
}

function buildControllerRayVisual(THREE, options = {}) {
  let visual = normalizeRayVisualOptions(options);
  if (!visual.enabled) {
    return { ok: false, reason: 'disabled' };
  }
  let missing = ['BufferGeometry', 'Float32BufferAttribute', 'LineBasicMaterial', 'Line']
    .filter((name) => typeof THREE?.[name] !== 'function');
  if (missing.length) {
    return { ok: false, reason: 'missing-three-ray-visual-api', missing };
  }
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0,
    0, 0, -visual.length,
  ], 3));
  let material = new THREE.LineBasicMaterial({
    color: visual.color,
    transparent: true,
    opacity: visual.opacity,
    depthTest: false,
  });
  let line = new THREE.Line(geometry, material);
  line.name = 'sn-xr-controller-ray';
  line.userData ||= {};
  line.userData.snControllerRay = true;
  line.renderOrder = Number(options.renderOrder ?? 20);
  return {
    ok: true,
    object: line,
    type: 'controller-ray',
    length: visual.length,
    color: visual.color,
    opacity: visual.opacity,
  };
}

function normalizeHitReticleOptions(options = {}) {
  let innerRadius = Number(options.innerRadius ?? 0.018);
  let outerRadius = Number(options.outerRadius ?? 0.032);
  let color = options.color ?? 0x9ee7ff;
  let opacity = Number(options.opacity ?? 0.92);
  return {
    enabled: options.enabled !== false,
    innerRadius: Number.isFinite(innerRadius) ? Math.max(0.004, Math.min(0.08, innerRadius)) : 0.018,
    outerRadius: Number.isFinite(outerRadius) ? Math.max(0.006, Math.min(0.12, outerRadius)) : 0.032,
    color,
    opacity: Number.isFinite(opacity) ? Math.max(0.05, Math.min(1, opacity)) : 0.92,
  };
}

function buildPanelHitReticleVisual(THREE, options = {}) {
  let visual = normalizeHitReticleOptions(options);
  if (!visual.enabled) {
    return { ok: false, reason: 'disabled' };
  }
  let missing = ['RingGeometry', 'MeshBasicMaterial', 'Mesh']
    .filter((name) => typeof THREE?.[name] !== 'function');
  if (missing.length) {
    return { ok: false, reason: 'missing-three-hit-reticle-api', missing };
  }
  let geometry = new THREE.RingGeometry(visual.innerRadius, visual.outerRadius, Number(options.segments || 32));
  let material = new THREE.MeshBasicMaterial({
    color: visual.color,
    transparent: true,
    opacity: visual.opacity,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  let reticle = new THREE.Mesh(geometry, material);
  reticle.name = 'sn-xr-panel-hit-reticle';
  reticle.visible = false;
  reticle.renderOrder = Number(options.renderOrder ?? 30);
  reticle.userData ||= {};
  reticle.userData.snPanelHitReticle = true;
  return {
    ok: true,
    object: reticle,
    type: 'panel-hit-reticle',
    innerRadius: visual.innerRadius,
    outerRadius: visual.outerRadius,
    color: visual.color,
    opacity: visual.opacity,
  };
}

function updatePanelHitReticleVisual(reticle, hit) {
  let object = reticle?.object || reticle;
  if (!object) return { ok: false, reason: 'missing-hit-reticle' };
  if (!hit?.point || !hit?.object) {
    object.visible = false;
    object.userData ||= {};
    object.userData.panelId = null;
    return { ok: true, visible: false, panelId: null };
  }
  object.visible = true;
  object.userData ||= {};
  object.userData.panelId = hit.object.userData?.panelId || null;
  if (object.position?.copy) object.position.copy(hit.point);
  else applyVector(object.position, [hit.point.x, hit.point.y, hit.point.z]);
  if (object.quaternion?.copy && hit.object.quaternion) object.quaternion.copy(hit.object.quaternion);
  return {
    ok: true,
    visible: true,
    panelId: object.userData.panelId,
    point: vectorData(hit.point),
    distance: Number(hit.distance || 0),
  };
}

function normalizePanelFrameVisualOptions(options = {}) {
  let headerColor = options.headerColor ?? options.color ?? 0x7fd6ff;
  let handleColor = options.handleColor ?? options.color ?? 0x9ee7ff;
  let actionColor = options.actionColor ?? options.color ?? 0xffffff;
  let opacity = Number(options.opacity ?? 0.34);
  let handleOpacity = Number(options.handleOpacity ?? 0.62);
  return {
    enabled: options.enabled !== false,
    headerColor,
    handleColor,
    actionColor,
    opacity: Number.isFinite(opacity) ? Math.max(0.04, Math.min(1, opacity)) : 0.34,
    handleOpacity: Number.isFinite(handleOpacity) ? Math.max(0.04, Math.min(1, handleOpacity)) : 0.62,
    zOffset: Number(options.zOffset ?? 0.006),
    renderOrder: Number(options.renderOrder ?? 28),
  };
}

function frameZoneToPanelRect(zone = {}, size = [0.8, 0.45]) {
  let width = Math.max(0.001, Number(size[0] || 0.8));
  let height = Math.max(0.001, Number(size[1] || 0.45));
  let zoneWidth = Math.max(0.001, Number(zone.width || 0) * width);
  let zoneHeight = Math.max(0.001, Number(zone.height || 0) * height);
  return {
    width: zoneWidth,
    height: zoneHeight,
    x: -width / 2 + Number(zone.x || 0) * width + zoneWidth / 2,
    y: height / 2 - Number(zone.y || 0) * height - zoneHeight / 2,
  };
}

function removePanelFrameVisuals(mesh) {
  let objects = mesh?.userData?.panelFrameVisuals?.objects || [];
  for (let object of objects) {
    if (typeof mesh?.remove === 'function') {
      mesh.remove(object);
    } else if (Array.isArray(mesh?.children)) {
      let index = mesh.children.indexOf(object);
      if (index >= 0) mesh.children.splice(index, 1);
    }
  }
}

function addPanelFrameVisualObject(mesh, object) {
  if (typeof mesh?.add === 'function') {
    mesh.add(object);
    return true;
  }
  if (Array.isArray(mesh?.children)) {
    mesh.children.push(object);
    return true;
  }
  return false;
}

function buildPanelFrameZoneVisual(THREE, zoneName, zone, size, visual, metadata = {}) {
  let rect = frameZoneToPanelRect(zone, size);
  let geometry = new THREE.PlaneGeometry(rect.width, rect.height);
  let material = new THREE.MeshBasicMaterial({
    color: metadata.color ?? visual.handleColor,
    transparent: true,
    opacity: metadata.opacity ?? visual.handleOpacity,
    depthTest: false,
    side: THREE.DoubleSide,
  });
  let object = new THREE.Mesh(geometry, material);
  object.name = `sn-xr-panel-frame-${zoneName}`;
  object.renderOrder = visual.renderOrder;
  object.userData ||= {};
  object.userData.snPanelFrameVisual = true;
  object.userData.zone = metadata.zone || zoneName;
  object.userData.operation = metadata.operation || 'focus';
  object.userData.handle = metadata.handle || null;
  object.userData.action = metadata.action || null;
  object.userData.baseColor = metadata.color ?? visual.handleColor;
  object.userData.baseOpacity = metadata.opacity ?? visual.handleOpacity;
  if (object.position?.set) {
    object.position.set(rect.x, rect.y, visual.zOffset);
  } else {
    object.position = { x: rect.x, y: rect.y, z: visual.zOffset };
  }
  return object;
}

function buildPanelFrameVisuals(THREE, panel, mesh, options = {}) {
  let visual = normalizePanelFrameVisualOptions(options);
  if (!visual.enabled) {
    return { ok: false, reason: 'disabled', objects: [] };
  }
  let missing = ['PlaneGeometry', 'MeshBasicMaterial', 'Mesh']
    .filter((name) => typeof THREE?.[name] !== 'function');
  if (missing.length) {
    return { ok: false, reason: 'missing-three-panel-frame-visual-api', missing, objects: [] };
  }
  if (!mesh) {
    return { ok: false, reason: 'missing-panel-mesh', objects: [] };
  }

  removePanelFrameVisuals(mesh);
  let frame = createXRPanelFrame(panel || {}, options.frame || {});
  let size = readPanelSize(mesh);
  let objects = [];
  let zones = [];

  let moveObject = buildPanelFrameZoneVisual(THREE, 'move', frame.zones.move, size, visual, {
    zone: 'move',
    operation: 'move',
    color: visual.headerColor,
    opacity: visual.opacity,
  });
  moveObject.userData.panelId = frame.panelId;
  if (addPanelFrameVisualObject(mesh, moveObject)) {
    objects.push(moveObject);
    zones.push('move');
  }

  for (let [handle, zone] of Object.entries(frame.zones.resize || {})) {
    let object = buildPanelFrameZoneVisual(THREE, `resize-${handle}`, zone, size, visual, {
      zone: 'resize',
      operation: 'resize',
      handle,
    });
    object.userData.panelId = frame.panelId;
    if (addPanelFrameVisualObject(mesh, object)) {
      objects.push(object);
      zones.push(`resize:${handle}`);
    }
  }

  for (let [action, zone] of Object.entries(frame.zones.actions || {})) {
    let object = buildPanelFrameZoneVisual(THREE, `action-${action}`, zone, size, visual, {
      zone: 'action',
      operation: 'action',
      action,
      color: visual.actionColor,
      opacity: visual.opacity,
    });
    object.userData.panelId = frame.panelId;
    if (addPanelFrameVisualObject(mesh, object)) {
      objects.push(object);
      zones.push(`action:${action}`);
    }
  }

  let summary = {
    ok: true,
    type: 'panel-frame-visuals',
    panelId: frame.panelId,
    objectCount: objects.length,
    zones,
    header: true,
    resizeHandles: Object.keys(frame.zones.resize || {}).length,
    actionSlots: Object.keys(frame.zones.actions || {}).length,
    objects,
  };
  mesh.userData ||= {};
  mesh.userData.panelFrameVisuals = summary;
  mesh.userData.updatePanelFrameVisuals = () => buildPanelFrameVisuals(THREE, mesh.userData.panel || panel, mesh, options);
  return summary;
}

function createMaterial(THREE, panel, options = {}) {
  let material = panel.material || {};
  let color = options.colorResolver?.(panel) ||
    material.threeColor ||
    material.backgroundColor ||
    panel.color ||
    0x243244;
  if (typeof THREE.MeshBasicMaterial === 'function') {
    return new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: false,
      opacity: Number(options.opacity ?? 1),
    });
  }
  return new THREE.MeshStandardMaterial({
    color,
    roughness: Number(options.roughness ?? 0.72),
    metalness: Number(options.metalness ?? 0.04),
    side: THREE.DoubleSide,
    transparent: false,
    opacity: Number(options.opacity ?? 1),
  });
}

function applyStrictTextureDiagnosticMaterial(mesh, textureRecord, options = {}) {
  if (!mesh) return;
  mesh.visible = false;
  mesh.userData ||= {};
  mesh.userData.strictTextureHidden = true;
  mesh.userData.strictTextureDiagnostic = false;
  mesh.userData.strictTextureDiagnosticReason = textureRecord?.reason || textureRecord?.stage || 'texture-unavailable';
  let material = mesh.material;
  if (!material) return;
  material.map = null;
  material.transparent = false;
  material.opacity = Number(options.strictTextureDiagnosticOpacity ?? 1);
  if (material.color?.setHex) {
    material.color.setHex(Number(options.strictTextureDiagnosticColor ?? 0x5b6572));
  } else {
    material.color = Number(options.strictTextureDiagnosticColor ?? 0x5b6572);
  }
  if (material.emissive?.setHex) {
    material.emissive.setHex(Number(options.strictTextureDiagnosticEmissive ?? 0x15191f));
  }
  markMaterialUpdated(material);
}

function resolvePanelElement(panel, options = {}) {
  if (typeof options.getPanelElement === 'function') {
    return options.getPanelElement(panel.id, panel);
  }
  if (options.panelElements?.get) {
    return options.panelElements.get(panel.id) || null;
  }
  if (options.panelElements && typeof options.panelElements === 'object') {
    return options.panelElements[panel.id] || null;
  }
  return null;
}

function markMaterialUpdated(material) {
  if (!material) return;
  material.needsUpdate = true;
}

function applyMaterialColor(material, color) {
  if (!material?.color || color == null) return false;
  if (typeof color === 'number' && hasFn(material.color, 'setHex')) {
    material.color.setHex(color);
    markMaterialUpdated(material);
    return true;
  }
  if (typeof color === 'string' && hasFn(material.color, 'setStyle')) {
    material.color.setStyle(color);
    markMaterialUpdated(material);
    return true;
  }
  if (hasFn(material.color, 'set')) {
    material.color.set(color);
    markMaterialUpdated(material);
    return true;
  }
  return false;
}

function colorSummary(color) {
  if (color == null) return null;
  if (typeof color === 'number' || typeof color === 'string') return color;
  if (typeof color.getHexString === 'function') return `#${color.getHexString()}`;
  if (typeof color.getHex === 'function') return color.getHex();
  return null;
}

function textureSummary(texture) {
  if (!texture) return null;
  let image = texture.image || null;
  return {
    name: texture.name || null,
    isTexture: texture.isTexture === true,
    kind: texture.isHTMLTexture ? 'html-texture' : texture.isCanvasTexture ? 'canvas-texture' : texture.isTexture ? 'texture' : 'host-texture',
    width: Number.isFinite(Number(image?.width)) ? Number(image.width) : null,
    height: Number.isFinite(Number(image?.height)) ? Number(image.height) : null,
    colorSpace: texture.colorSpace || texture.encoding || null,
    premultiplyAlpha: texture.premultiplyAlpha == null ? null : Boolean(texture.premultiplyAlpha),
    flipY: texture.flipY == null ? null : Boolean(texture.flipY),
    generateMipmaps: texture.generateMipmaps == null ? null : Boolean(texture.generateMipmaps),
    needsUpdate: texture.needsUpdate == null ? null : Boolean(texture.needsUpdate),
  };
}

function materialSummary(mesh) {
  let material = mesh?.material || null;
  return {
    panelId: mesh?.userData?.panelId || null,
    visible: mesh?.visible !== false,
    transparent: material?.transparent === true,
    opacity: Number.isFinite(Number(material?.opacity)) ? Number(material.opacity) : null,
    mapApplied: Boolean(material?.map),
    mapName: material?.map?.name || null,
    texture: textureSummary(material?.map),
    color: colorSummary(material?.color),
    emissive: colorSummary(material?.emissive),
    side: material?.side == null ? null : String(material.side),
    depthTest: material?.depthTest == null ? null : Boolean(material.depthTest),
    depthWrite: material?.depthWrite == null ? null : Boolean(material.depthWrite),
    renderOrder: Number.isFinite(Number(mesh?.renderOrder)) ? Number(mesh.renderOrder) : 0,
    strictDiagnostic: mesh?.userData?.strictTextureDiagnostic === true,
    strictDiagnosticReason: mesh?.userData?.strictTextureDiagnosticReason || null,
  };
}

function summarizePanelMaterials(meshes = []) {
  let panels = meshes.map(materialSummary);
  return {
    version: 'xr-three-panel-material-diagnostics-v1',
    total: panels.length,
    transparentCount: panels.filter((panel) => panel.transparent).length,
    mappedCount: panels.filter((panel) => panel.mapApplied).length,
    strictDiagnosticCount: panels.filter((panel) => panel.strictDiagnostic).length,
    strictDiagnosticPanelIds: panels.filter((panel) => panel.strictDiagnostic).map((panel) => panel.panelId).filter(Boolean),
    panels,
  };
}

function applyPanelFrameVisualState(mesh, resolved = {}) {
  let objects = mesh?.userData?.panelFrameVisuals?.objects || [];
  let state = resolved.state || 'default';
  let updated = 0;
  let active = state !== 'default';
  for (let object of objects) {
    let material = object?.material || null;
    let color = active ? resolved.color : object?.userData?.baseColor;
    let colorApplied = applyMaterialColor(material, color);
    let opacityApplied = false;
    if (material && 'opacity' in material) {
      let baseOpacity = Number(object?.userData?.baseOpacity ?? material.opacity ?? 0.34);
      material.opacity = active ? Math.min(1, baseOpacity + 0.22) : baseOpacity;
      markMaterialUpdated(material);
      opacityApplied = true;
    }
    object.userData ||= {};
    object.userData.state = state;
    if (colorApplied || opacityApplied) updated += 1;
  }
  return {
    count: objects.length,
    updated,
    state,
  };
}

function resolvePanelStateColor(mesh, state = {}, themeSnapshot = {}) {
  let panelId = mesh?.userData?.panelId || null;
  let material = themeSnapshot.material || {};
  let baseColor = mesh?.userData?.baseColor ||
    mesh?.userData?.panel?.material?.backgroundColor ||
    material.backgroundColor ||
    material.background ||
    null;
  if (panelId && (panelId === state.draggingPanelId || panelId === state.selectedPanelId)) {
    return {
      state: panelId === state.draggingPanelId ? 'dragging' : 'selected',
      color: material.pointerColor || material.pointer || baseColor,
    };
  }
  if (panelId && panelId === state.hoverPanelId) {
    return {
      state: 'hover',
      color: material.borderColor || material.border || baseColor,
    };
  }
  return {
    state: 'default',
    color: baseColor,
  };
}

export function updateXRThreePanelMaterialStates(options = {}) {
  let adapter = options.adapter || null;
  let meshes = options.meshes || adapter?.listPanelMeshes?.() || [];
  let sessionState = options.sessionState || {};
  let themeSnapshot = options.themeSnapshot || {};
  let state = {
    hoverPanelId: sessionState.hover?.panelId || sessionState.hoverPanelId || null,
    selectedPanelId: sessionState.selectedPanelId || null,
    draggingPanelId: sessionState.draggingPanelId || null,
  };
  let panels = [];

  for (let mesh of meshes) {
    let panelId = mesh?.userData?.panelId || null;
    let resolved = resolvePanelStateColor(mesh, state, themeSnapshot);
    let applied = applyMaterialColor(mesh?.material, resolved.color);
    let frameVisuals = applyPanelFrameVisualState(mesh, resolved);
    panels.push({
      panelId,
      state: resolved.state,
      applied,
      frameVisuals,
      colorType: resolved.color == null ? null : typeof resolved.color,
    });
  }

  return {
    version: 'xr-three-panel-material-state-v1',
    panelCount: panels.length,
    hoverPanelId: state.hoverPanelId,
    selectedPanelId: state.selectedPanelId,
    draggingPanelId: state.draggingPanelId,
    panels,
  };
}

function classifyTextureBridgeStage(summary, texture, textureReason) {
  if (!summary) return 'texture-source-missing';
  if (texture) return 'three-material-applied';
  if (summary.source !== 'html-in-canvas') return 'html-in-canvas-support';
  if (textureReason === 'texture-resolver-missing') return 'three-texture-resolver';
  if (textureReason === 'texture-resolver-empty') return 'three-texture-upload';
  return 'three-material-pending';
}

function resolveTextureDocument(options = {}) {
  return options.document || options.globalThis?.document || globalThis?.document || null;
}

function createTextureCanvas(documentRef, panel, options = {}) {
  let canvas = options.canvasFactory?.(panel) || documentRef?.createElement?.('canvas') || null;
  if (!canvas) return null;
  resizeTextureCanvas(canvas, panel, options);
  return canvas;
}

function resizeTextureCanvas(canvas, panel, options = {}) {
  let policy = options.qualityPolicy || createXRTextureQualityPolicy(panel, options);
  let width = Number(options.width || policy.texturePixels?.width || panel.previewPixels?.width || 1024);
  let height = Number(options.height || policy.texturePixels?.height || panel.previewPixels?.height || 576);
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function applyTextureQualityOptions(THREE, texture, options = {}) {
  if (!texture) return null;
  let applied = {
    minFilter: null,
    magFilter: null,
    colorSpace: null,
    mipmaps: null,
    anisotropy: null,
  };
  let minFilter = options.minFilter || THREE?.LinearFilter || null;
  let magFilter = options.magFilter || THREE?.LinearFilter || null;
  if (minFilter != null) {
    texture.minFilter = minFilter;
    applied.minFilter = 'linear';
  }
  if (magFilter != null) {
    texture.magFilter = magFilter;
    applied.magFilter = 'linear';
  }
  if (options.generateMipmaps != null || 'generateMipmaps' in texture) {
    texture.generateMipmaps = options.generateMipmaps === true;
    applied.mipmaps = texture.generateMipmaps;
  }
  let colorSpace = options.colorSpace || THREE?.SRGBColorSpace || null;
  if (colorSpace != null && 'colorSpace' in texture) {
    texture.colorSpace = colorSpace;
    applied.colorSpace = 'srgb';
  } else if (THREE?.sRGBEncoding && 'encoding' in texture) {
    texture.encoding = THREE.sRGBEncoding;
    applied.colorSpace = 'srgb-encoding';
  }
  let anisotropy = Number(options.anisotropy || 0);
  if (Number.isFinite(anisotropy) && anisotropy > 0 && 'anisotropy' in texture) {
    texture.anisotropy = anisotropy;
    applied.anisotropy = anisotropy;
  }
  texture.needsUpdate = true;
  return applied;
}

function createThreeCanvasTexture(THREE, canvas, options = {}) {
  if (!THREE || !canvas) return null;
  let texture = null;
  if (typeof THREE.CanvasTexture === 'function') {
    texture = new THREE.CanvasTexture(canvas);
  } else if (typeof THREE.Texture === 'function') {
    texture = new THREE.Texture(canvas);
  }
  if (!texture) return null;
  texture.name = options.name || 'sn-xr-html-canvas-texture';
  applyTextureQualityOptions(THREE, texture, options);
  if ('isTexture' in texture) texture.isTexture = true;
  return texture;
}

function createThreeHtmlElementTexture(THREE, element, options = {}) {
  if (!THREE || !element || typeof THREE.HTMLTexture !== 'function') return null;
  let texture;
  try {
    texture = new THREE.HTMLTexture(element);
  } catch {
    return null;
  }
  texture.name = options.name || 'sn-xr-html-element-texture';
  applyTextureQualityOptions(THREE, texture, options);
  if ('isTexture' in texture) texture.isTexture = true;
  return texture;
}

function requiresThreeHtmlTexture(input = {}) {
  let support = input.support || {};
  let diagnostics = support.diagnostics || {};
  return diagnostics.textureUploadAvailable === true ||
    support.modes?.webgl === true ||
    support.modes?.webgpu === true;
}

function canUseThreeHtmlTexture(THREE, input = {}) {
  return typeof THREE?.HTMLTexture === 'function' && input.element && requiresThreeHtmlTexture(input);
}

export function createXRThreeTextureCapabilitySummary(THREE, support = {}) {
  let diagnostics = support.diagnostics || {};
  let modes = support.modes || {};
  let textureUploadAvailable = diagnostics.textureUploadAvailable === true ||
    modes.webgl === true ||
    modes.webgpu === true;
  let htmlTextureAvailable = typeof THREE?.HTMLTexture === 'function';
  let htmlTextureUsable = Boolean(htmlTextureAvailable && textureUploadAvailable);
  let threeRevision = THREE?.REVISION == null ? null : String(THREE.REVISION);
  let htmlTextureRequired = textureUploadAvailable;
  let reason = !textureUploadAvailable
    ? 'html-in-canvas-texture-upload-missing'
    : htmlTextureRequired && !htmlTextureAvailable
    ? 'three-html-texture-api-missing'
    : null;
  return {
    version: 'xr-three-texture-capability-v1',
    renderer: 'three',
    threeRevision,
    htmlTextureAvailable,
    htmlTextureUsable,
    htmlTextureRequired,
    textureUploadAvailable,
    modes: {
      webgl: modes.webgl === true,
      webgpu: modes.webgpu === true,
      canvas2d: modes.canvas2d === true,
    },
    ready: htmlTextureUsable,
    reason,
  };
}

function resolveCanvasSource(input = {}) {
  let explicitCanvas = input.canvas || input.prepareResult?.canvas || null;
  if (explicitCanvas) return explicitCanvas;
  let parent = input.element?.parentElement || input.element?.parentNode || null;
  let tagName = String(parent?.tagName || parent?.nodeName || '').toLowerCase();
  return tagName === 'canvas' ? parent : null;
}

export function createXRThreeHtmlCanvasTextureResolver(options = {}) {
  let THREE = options.THREE;
  let documentRef = resolveTextureDocument(options);
  let htmlCanvasRenderer = options.htmlCanvasRenderer || createXRHtmlCanvasRenderer({
    globalThis: options.globalThis,
    mode: options.mode,
  });
  let records = new Map();
  let textures = new Map();

  function textureDirtyKey(input = {}, canvas, policy) {
    let panel = input.panel || {};
    return String(input.dirtyKey ||
      panel.textureKey ||
      input.element?.dataset?.textureKey ||
      input.element?.dataset?.updatedAt ||
      `${canvas?.width || 0}x${canvas?.height || 0}:${policy.texturePixelRatio}:${policy.redrawMode}`);
  }

  function resolveTexture(input = {}) {
    let panel = input.panel || {};
    let panelId = panel.id || null;
    if (!panelId) {
      return null;
    }
    if (input.summary?.source !== 'html-in-canvas') {
      records.set(panelId, {
        ok: false,
        panelId,
        reason: input.summary?.reason || 'html-in-canvas-unavailable',
        stage: 'html-in-canvas-support',
        textureApplied: false,
        width: null,
        height: null,
      });
      return null;
    }
    let policy = createXRTextureQualityPolicy(panel, {
      ...options,
      ...(input.textureQuality || {}),
      preferTargetDensity: input.textureQuality?.preferTargetDensity ?? options.preferTargetDensity ?? true,
    });
    if (requiresThreeHtmlTexture(input) && typeof THREE?.HTMLTexture !== 'function') {
      records.set(panelId, {
        ok: false,
        panelId,
        reason: 'three-html-texture-api-missing',
        stage: 'three-html-texture-api',
        textureApplied: false,
        width: panel.contentViewport?.width || panel.texturePixels?.width || null,
        height: panel.contentViewport?.height || panel.texturePixels?.height || null,
        render: null,
        quality: createXRPanelTextureQualitySummary(panel, {
          ...options,
          textureWidth: panel.contentViewport?.width || panel.texturePixels?.width || 0,
          textureHeight: panel.contentViewport?.height || panel.texturePixels?.height || 0,
          texturePixelRatio: policy.texturePixelRatio,
        }),
        redraw: false,
        renderCount: 0,
        redrawCount: 0,
        lastUploadMs: null,
      });
      return null;
    }
    let htmlTextureSupported = canUseThreeHtmlTexture(THREE, input);
    let canvas = resolveCanvasSource(input) || textures.get(panelId)?.canvas || (!htmlTextureSupported ? createTextureCanvas(documentRef, panel, {
      ...options,
      qualityPolicy: policy,
    }) : null);
    if (!canvas && !htmlTextureSupported) {
      records.set(panelId, {
        ok: false,
        panelId,
        reason: 'canvas-target-missing',
        stage: 'canvas-target',
        textureApplied: false,
        width: null,
        height: null,
      });
      return null;
    }
    if (canvas) resizeTextureCanvas(canvas, panel, { ...options, qualityPolicy: policy });
    let dirtyKey = textureDirtyKey(input, canvas, policy);
    let entry = textures.get(panelId);
    let redrawMode = input.redrawMode || policy.redrawMode || options.redrawMode || 'dirty';
    let textureWidth = canvas?.width || panel.contentViewport?.width || panel.texturePixels?.width || 0;
    let textureHeight = canvas?.height || panel.contentViewport?.height || panel.texturePixels?.height || 0;
    let quality = createXRPanelTextureQualitySummary(panel, {
      ...options,
      textureWidth,
      textureHeight,
      texturePixelRatio: policy.texturePixelRatio,
    });
    if (entry?.texture && entry.dirtyKey === dirtyKey && redrawMode !== 'always') {
      records.set(panelId, {
        ok: true,
        panelId,
        reason: null,
        stage: entry.stage === 'three-html-texture-ready'
          ? 'three-html-texture-reused'
          : 'three-canvas-texture-reused',
        textureApplied: true,
        width: textureWidth,
        height: textureHeight,
        render: entry.render || null,
        quality,
        redraw: false,
        renderCount: entry.renderCount || 1,
        redrawCount: entry.redrawCount || 1,
        lastUploadMs: entry.lastUploadMs ?? null,
      });
      return entry.texture;
    }
    let startedAt = nowMs(options);
    if (htmlTextureSupported) {
      let texture = entry?.texture || createThreeHtmlElementTexture(THREE, input.element, {
        name: `sn-xr-panel-${panelId}-html-texture`,
        ...(options.texture || {}),
      });
      let finishedAt = nowMs(options);
      if (!texture) {
        records.set(panelId, {
          ok: false,
          panelId,
          reason: 'three-html-texture-api-missing',
          stage: 'three-html-texture-api',
          textureApplied: false,
          width: textureWidth || null,
          height: textureHeight || null,
          render: null,
          quality,
          redraw: true,
          renderCount: entry?.renderCount || 0,
          redrawCount: entry?.redrawCount || 0,
          lastUploadMs: null,
        });
        return null;
      }
      let textureOptions = applyTextureQualityOptions(THREE, texture, options.texture || {});
      let renderCount = (entry?.renderCount || 0) + 1;
      let redrawCount = (entry?.redrawCount || 0) + 1;
      let lastUploadMs = Math.max(0, finishedAt - startedAt);
      textures.set(panelId, {
        canvas,
        texture,
        dirtyKey,
        render: { rendered: true, mode: 'three-html-texture' },
        renderCount,
        redrawCount,
        lastUploadMs,
        textureOptions,
        stage: 'three-html-texture-ready',
      });
      records.set(panelId, {
        ok: true,
        panelId,
        reason: null,
        stage: 'three-html-texture-ready',
        textureApplied: true,
        width: textureWidth || null,
        height: textureHeight || null,
        render: { rendered: true, mode: 'three-html-texture' },
        quality,
        redraw: true,
        renderCount,
        redrawCount,
        lastUploadMs,
        textureOptions,
      });
      return texture;
    }
    let renderResult = htmlCanvasRenderer.renderPanelPreview(panelId, canvas, {
      width: canvas.width,
      height: canvas.height,
      ...(options.renderOptions || {}),
    });
    let finishedAt = nowMs(options);
    if (!renderResult?.rendered) {
      records.set(panelId, {
        ok: false,
        panelId,
        reason: renderResult?.reason || 'html-canvas-preview-render-failed',
        stage: 'html-canvas-preview',
        textureApplied: false,
        width: canvas.width,
        height: canvas.height,
        render: renderResult || null,
        quality,
        redraw: true,
        renderCount: entry?.renderCount || 0,
        redrawCount: entry?.redrawCount || 0,
        lastUploadMs: null,
      });
      return null;
    }
    let texture = entry?.texture || createThreeCanvasTexture(THREE, canvas, {
      name: `sn-xr-panel-${panelId}-texture`,
      ...(options.texture || {}),
    });
    if (!texture) {
      records.set(panelId, {
        ok: false,
        panelId,
        reason: 'three-texture-api-missing',
        stage: 'three-texture-api',
        textureApplied: false,
        width: canvas.width,
        height: canvas.height,
        render: renderResult,
        quality,
        redraw: true,
        renderCount: entry?.renderCount || 0,
        redrawCount: entry?.redrawCount || 0,
        lastUploadMs: null,
      });
      return null;
    }
    let textureOptions = applyTextureQualityOptions(THREE, texture, options.texture || {});
    let renderCount = (entry?.renderCount || 0) + 1;
    let redrawCount = (entry?.redrawCount || 0) + 1;
    let lastUploadMs = Math.max(0, finishedAt - startedAt);
    textures.set(panelId, {
      canvas,
      texture,
      dirtyKey,
      render: renderResult,
      renderCount,
      redrawCount,
      lastUploadMs,
      textureOptions,
    });
    records.set(panelId, {
      ok: true,
      panelId,
      reason: null,
      stage: 'three-canvas-texture-ready',
      textureApplied: true,
      width: canvas.width,
      height: canvas.height,
      render: renderResult,
      quality,
      redraw: true,
      renderCount,
      redrawCount,
      lastUploadMs,
      textureOptions,
    });
    return texture;
  }

  return {
    resolve: resolveTexture,
    getState() {
      return {
        version: 'xr-three-html-canvas-texture-resolver-v1',
        panelCount: records.size,
        textureCount: textures.size,
        panelIds: [...records.keys()],
        records: [...records.values()].map((record) => ({
          ok: record.ok,
          panelId: record.panelId,
          reason: record.reason,
          stage: record.stage,
          textureApplied: record.textureApplied,
          width: record.width,
          height: record.height,
          mode: record.render?.mode || null,
          qualityStatus: record.quality?.status || null,
          qualityWarnings: record.quality?.warnings || [],
          qualityRecommendations: record.quality?.recommendations || [],
          texturePixels: record.quality?.texturePixels || (
            record.width && record.height ? { width: record.width, height: record.height } : null
          ),
          requiredPixels: record.quality?.requiredPixels || null,
          thresholds: record.quality?.thresholds || null,
          texturePixelRatio: record.quality?.policy?.texturePixelRatio ?? null,
          redrawMode: record.quality?.policy?.redrawMode || null,
          pixelsPerMeter: record.quality?.pixelsPerMeter?.min || null,
          redraw: record.redraw === true,
          renderCount: record.renderCount || 0,
          redrawCount: record.redrawCount || 0,
          lastUploadMs: record.lastUploadMs ?? null,
        })),
      };
    },
    dispose() {
      records.clear();
      textures.clear();
    },
  };
}

function summarizeTextureBridgeSupport(support = {}) {
  let diagnostics = support.diagnostics || {};
  return {
    supported: Boolean(support.supported || diagnostics.supported),
    preferredMode: support.preferredMode || diagnostics.mode || null,
    recommendation: diagnostics.recommendation || null,
    missing: Array.isArray(diagnostics.missing) ? [...diagnostics.missing] : [],
    blockingMissing: Array.isArray(diagnostics.blockingMissing) ? [...diagnostics.blockingMissing] : [],
  };
}

export function createXRThreePanelTextureBridge(options = {}) {
  let htmlCanvasRenderer = options.htmlCanvasRenderer || createXRHtmlCanvasRenderer({
    globalThis: options.globalThis,
    mode: options.mode,
  });
  let records = new Map();

  function getSupport() {
    return htmlCanvasRenderer.getSupport();
  }

  function applyPanelTexture(mesh, panel, applyOptions = {}) {
    let element = applyOptions.element || resolvePanelElement(panel, { ...options, ...applyOptions });
    if (!mesh || !panel?.id) {
      return { ok: false, reason: 'missing-panel-mesh', panelId: panel?.id || null };
    }
    if (!element) {
      let support = getSupport();
      let supportSummary = summarizeTextureBridgeSupport(support);
      let summary = createXRPanelTextureSourceSummary(panel, {
        prepared: false,
        panelId: panel.id,
        mode: support.preferredMode || 'unsupported',
        supported: false,
        reason: 'panel-element-missing',
      }, support, {
        allowMaterialFallback: !(applyOptions.requireTextureUpload ?? options.requireTextureUpload),
      });
      let record = {
        ok: false,
        panelId: panel.id,
        reason: 'panel-element-missing',
        stage: 'panel-element',
        strictRequired: Boolean(applyOptions.requireTextureUpload ?? options.requireTextureUpload),
        textureApplied: false,
        textureKind: null,
        support: supportSummary,
        summary,
      };
      records.set(panel.id, record);
      mesh.userData ||= {};
      mesh.userData.textureSource = summary;
      mesh.userData.textureBridge = {
        ok: record.ok,
        stage: record.stage,
        strictRequired: record.strictRequired,
        textureApplied: record.textureApplied,
        reason: record.reason,
      };
      return record;
    }

    let canvas = applyOptions.canvas || options.canvas || resolveCanvasSource({ element });
    let prepareResult = htmlCanvasRenderer.preparePanel(element, panel, {
      mode: applyOptions.mode || options.mode,
      canvas,
    });
    let support = getSupport();
    let supportSummary = summarizeTextureBridgeSupport(support);
    let strictRequired = Boolean(applyOptions.requireTextureUpload ?? options.requireTextureUpload);
    let summary = createXRPanelTextureSourceSummary(panel, prepareResult, support, {
      allowMaterialFallback: !strictRequired,
    });
    let textureQuality = createXRPanelTextureQualitySummary(panel, applyOptions.textureQuality || options.textureQuality || {});
    let texture = null;
    let textureReason = null;
    if (summary.source === 'html-in-canvas' && typeof options.textureResolver === 'function') {
      texture = options.textureResolver({
        mesh,
        panel,
        element,
        prepareResult,
        canvas: prepareResult.canvas || canvas,
        textureQuality: applyOptions.textureQuality || options.textureQuality || null,
        support,
        summary,
      }) || null;
      if (!texture) textureReason = 'texture-resolver-empty';
    } else if (summary.source === 'html-in-canvas') {
      textureReason = 'texture-resolver-missing';
    }

    if (texture && mesh.material) {
      mesh.material.map = texture;
      if ('color' in mesh.material && typeof mesh.material.color?.setHex === 'function') {
        mesh.material.color.setHex(0xffffff);
      }
      markMaterialUpdated(mesh.material);
    }

    let stage = classifyTextureBridgeStage(summary, texture, textureReason);
    let record = {
      ok: summary.source === 'html-in-canvas' && (!strictRequired || Boolean(texture)),
      panelId: panel.id,
      reason: textureReason || summary.reason,
      stage,
      strictRequired,
      textureApplied: Boolean(texture),
      textureKind: texture?.isTexture ? 'three-texture' : texture ? 'host-texture' : null,
      support: supportSummary,
      textureQuality,
      summary,
    };
    records.set(panel.id, record);
    mesh.userData ||= {};
    mesh.userData.textureSource = summary;
    mesh.userData.textureBridge = {
      ok: record.ok,
      stage: record.stage,
      strictRequired: record.strictRequired,
      textureApplied: record.textureApplied,
      reason: record.reason,
    };
    return record;
  }

  return {
    applyPanelTexture,
    getSupport,
    dispose() {
      records.clear();
      options.textureResolverDispose?.();
    },
    getState() {
      return {
        version: 'xr-three-panel-texture-bridge-v1',
        panelCount: records.size,
        panelIds: [...records.keys()],
        records: [...records.values()].map((record) => ({
          ok: record.ok,
          panelId: record.panelId,
          reason: record.reason,
          stage: record.stage,
          strictRequired: record.strictRequired,
          textureApplied: record.textureApplied,
          source: record.summary?.source || null,
          mode: record.summary?.mode || null,
          support: record.support || null,
          textureQuality: record.textureQuality || null,
        })),
      };
    },
  };
}

function createPanelMesh(THREE, panel, options = {}) {
  let size = Array.isArray(panel.size) ? panel.size : [0.8, 0.45];
  let geometry = new THREE.PlaneGeometry(Number(size[0] || 0.8), Number(size[1] || 0.45));
  let mesh = new THREE.Mesh(geometry, createMaterial(THREE, panel, options));
  applyVector(mesh.position, Array.isArray(panel.position) ? panel.position : [0, 1.35, -1.8]);
  applyRotation(mesh.rotation, Array.isArray(panel.rotation) ? panel.rotation : [0, 0, 0]);
  mesh.userData.panelId = panel.id || null;
  mesh.userData.panel = panel;
  mesh.userData.baseSize = [Number(size[0] || 0.8), Number(size[1] || 0.45)];
  mesh.userData.xrSize = [...mesh.userData.baseSize];
  mesh.userData.panelFrame = createXRPanelFrame(panel, options.panelFrame || {});
  mesh.userData.panelFrameVisuals = buildPanelFrameVisuals(THREE, panel, mesh, options.panelFrameVisuals || {});
  mesh.userData.baseColor = options.colorResolver?.(panel) ||
    panel.material?.threeColor ||
    panel.material?.backgroundColor ||
    panel.color ||
    null;
  return mesh;
}

function createRootGroup(THREE, scene, transform) {
  if (typeof THREE?.Group !== 'function') return null;
  let group = new THREE.Group();
  group.name = 'sn-xr-scene-root';
  group.userData ||= {};
  group.userData.xrSceneRoot = true;
  group.userData.xrSceneRootTransform = transform;
  applyVector(group.position, transform.position);
  applyRotation(group.rotation, transform.rotation);
  scene.add?.(group);
  return group;
}

export function createXRThreePanelSceneAdapter(options = {}) {
  let THREE = options.THREE;
  let check = assertThree(THREE);
  let scene = check.ok ? new THREE.Scene() : null;
  let panels = new Map();
  let textureBridge = options.textureBridge || null;
  let textureRecords = new Map();
  let rootGroup = null;
  let rootTransform = null;
  let activeXRScene = null;
  let activeSetOptions = {};

  function applyRootTransform(transform) {
    rootTransform = transform;
    if (rootGroup) {
      rootGroup.userData ||= {};
      rootGroup.userData.xrSceneRootTransform = transform;
      applyVector(rootGroup.position, transform.position);
      applyRotation(rootGroup.rotation, transform.rotation);
    }
    return rootTransform;
  }

  function setScene(xrScene, setOptions = {}) {
    if (!check.ok) {
      return { ok: false, reason: check.reason, missing: check.missing, panelCount: 0 };
    }
    if (rootGroup) {
      scene.remove?.(rootGroup);
    } else {
      for (let mesh of panels.values()) {
        scene.remove?.(mesh);
      }
    }
    panels.clear();
    textureRecords.clear();
    activeXRScene = xrScene || null;
    activeSetOptions = { ...setOptions };
    rootTransform = createXRSceneRootTransform(xrScene, {
      mode: setOptions.mode,
      referenceSpaceType: setOptions.referenceSpaceType,
      viewerPose: setOptions.viewerPose,
      policy: setOptions.placementPolicy || options.placementPolicy,
    });
    rootGroup = createRootGroup(THREE, scene, rootTransform);
    let sceneTarget = rootGroup || scene;
    let diagnosticPanelIds = [];
    let hiddenPanelIds = [];
    let bridge = setOptions.textureBridge || textureBridge;
    bridge?.dispose?.();
    for (let panel of xrScene?.panels || []) {
      let mesh = createPanelMesh(THREE, panel, { ...options, ...setOptions });
      if (bridge?.applyPanelTexture) {
        let texture = bridge.applyPanelTexture(mesh, panel, setOptions.textureOptions || {});
        textureRecords.set(panel.id, texture);
        let diagnoseStrictFailure = Boolean(setOptions.hideStrictTextureFailures ?? options.hideStrictTextureFailures);
        if (diagnoseStrictFailure && texture?.strictRequired && !texture.ok) {
          applyStrictTextureDiagnosticMaterial(mesh, texture, { ...options, ...setOptions });
          diagnosticPanelIds.push(panel.id);
          hiddenPanelIds.push(panel.id);
        }
      }
      sceneTarget.add?.(mesh);
      panels.set(panel.id, mesh);
    }
    return {
      ok: true,
      scene,
      rootGroup,
      rootTransform,
      panelCount: panels.size,
      renderedPanelCount: [...panels.values()].filter((mesh) => mesh.visible !== false).length,
      hiddenPanelCount: hiddenPanelIds.length,
      hiddenPanelIds,
      diagnosticPanelCount: diagnosticPanelIds.length,
      diagnosticPanelIds,
      panelIds: [...panels.keys()],
      textureSources: [...textureRecords.values()],
    };
  }

  return {
    setScene,
    applyViewerPose(viewerPose, poseOptions = {}) {
      if (!check.ok) return { ok: false, reason: check.reason, missing: check.missing };
      let snapshot = createXRViewerPoseSnapshot(viewerPose, poseOptions);
      if (!snapshot.position && !snapshot.rotation) {
        return { ok: false, reason: 'missing-viewer-pose', snapshot };
      }
      let transform = createXRSceneRootTransform(activeXRScene || {}, {
        ...activeSetOptions,
        ...poseOptions,
        viewerPose: snapshot,
      });
      applyRootTransform(transform);
      return {
        ok: true,
        version: 'xr-three-viewer-pose-root-transform-v1',
        snapshot,
        rootTransform,
      };
    },
    getScene() {
      return scene;
    },
    getPanelMesh(panelId) {
      return panels.get(panelId) || null;
    },
    listPanelMeshes() {
      return [...panels.values()];
    },
    getState() {
      let meshList = [...panels.values()];
      let materialDiagnostics = summarizePanelMaterials(meshList);
      return {
        ok: check.ok,
        reason: check.ok ? null : check.reason,
        missing: check.missing,
        panelCount: panels.size,
        rootTransform,
        renderedPanelCount: meshList.filter((mesh) => mesh.visible !== false).length,
        hiddenPanelCount: meshList.filter((mesh) => mesh.visible === false).length,
        hiddenPanelIds: meshList
          .filter((mesh) => mesh.visible === false)
          .map((mesh) => mesh.userData?.panelId)
          .filter(Boolean),
        diagnosticPanelCount: materialDiagnostics.strictDiagnosticCount,
        diagnosticPanelIds: materialDiagnostics.strictDiagnosticPanelIds,
        materialDiagnostics,
        panelIds: [...panels.keys()],
        panelFrameVisualCount: meshList.reduce((count, mesh) => (
          count + Number(mesh.userData?.panelFrameVisuals?.objectCount || 0)
        ), 0),
        panelFrameVisuals: [...panels.values()].map((mesh) => ({
          ok: Boolean(mesh.userData?.panelFrameVisuals?.ok),
          panelId: mesh.userData?.panelId || null,
          reason: mesh.userData?.panelFrameVisuals?.reason || null,
          objectCount: Number(mesh.userData?.panelFrameVisuals?.objectCount || 0),
          zones: mesh.userData?.panelFrameVisuals?.zones || [],
        })),
        textureSources: [...textureRecords.values()].map((record) => ({
          panelId: record.panelId,
          ok: record.ok,
          reason: record.reason,
          stage: record.stage,
          strictRequired: record.strictRequired,
        textureApplied: record.textureApplied,
        source: record.summary?.source || null,
        mode: record.summary?.mode || null,
        textureQuality: record.textureQuality || null,
        qualityStatus: record.textureQuality?.status || null,
        qualityWarnings: record.textureQuality?.warnings || [],
        qualityRecommendations: record.textureQuality?.recommendations || [],
        texturePixels: record.textureQuality?.texturePixels || null,
        requiredPixels: record.textureQuality?.requiredPixels || null,
        pixelsPerMeter: record.textureQuality?.pixelsPerMeter?.min || null,
        hidden: panels.get(record.panelId)?.visible === false ||
          panels.get(record.panelId)?.userData?.strictTextureHidden === true,
        diagnostic: Boolean(panels.get(record.panelId)?.userData?.strictTextureDiagnostic),
        diagnosticReason: panels.get(record.panelId)?.userData?.strictTextureDiagnosticReason || null,
        support: record.support || null,
      })),
    };
  },
  };
}

function setRayFromController(THREE, raycaster, controller) {
  if (hasFn(raycaster, 'setFromXRController')) {
    raycaster.setFromXRController(controller);
    return { ok: true, source: 'setFromXRController' };
  }
  if (!hasFn(controller, 'getWorldPosition') || !hasFn(controller, 'getWorldQuaternion')) {
    return { ok: false, reason: 'missing-controller-transform' };
  }
  let origin = controller.getWorldPosition(new THREE.Vector3());
  let direction = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
  raycaster.set(origin, direction);
  return { ok: true, source: 'world-transform' };
}

function vectorData(vector) {
  if (!vector) return null;
  return {
    x: Number(vector.x || 0),
    y: Number(vector.y || 0),
    z: Number(vector.z || 0),
  };
}

function framePointFromHit(hit) {
  if (hit?.uv) {
    return {
      x: Number(hit.uv.x || 0),
      y: 1 - Number(hit.uv.y || 0),
    };
  }
  return { x: 0.5, y: 0.5 };
}

function resolveHitFrameTarget(hit, options = {}) {
  let mesh = hit?.object || hit;
  let frame = mesh?.userData?.panelFrame;
  if (!frame) return null;
  return hitTestXRPanelFrame(frame, framePointFromHit(hit), options);
}

function isXRFrameDragTarget(frameTarget) {
  return frameTarget?.operation === 'move' || frameTarget?.operation === 'resize';
}

function distanceBetween(a, b) {
  if (!a || !b) return 0;
  let dx = Number(a.x || 0) - Number(b.x || 0);
  let dy = Number(a.y || 0) - Number(b.y || 0);
  let dz = Number(a.z || 0) - Number(b.z || 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function vectorBetween(a, b) {
  return {
    x: Number(a?.x || 0) - Number(b?.x || 0),
    y: Number(a?.y || 0) - Number(b?.y || 0),
    z: Number(a?.z || 0) - Number(b?.z || 0),
  };
}

function vectorLength(vector) {
  return Math.sqrt(
    Number(vector?.x || 0) ** 2 +
    Number(vector?.y || 0) ** 2 +
    Number(vector?.z || 0) ** 2
  );
}

function vectorDot(a, b) {
  return Number(a?.x || 0) * Number(b?.x || 0) +
    Number(a?.y || 0) * Number(b?.y || 0) +
    Number(a?.z || 0) * Number(b?.z || 0);
}

function axisVector(THREE, mesh, values) {
  let vector = THREE?.Vector3 ? new THREE.Vector3(...values) : { x: values[0], y: values[1], z: values[2] };
  if (mesh?.quaternion && typeof vector.applyQuaternion === 'function') {
    vector.applyQuaternion(mesh.quaternion);
  }
  if (typeof vector.normalize === 'function') {
    vector.normalize();
  }
  return vector;
}

function scaleVector(vector, scalar) {
  return {
    x: Number(vector?.x || 0) * scalar,
    y: Number(vector?.y || 0) * scalar,
    z: Number(vector?.z || 0) * scalar,
  };
}

function addVector(target, vector) {
  if (!target || !vector) return;
  if (typeof target.add === 'function') {
    target.add(vector);
    return;
  }
  target.x = Number(target.x || 0) + Number(vector.x || 0);
  target.y = Number(target.y || 0) + Number(vector.y || 0);
  target.z = Number(target.z || 0) + Number(vector.z || 0);
}

function readPanelSize(mesh) {
  let explicit = mesh?.userData?.xrSize || mesh?.userData?.panel?.size;
  if (Array.isArray(explicit)) {
    return [
      Math.max(0.05, Number(explicit[0] || 0.8)),
      Math.max(0.05, Number(explicit[1] || 0.45)),
    ];
  }
  let parameters = mesh?.geometry?.parameters || {};
  return [
    Math.max(0.05, Number(parameters.width || 0.8) * Number(mesh?.scale?.x || 1)),
    Math.max(0.05, Number(parameters.height || 0.45) * Number(mesh?.scale?.y || 1)),
  ];
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
  let parameters = mesh.geometry?.parameters || {};
  let baseWidth = Number(mesh.userData.baseSize?.[0] || parameters.width || next[0]);
  let baseHeight = Number(mesh.userData.baseSize?.[1] || parameters.height || next[1]);
  if (mesh.scale && Number.isFinite(baseWidth) && Number.isFinite(baseHeight) && baseWidth > 0 && baseHeight > 0) {
    if (typeof mesh.scale.set === 'function') {
      mesh.scale.set(next[0] / baseWidth, next[1] / baseHeight, Number(mesh.scale.z || 1));
    } else {
      mesh.scale.x = next[0] / baseWidth;
      mesh.scale.y = next[1] / baseHeight;
      mesh.scale.z = Number(mesh.scale.z || 1);
    }
  }
  mesh.userData.updatePanelFrameVisuals?.();
}

function resizePanelFromDrag(THREE, dragState, point, options = {}) {
  let frameTarget = dragState?.frameTarget || {};
  if (frameTarget.operation !== 'resize') {
    return null;
  }
  let handle = String(frameTarget.handle || '');
  let minWidth = Number(options.minWidth ?? options.minPanelWidth ?? 0.24);
  let minHeight = Number(options.minHeight ?? options.minPanelHeight ?? 0.16);
  let maxWidth = Number(options.maxWidth ?? options.maxPanelWidth ?? 3.2);
  let maxHeight = Number(options.maxHeight ?? options.maxPanelHeight ?? 2.4);
  let startSize = Array.isArray(dragState.startSize) ? dragState.startSize : readPanelSize(dragState.mesh);
  let delta = vectorBetween(point, dragState.startIntersection || point);
  let xAxis = axisVector(THREE, dragState.mesh, [1, 0, 0]);
  let yAxis = axisVector(THREE, dragState.mesh, [0, 1, 0]);
  let xDelta = vectorDot(delta, xAxis);
  let yDelta = vectorDot(delta, yAxis);
  let nextWidth = startSize[0];
  let nextHeight = startSize[1];
  let centerShift = { x: 0, y: 0, z: 0 };
  let east = /east/i.test(handle);
  let west = /west/i.test(handle);
  let north = /north/i.test(handle);
  let south = /south/i.test(handle);

  if (east) {
    nextWidth += xDelta;
    centerShift = scaleVector(xAxis, xDelta / 2);
  }
  if (west) {
    nextWidth -= xDelta;
    centerShift = scaleVector(xAxis, xDelta / 2);
  }
  if (north) {
    nextHeight += yDelta;
    centerShift = {
      x: centerShift.x + scaleVector(yAxis, yDelta / 2).x,
      y: centerShift.y + scaleVector(yAxis, yDelta / 2).y,
      z: centerShift.z + scaleVector(yAxis, yDelta / 2).z,
    };
  }
  if (south) {
    nextHeight -= yDelta;
    centerShift = {
      x: centerShift.x + scaleVector(yAxis, yDelta / 2).x,
      y: centerShift.y + scaleVector(yAxis, yDelta / 2).y,
      z: centerShift.z + scaleVector(yAxis, yDelta / 2).z,
    };
  }

  nextWidth = Math.max(minWidth, Math.min(maxWidth, nextWidth));
  nextHeight = Math.max(minHeight, Math.min(maxHeight, nextHeight));
  let size = [nextWidth, nextHeight];
  applyPanelSize(dragState.mesh, size);
  if (dragState.startPosition?.clone && dragState.mesh?.position?.copy) {
    dragState.mesh.position.copy(dragState.startPosition.clone());
  }
  addVector(dragState.mesh?.position, centerShift);
  return {
    operation: 'resize',
    handle,
    size,
    delta: { x: xDelta, y: yDelta },
    centerShift,
  };
}

function normalizeDragResponse(options = {}) {
  let smoothing = Number(options.dragSmoothing ?? options.smoothing ?? 0.72);
  let deadzone = Number(options.dragDeadzone ?? options.deadzone ?? 0.0015);
  let maxStep = Number(options.maxDragStep ?? options.maxStep ?? 0.18);
  return {
    smoothing: Number.isFinite(smoothing) ? Math.max(0.05, Math.min(1, smoothing)) : 0.72,
    deadzone: Number.isFinite(deadzone) ? Math.max(0, deadzone) : 0.0015,
    maxStep: Number.isFinite(maxStep) ? Math.max(0.01, maxStep) : 0.18,
  };
}

function filteredDragPosition(previousPosition, rawPosition, response) {
  let rawDelta = vectorBetween(rawPosition, previousPosition);
  let rawDistance = vectorLength(rawDelta);
  let next = previousPosition.clone?.() || { ...previousPosition };
  let clamped = false;
  let settled = rawDistance <= response.deadzone;

  if (!settled) {
    let appliedDelta = {
      x: rawDelta.x * response.smoothing,
      y: rawDelta.y * response.smoothing,
      z: rawDelta.z * response.smoothing,
    };
    let appliedDistance = vectorLength(appliedDelta);
    if (appliedDistance > response.maxStep) {
      let scale = response.maxStep / appliedDistance;
      appliedDelta.x *= scale;
      appliedDelta.y *= scale;
      appliedDelta.z *= scale;
      clamped = true;
    }
    next.x = Number(previousPosition.x || 0) + appliedDelta.x;
    next.y = Number(previousPosition.y || 0) + appliedDelta.y;
    next.z = Number(previousPosition.z || 0) + appliedDelta.z;
  }

  return {
    position: next,
    diagnostics: {
      smoothing: response.smoothing,
      deadzone: response.deadzone,
      maxStep: response.maxStep,
      rawDelta,
      rawDistance,
      appliedDelta: vectorBetween(next, previousPosition),
      appliedDistance: distanceBetween(next, previousPosition),
      clamped,
      settled,
    },
  };
}

export function createXRThreeControllerRayAdapter(options = {}) {
  let THREE = options.THREE;
  let raycaster = options.raycaster || (THREE?.Raycaster ? new THREE.Raycaster() : null);
  let dragResponse = normalizeDragResponse(options.dragResponse || options);
  let dragPlane = THREE?.Plane ? new THREE.Plane() : null;
  let intersection = THREE?.Vector3 ? new THREE.Vector3() : null;
  let normal = THREE?.Vector3 ? new THREE.Vector3() : null;
  let cameraPosition = THREE?.Vector3 ? new THREE.Vector3() : null;
  let dragging = null;
  let counters = {
    hits: 0,
    misses: 0,
    dragStarts: 0,
    dragUpdates: 0,
    dragMisses: 0,
  };
  let diagnostics = {
    version: 'xr-three-controller-diagnostics-v1',
    raySource: null,
    lastHit: null,
    lastMissReason: null,
    drag: null,
  };

  function getHits(controller, meshes = []) {
    if (!THREE || !raycaster) return [];
    let ray = setRayFromController(THREE, raycaster, controller);
    diagnostics.raySource = ray.source || null;
    if (!ray.ok) {
      counters.misses += 1;
      diagnostics.lastMissReason = ray.reason || 'ray-unavailable';
      diagnostics.lastHit = null;
      return [];
    }
    let hits = raycaster.intersectObjects(meshes, false).map((hit) => {
      let frameTarget = resolveHitFrameTarget(hit, options.panelFrameHitTest || {});
      if (frameTarget) {
        hit.frameTarget = frameTarget;
        hit.object.userData ||= {};
        hit.object.userData.lastFrameTarget = frameTarget;
      }
      return hit;
    });
    if (hits.length) {
      counters.hits += 1;
      diagnostics.lastMissReason = null;
      diagnostics.lastHit = {
        panelId: hits[0]?.object?.userData?.panelId || null,
        distance: Number(hits[0]?.distance || 0),
        point: vectorData(hits[0]?.point),
        frameTarget: hits[0]?.frameTarget || null,
      };
    } else {
      counters.misses += 1;
      diagnostics.lastMissReason = 'no-panel-hit';
      diagnostics.lastHit = null;
    }
    return hits;
  }

  function beginDrag(controller, meshOrHit, camera) {
    let hit = meshOrHit?.object ? meshOrHit : null;
    let mesh = hit?.object || meshOrHit;
    if (!THREE || !raycaster || !dragPlane || !intersection || !normal || !mesh) {
      return { ok: false, reason: 'missing-drag-dependency' };
    }
    let ray = setRayFromController(THREE, raycaster, controller);
    diagnostics.raySource = ray.source || null;
    if (!ray.ok) {
      counters.dragMisses += 1;
      diagnostics.lastMissReason = ray.reason || 'ray-unavailable';
      return ray;
    }
    camera?.getWorldPosition?.(cameraPosition);
    normal.copy(cameraPosition).sub(mesh.position).normalize();
    dragPlane.setFromNormalAndCoplanarPoint(normal, mesh.position);
    if (!raycaster.ray.intersectPlane(dragPlane, intersection)) {
      counters.dragMisses += 1;
      diagnostics.lastMissReason = 'ray-plane-miss';
      return { ok: false, reason: 'ray-plane-miss' };
    }
    dragging = {
      mesh,
      controller,
      frameTarget: hit?.frameTarget || mesh.userData?.lastFrameTarget || null,
      plane: dragPlane.clone(),
      offset: mesh.position.clone().sub(intersection),
      rotation: mesh.quaternion?.clone?.() || null,
      startIntersection: intersection.clone?.() || null,
      startPosition: mesh.position.clone?.() || null,
      startSize: readPanelSize(mesh),
      lastPosition: mesh.position.clone?.() || null,
      lastRawPosition: mesh.position.clone?.() || null,
    };
    counters.dragStarts += 1;
    diagnostics.lastMissReason = null;
    diagnostics.drag = {
      active: true,
      panelId: mesh.userData?.panelId || null,
      frameTarget: hit?.frameTarget || mesh.userData?.lastFrameTarget || null,
      model: 'controller-ray-plane',
      position: vectorData(mesh.position),
      rotation: vectorData(mesh.rotation),
      size: readPanelSize(mesh),
      planeNormal: vectorData(normal),
      planePoint: vectorData(mesh.position),
      intersection: vectorData(intersection),
      delta: { x: 0, y: 0, z: 0, distance: 0 },
      response: {
        smoothing: dragResponse.smoothing,
        deadzone: dragResponse.deadzone,
        maxStep: dragResponse.maxStep,
      },
    };
    return {
      ok: true,
      panelId: mesh.userData?.panelId || null,
      frameTarget: hit?.frameTarget || mesh.userData?.lastFrameTarget || null,
      dragModel: 'controller-ray-plane',
    };
  }

  function updateDrag(controller = dragging?.controller) {
    if (!dragging || !controller || !raycaster || !intersection) return { ok: false, reason: 'not-dragging' };
    let ray = setRayFromController(THREE, raycaster, controller);
    diagnostics.raySource = ray.source || null;
    if (!ray.ok) {
      counters.dragMisses += 1;
      diagnostics.lastMissReason = ray.reason || 'ray-unavailable';
      return ray;
    }
    if (!raycaster.ray.intersectPlane(dragging.plane, intersection)) {
      counters.dragMisses += 1;
      diagnostics.lastMissReason = 'ray-plane-miss';
      return { ok: false, reason: 'ray-plane-miss' };
    }
    let previousPosition = dragging.mesh.position.clone?.() || dragging.lastPosition;
    let rawPosition = intersection.clone?.() || new THREE.Vector3(intersection.x, intersection.y, intersection.z);
    let resize = resizePanelFromDrag(THREE, dragging, rawPosition, options.resize || options);
    let filtered = null;
    if (!resize) {
      rawPosition.add(dragging.offset);
      filtered = filteredDragPosition(previousPosition, rawPosition, dragResponse);
      dragging.mesh.position.copy(filtered.position);
    }
    if (dragging.rotation && dragging.mesh.quaternion?.copy) {
      dragging.mesh.quaternion.copy(dragging.rotation);
    }
    counters.dragUpdates += 1;
    diagnostics.lastMissReason = null;
    diagnostics.drag = {
      active: true,
      panelId: dragging.mesh.userData?.panelId || null,
      frameTarget: dragging.frameTarget || null,
      model: 'controller-ray-plane',
      position: vectorData(dragging.mesh.position),
      rotation: vectorData(dragging.mesh.rotation),
      size: readPanelSize(dragging.mesh),
      resize,
      planeNormal: vectorData(dragging.plane.normal),
      planePoint: vectorData(dragging.plane.point),
      intersection: vectorData(intersection),
      delta: {
        x: Number(dragging.mesh.position.x || 0) - Number(previousPosition?.x || 0),
        y: Number(dragging.mesh.position.y || 0) - Number(previousPosition?.y || 0),
        z: Number(dragging.mesh.position.z || 0) - Number(previousPosition?.z || 0),
        distance: distanceBetween(dragging.mesh.position, previousPosition),
      },
      rawPosition: vectorData(rawPosition),
      response: resize ? {
        operation: 'resize',
        handle: resize.handle,
        delta: resize.delta,
        size: resize.size,
      } : filtered.diagnostics,
    };
    dragging.lastPosition = dragging.mesh.position.clone?.() || null;
    dragging.lastRawPosition = rawPosition.clone?.() || null;
    return {
      ok: true,
      panelId: dragging.mesh.userData?.panelId || null,
      frameTarget: dragging.frameTarget || null,
      dragModel: 'controller-ray-plane',
    };
  }

  function endDrag() {
    let panelId = dragging?.mesh?.userData?.panelId || null;
    let pose = diagnostics.drag
      ? {
        position: diagnostics.drag.position || null,
        rotation: diagnostics.drag.rotation || null,
        size: diagnostics.drag.size || null,
      }
      : null;
    dragging = null;
    if (diagnostics.drag) diagnostics.drag = { ...diagnostics.drag, active: false };
    return { ok: true, panelId, frameTarget: diagnostics.drag?.frameTarget || null, pose };
  }

  return {
    getHits,
    beginDrag,
    updateDrag,
    endDrag,
    getState() {
      return {
        dragging: Boolean(dragging),
        panelId: dragging?.mesh?.userData?.panelId || null,
        dragModel: 'controller-ray-plane',
        diagnostics: this.getDiagnostics(),
      };
    },
    getDiagnostics() {
      return {
        ...diagnostics,
        counters: { ...counters },
      };
    },
  };
}

export function createXRThreeWebXRAdapter(options = {}) {
  let THREE = options.THREE;
  let check = assertThree(THREE);
  let sceneAdapter = createXRThreePanelSceneAdapter(options);
  let rayAdapter = createXRThreeControllerRayAdapter(options);
  let state = {
    renderer: null,
    camera: null,
    scene: sceneAdapter.getScene(),
    panelCount: 0,
    session: null,
  };

  function createRenderer(rendererOptions = {}) {
    if (!check.ok) return { ok: false, reason: check.reason, missing: check.missing };
    let renderer;
    try {
      renderer = rendererOptions.renderer || new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        ...(rendererOptions.webgl || {}),
      });
    } catch (error) {
      return {
        ok: false,
        reason: 'webgl-renderer-create-failed',
        error: error?.name || 'Error',
        message: error?.message || '',
      };
    }
    if (renderer.xr) renderer.xr.enabled = true;
    state.renderer = renderer;
    return { ok: true, renderer };
  }

  function createCamera(cameraOptions = {}) {
    if (!check.ok) return { ok: false, reason: check.reason, missing: check.missing };
    let camera = cameraOptions.camera || new THREE.PerspectiveCamera(
      Number(cameraOptions.fov || 70),
      Number(cameraOptions.aspect || 1),
      Number(cameraOptions.near || 0.01),
      Number(cameraOptions.far || 100),
    );
    applyVector(camera.position, cameraOptions.position || [0, 1.6, 2]);
    state.camera = camera;
    return { ok: true, camera };
  }

  function setScene(xrScene, setOptions = {}) {
    let result = sceneAdapter.setScene(xrScene, setOptions);
    state.scene = sceneAdapter.getScene();
    state.panelCount = result.panelCount || 0;
    return result;
  }

  async function setSession(session, sessionOptions = {}) {
    if (!state.renderer?.xr?.setSession) {
      return { ok: false, reason: 'missing-three-webxr-manager' };
    }
    if (sessionOptions.referenceSpaceType && hasFn(state.renderer.xr, 'setReferenceSpaceType')) {
      state.renderer.xr.setReferenceSpaceType(sessionOptions.referenceSpaceType);
    }
    await state.renderer.xr.setSession(session);
    state.session = session;
    let referenceSpace = state.renderer.xr.getReferenceSpace?.() || sessionOptions.referenceSpace || null;
    return { ok: true, session, referenceSpace };
  }

  return {
    ...XR_THREE_WEBXR_ADAPTER,
    createRenderer,
    createCamera,
    setScene,
    setSession,
    applyViewerPose: sceneAdapter.applyViewerPose,
    getPanelMesh: sceneAdapter.getPanelMesh,
    listPanelMeshes: sceneAdapter.listPanelMeshes,
    createControllerRayVisual(controller, visualOptions = {}) {
      let visual = buildControllerRayVisual(THREE, visualOptions);
      if (visual.ok && controller?.add) {
        controller.add(visual.object);
      }
      return visual;
    },
    createPanelHitReticleVisual(scene, visualOptions = {}) {
      let visual = buildPanelHitReticleVisual(THREE, visualOptions);
      if (visual.ok && scene?.add) {
        scene.add(visual.object);
      }
      return visual;
    },
    updatePanelHitReticleVisual,
    controllerRays: rayAdapter,
    getState() {
      let sceneState = sceneAdapter.getState();
      return {
        ...sceneState,
        renderer: Boolean(state.renderer),
        camera: Boolean(state.camera),
        scene: Boolean(state.scene),
        panelCount: state.panelCount || sceneState.panelCount,
        session: Boolean(state.session),
        controller: rayAdapter.getState(),
      };
    },
    getDiagnostics() {
      return {
        ...this.getState(),
        controller: rayAdapter.getDiagnostics(),
      };
    },
  };
}

function summarizeThreeRenderer(renderer = null) {
  let canvas = renderer?.domElement || null;
  let gl = renderer?.getContext?.() || null;
  let contextAttributes = gl?.getContextAttributes?.() || null;
  return {
    version: 'xr-three-renderer-diagnostics-v1',
    present: Boolean(renderer),
    xrEnabled: renderer?.xr?.enabled === true,
    outputColorSpace: renderer?.outputColorSpace || renderer?.outputEncoding || null,
    canvas: canvas ? {
      width: Number.isFinite(Number(canvas.width)) ? Number(canvas.width) : null,
      height: Number.isFinite(Number(canvas.height)) ? Number(canvas.height) : null,
      clientWidth: Number.isFinite(Number(canvas.clientWidth)) ? Number(canvas.clientWidth) : null,
      clientHeight: Number.isFinite(Number(canvas.clientHeight)) ? Number(canvas.clientHeight) : null,
    } : null,
    contextAttributes: contextAttributes ? {
      alpha: contextAttributes.alpha == null ? null : Boolean(contextAttributes.alpha),
      premultipliedAlpha: contextAttributes.premultipliedAlpha == null ? null : Boolean(contextAttributes.premultipliedAlpha),
      preserveDrawingBuffer: contextAttributes.preserveDrawingBuffer == null ? null : Boolean(contextAttributes.preserveDrawingBuffer),
      antialias: contextAttributes.antialias == null ? null : Boolean(contextAttributes.antialias),
      depth: contextAttributes.depth == null ? null : Boolean(contextAttributes.depth),
      stencil: contextAttributes.stencil == null ? null : Boolean(contextAttributes.stencil),
    } : null,
  };
}

export function createXRThreeRenderHost(options = {}) {
  let THREE = options.THREE;
  let adapter = options.adapter || createXRThreeWebXRAdapter(options);
  let renderer = options.renderer || null;
  let camera = options.camera || null;
  let scene = null;
  let diagnostics = {
    version: 'xr-three-render-host-v1',
    renderer: false,
    camera: false,
    scene: false,
    decorated: false,
    loopRunning: false,
    frames: 0,
    width: 0,
    height: 0,
    aspect: 1,
    pixelRatio: 1,
    lastError: null,
  };

  function decorateScene(targetScene, decorateOptions = {}) {
    if (!targetScene || targetScene.userData?.snSpatialDecorated) return false;
    targetScene.userData ||= {};
    targetScene.userData.snSpatialDecorated = true;
    if (THREE?.Color) {
      targetScene.background = new THREE.Color(decorateOptions.background ?? 0x11151d);
    }
    if (THREE?.HemisphereLight && hasFn(targetScene, 'add')) {
      targetScene.add(new THREE.HemisphereLight(
        decorateOptions.skyColor ?? 0xffffff,
        decorateOptions.groundColor ?? 0x182030,
        Number(decorateOptions.intensity ?? 1.2),
      ));
    }
    diagnostics.decorated = true;
    return true;
  }

  function ensureRenderer(hostOptions = {}) {
    if (renderer) return { ok: true, renderer };
    let result = adapter.createRenderer({
      webgl: {
        antialias: true,
        alpha: true,
        ...(hostOptions.webgl || options.webgl || {}),
      },
      renderer: hostOptions.renderer,
    });
    if (!result.ok) {
      diagnostics.lastError = result.reason || 'renderer-create-failed';
      return result;
    }
    renderer = result.renderer;
    diagnostics.renderer = true;
    let className = hostOptions.className || options.className || null;
    if (className && renderer.domElement) renderer.domElement.className = className;
    let parent = hostOptions.hostElement || options.hostElement;
    if (parent && renderer.domElement && renderer.domElement.parentNode !== parent) {
      parent.append?.(renderer.domElement);
    }
    return { ok: true, renderer };
  }

  function ensureCamera(hostOptions = {}, bounds = {}) {
    let aspect = Math.max(0.1, Number(bounds.width || 1280) / Math.max(1, Number(bounds.height || 720)));
    if (!camera) {
      let result = adapter.createCamera({
        aspect,
        position: hostOptions.cameraPosition || options.cameraPosition || [0, 1.6, 2],
        ...(hostOptions.camera || options.camera || {}),
      });
      if (!result.ok) {
        diagnostics.lastError = result.reason || 'camera-create-failed';
        return result;
      }
      camera = result.camera;
    } else {
      camera.aspect = aspect;
      camera.updateProjectionMatrix?.();
    }
    diagnostics.camera = true;
    diagnostics.aspect = aspect;
    return { ok: true, camera };
  }

  function ensureTarget(hostOptions = {}) {
    let rendererResult = ensureRenderer(hostOptions);
    if (!rendererResult.ok) return rendererResult;

    let bounds = readBounds(hostOptions.bounds || hostOptions.stageElement || options.stageElement, hostOptions.fallbackBounds);
    let pixelRatio = clampPixelRatio(hostOptions.pixelRatio ?? options.pixelRatio ?? options.globalThis?.devicePixelRatio ?? 1, hostOptions.maxPixelRatio ?? options.maxPixelRatio);
    rendererResult.renderer.setPixelRatio?.(pixelRatio);
    rendererResult.renderer.setSize?.(bounds.width, bounds.height, false);

    let cameraResult = ensureCamera(hostOptions, bounds);
    if (!cameraResult.ok) return cameraResult;

    let sceneResult = adapter.setScene(hostOptions.scene || options.scene || null, hostOptions.sceneOptions || {});
    if (!sceneResult.ok) {
      diagnostics.lastError = sceneResult.reason || 'scene-create-failed';
      return sceneResult;
    }
    scene = sceneResult.scene;
    decorateScene(scene, hostOptions.decoration || options.decoration || {});
    diagnostics = {
      ...diagnostics,
      renderer: true,
      camera: true,
      scene: Boolean(scene),
      width: bounds.width,
      height: bounds.height,
      aspect: Math.max(0.1, bounds.width / Math.max(1, bounds.height)),
      pixelRatio,
      lastError: null,
    };
    return {
      ok: true,
      renderer: rendererResult.renderer,
      camera: cameraResult.camera,
      scene,
      width: bounds.width,
      height: bounds.height,
      pixelRatio,
    };
  }

  function getDiagnostics() {
    return {
      ...diagnostics,
      rendererDiagnostics: summarizeThreeRenderer(renderer),
    };
  }

  function startLoop(loopOptions = {}) {
    let target = loopOptions.target || {
      ok: Boolean(renderer && camera && scene),
      renderer,
      camera,
      scene,
    };
    if (!target.ok || !target.renderer?.setAnimationLoop) {
      diagnostics.lastError = target.reason || 'missing-three-animation-loop';
      return { ok: false, reason: diagnostics.lastError };
    }
    target.renderer.setAnimationLoop((time, frame) => {
      loopOptions.onFrame?.({
        time,
        frame,
        target,
        renderer: target.renderer,
        scene: target.scene,
        camera: target.camera,
      });
      if (loopOptions.renderFrame !== false) {
        target.renderer.render?.(target.scene, target.camera);
      }
      diagnostics.frames += 1;
    });
    diagnostics.loopRunning = true;
    diagnostics.lastError = null;
    return {
      ok: true,
      version: 'xr-three-render-loop-v1',
      renderFrame: loopOptions.renderFrame !== false,
    };
  }

  function stopLoop(loopOptions = {}) {
    let targetRenderer = loopOptions.renderer || renderer;
    if (!targetRenderer?.setAnimationLoop) {
      diagnostics.lastError = 'missing-three-animation-loop';
      return { ok: false, reason: diagnostics.lastError };
    }
    targetRenderer.setAnimationLoop(null);
    diagnostics.loopRunning = false;
    return { ok: true, version: 'xr-three-render-loop-v1' };
  }

  return {
    ensureTarget,
    resize: ensureTarget,
    startLoop,
    stopLoop,
    getDiagnostics,
    getState: getDiagnostics,
  };
}

function summarizeXRRenderState(session = null) {
  let renderState = session?.renderState || null;
  let baseLayer = renderState?.baseLayer || null;
  let layers = Array.isArray(renderState?.layers) ? renderState.layers : [];
  return {
    version: 'xr-render-state-diagnostics-v1',
    baseLayer: baseLayer ? {
      present: true,
      framebufferWidth: Number.isFinite(Number(baseLayer.framebufferWidth)) ? Number(baseLayer.framebufferWidth) : null,
      framebufferHeight: Number.isFinite(Number(baseLayer.framebufferHeight)) ? Number(baseLayer.framebufferHeight) : null,
      fixedFoveation: Number.isFinite(Number(baseLayer.fixedFoveation)) ? Number(baseLayer.fixedFoveation) : null,
    } : { present: false },
    layers: {
      count: layers.length,
      present: layers.length > 0,
    },
    depthNear: Number.isFinite(Number(renderState?.depthNear)) ? Number(renderState.depthNear) : null,
    depthFar: Number.isFinite(Number(renderState?.depthFar)) ? Number(renderState.depthFar) : null,
    inlineVerticalFieldOfView: Number.isFinite(Number(renderState?.inlineVerticalFieldOfView)) ? Number(renderState.inlineVerticalFieldOfView) : null,
  };
}

function summarizeXRFrameViewports(frame = null, referenceSpace = null, session = null, options = {}) {
  let baseLayer = session?.renderState?.baseLayer || null;
  let pose = options.viewerPose || null;
  if (!baseLayer) {
    return {
      version: 'xr-frame-viewport-diagnostics-v1',
      viewCount: 0,
      views: [],
      reason: 'xr-base-layer-missing',
    };
  }
  if (!pose && frame?.getViewerPose && referenceSpace) {
    pose = frame.getViewerPose(referenceSpace);
  }
  let views = Array.isArray(pose?.views) ? pose.views : [];
  return {
    version: 'xr-frame-viewport-diagnostics-v1',
    viewCount: views.length,
    views: views.slice(0, 4).map((view) => {
      let viewport = null;
      try {
        viewport = baseLayer?.getViewport?.(view) || null;
      } catch {
        viewport = null;
      }
      return {
        eye: view.eye || null,
        viewport: viewport ? {
          x: Number.isFinite(Number(viewport.x)) ? Number(viewport.x) : null,
          y: Number.isFinite(Number(viewport.y)) ? Number(viewport.y) : null,
          width: Number.isFinite(Number(viewport.width)) ? Number(viewport.width) : null,
          height: Number.isFinite(Number(viewport.height)) ? Number(viewport.height) : null,
        } : null,
        projectionMatrix: Boolean(view.projectionMatrix),
        transform: Boolean(view.transform),
      };
    }),
  };
}

export function createXRThreeSessionController(options = {}) {
  let target = options.globalThis || globalThis;
  let adapter = options.adapter || createXRThreeWebXRAdapter(options);
  let activeSession = null;
  let activeTarget = null;
  let controllers = [];
  let hitReticle = null;
  let lastHoverPanelId = null;
  let diagnostics = {
    version: 'xr-three-session-controller-v1',
    status: 'idle',
    mode: null,
    lastError: null,
    controllers: 0,
    controllerRayVisuals: 0,
    hitReticleVisuals: 0,
    selectedPanelId: null,
    draggingPanelId: null,
    hover: null,
    interactionEvents: 0,
    frames: 0,
    visibilityState: null,
    environmentBlendMode: null,
    interactionMode: null,
    enabledFeatures: [],
    inputSources: [],
    primaryInputSource: null,
    requestedReferenceSpaceType: null,
    requestedOptionalFeatures: [],
    requestedRequiredFeatures: [],
    requestedDomOverlay: false,
    renderState: null,
    viewports: null,
    viewerPoseCaptured: false,
    viewerPoseCaptureReason: null,
    viewerPoseRootTransform: null,
    frameErrors: 0,
    lastFrameStage: null,
    lastEvent: null,
  };

  function emit(event, details = {}) {
    diagnostics.lastEvent = event;
    options.onDiagnostic?.(event, {
      ...details,
      session: getDiagnostics(),
      adapter: adapter.getDiagnostics?.() || adapter.getState?.() || null,
    });
  }

  function sessionOptionsFor(mode, startOptions = {}) {
    return createXRThreeSessionOptions(mode, startOptions);
  }

  function setupControllers(scene, renderer, camera, startOptions = {}) {
    if (!scene || !renderer?.xr?.getController || controllers.length) return;
    for (let index = 0; index < 2; index += 1) {
      let controller = renderer.xr.getController(index);
      controller.addEventListener?.('selectstart', () => {
        let hit = adapter.controllerRays.getHits(
          controller,
          adapter.listPanelMeshes(),
        )[0];
        if (hit) {
          diagnostics.selectedPanelId = hit.object?.userData?.panelId || null;
          diagnostics.interactionEvents += 1;
          if (isXRFrameDragTarget(hit.frameTarget)) {
            let drag = adapter.controllerRays.beginDrag(controller, hit, camera);
            if (drag?.ok !== false) {
              diagnostics.draggingPanelId = diagnostics.selectedPanelId;
              emit('spatial-three-drag-start', {
                panelId: diagnostics.draggingPanelId,
                frameTarget: hit.frameTarget || null,
              });
              return;
            }
          }
          emit('spatial-three-select', {
            panelId: diagnostics.selectedPanelId,
            frameTarget: hit.frameTarget || null,
          });
        }
      });
      controller.addEventListener?.('selectend', () => {
        let wasDragging = adapter.controllerRays.getState?.().dragging === true;
        let result = wasDragging ? adapter.controllerRays.endDrag() : null;
        diagnostics.draggingPanelId = null;
        diagnostics.interactionEvents += 1;
        emit(wasDragging ? 'spatial-three-drag-end' : 'spatial-three-select-end', {
          panelId: result?.panelId || diagnostics.selectedPanelId,
          frameTarget: result?.frameTarget || null,
          pose: result?.pose || null,
        });
      });
      if (startOptions.controllerRayVisuals !== false) {
        let visual = adapter.createControllerRayVisual?.(controller, {
          ...(options.controllerRayVisuals || {}),
          ...(startOptions.controllerRayVisuals || {}),
        });
        if (visual?.ok) diagnostics.controllerRayVisuals += 1;
      }
      scene.add?.(controller);
      controllers.push(controller);
    }
    diagnostics.controllers = controllers.length;
    if (startOptions.panelHitReticle !== false && !hitReticle) {
      hitReticle = adapter.createPanelHitReticleVisual?.(scene, {
        ...(options.panelHitReticle || {}),
        ...(startOptions.panelHitReticle || {}),
      });
      if (hitReticle?.ok) diagnostics.hitReticleVisuals = 1;
    }
  }

  function updateHover() {
    if (!controllers.length) return;
    let hit = null;
    for (let controller of controllers) {
      hit = adapter.controllerRays.getHits(controller, adapter.listPanelMeshes())[0] || null;
      if (hit) break;
    }
    let reticle = adapter.updatePanelHitReticleVisual?.(hitReticle, hit) || null;
    let panelId = hit?.object?.userData?.panelId || null;
    diagnostics.hover = {
      panelId,
      point: vectorData(hit?.point),
      distance: Number(hit?.distance || 0),
      reticleVisible: Boolean(reticle?.visible),
      frameTarget: hit?.frameTarget || null,
    };
    if (panelId !== lastHoverPanelId) {
      lastHoverPanelId = panelId;
      emit('spatial-three-hover-change', { hover: diagnostics.hover });
    }
  }

  function updateDrag() {
    if (!adapter.controllerRays.getState().dragging) return;
    let result = adapter.controllerRays.updateDrag();
    diagnostics.draggingPanelId = adapter.controllerRays.getState().panelId || diagnostics.draggingPanelId;
    if (!result.ok) {
      emit('spatial-three-drag-miss', {
        error: result.reason || 'drag-update-failed',
      });
    }
  }

  function captureViewerPose(frame, referenceSpace, sessionOptions = {}) {
    if (diagnostics.viewerPoseCaptured) return null;
    if (!frame?.getViewerPose || !referenceSpace || !adapter.applyViewerPose) {
      diagnostics.viewerPoseCaptureReason = 'viewer-pose-unavailable';
      return null;
    }
    let viewerPose = frame.getViewerPose(referenceSpace);
    if (!viewerPose) {
      diagnostics.viewerPoseCaptureReason = 'viewer-pose-empty';
      return null;
    }
    let result = adapter.applyViewerPose(viewerPose, {
      mode: diagnostics.mode,
      referenceSpaceType: sessionOptions.referenceSpaceType || diagnostics.requestedReferenceSpaceType,
    });
    let captured = result && typeof result === 'object' ? { ...result, viewerPose } : { ok: false, viewerPose };
    diagnostics.viewerPoseCaptured = result?.ok === true;
    diagnostics.viewerPoseCaptureReason = result?.ok ? null : result?.reason || 'viewer-pose-apply-failed';
    diagnostics.viewerPoseRootTransform = result?.rootTransform || null;
    emit(result?.ok ? 'spatial-three-viewer-pose-captured' : 'spatial-three-viewer-pose-failed', {
      result,
      reason: diagnostics.viewerPoseCaptureReason,
    });
    return captured;
  }

  function cleanupSession() {
    activeTarget?.renderer?.setAnimationLoop?.(null);
    activeSession = null;
    if (adapter.controllerRays.getState?.().dragging === true) {
      adapter.controllerRays.endDrag();
    }
    diagnostics.status = 'idle';
    emit('spatial-three-session-ended');
  }

  function updateSessionRuntimeDiagnostics() {
    if (!activeSession) {
      diagnostics.visibilityState = null;
      diagnostics.environmentBlendMode = null;
      diagnostics.interactionMode = null;
      diagnostics.enabledFeatures = [];
      diagnostics.inputSources = [];
      diagnostics.renderState = null;
      diagnostics.viewports = null;
      return;
    }
    diagnostics.visibilityState = activeSession.visibilityState || null;
    diagnostics.environmentBlendMode = activeSession.environmentBlendMode || null;
    diagnostics.interactionMode = activeSession.interactionMode || null;
    diagnostics.enabledFeatures = normalizeStringList(activeSession.enabledFeatures);
    diagnostics.inputSources = normalizeInputSources(activeSession.inputSources);
    diagnostics.primaryInputSource = selectPrimaryXRInputSource(activeSession.inputSources || [], options.inputSource || {}).selected;
    diagnostics.renderState = summarizeXRRenderState(activeSession);
  }

  function captureFrameStage(stage, fn, context = {}) {
    diagnostics.lastFrameStage = stage;
    try {
      return fn();
    } catch (error) {
      diagnostics.frameErrors += 1;
      diagnostics.lastError = error?.name || `${stage}-failed`;
      emit('spatial-three-frame-error', {
        ...context,
        failureStage: stage,
        error: diagnostics.lastError,
        message: error?.message || '',
      });
      return null;
    }
  }

  async function start(mode = 'immersive-vr', startOptions = {}) {
    activeTarget = startOptions.target || activeTarget;
    if (!activeTarget?.ok) {
      diagnostics.lastError = activeTarget?.reason || 'three-webxr-unavailable';
      emit('spatial-three-session-failed', {
        attemptId: startOptions.attemptId || null,
        failureStage: 'target-unavailable',
        error: diagnostics.lastError,
        requestedMode: mode,
      });
      return { handled: false, ok: false, reason: diagnostics.lastError, failureStage: 'target-unavailable' };
    }
    if (!target?.navigator?.xr?.requestSession) {
      diagnostics.lastError = 'request-session-unavailable';
      emit('spatial-three-session-failed', {
        attemptId: startOptions.attemptId || null,
        failureStage: 'request-session-unavailable',
        error: diagnostics.lastError,
        requestedMode: mode,
      });
      return { handled: false, ok: false, reason: diagnostics.lastError, failureStage: 'request-session-unavailable' };
    }

    diagnostics.status = 'starting';
    diagnostics.mode = mode;
    diagnostics.lastError = null;
    let xrOptions = sessionOptionsFor(mode, startOptions);
    diagnostics.requestedReferenceSpaceType = xrOptions.referenceSpaceType || null;
    diagnostics.requestedOptionalFeatures = normalizeStringList(xrOptions.optionalFeatures);
    diagnostics.requestedRequiredFeatures = normalizeStringList(xrOptions.requiredFeatures);
    diagnostics.requestedDomOverlay = Boolean(xrOptions.domOverlayRoot);
    diagnostics.viewerPoseCaptured = false;
    diagnostics.viewerPoseCaptureReason = null;
    diagnostics.viewerPoseRootTransform = null;
    diagnostics.frameErrors = 0;
    diagnostics.lastFrameStage = null;
    emit('spatial-three-session-start-requested', {
      attemptId: startOptions.attemptId || null,
      requestedMode: mode,
      sessionOptions: {
        referenceSpaceType: diagnostics.requestedReferenceSpaceType,
        optionalFeatures: diagnostics.requestedOptionalFeatures,
        requiredFeatures: diagnostics.requestedRequiredFeatures,
        domOverlay: diagnostics.requestedDomOverlay,
      },
    });

    try {
      let adapterOptions = {
        referenceSpaceType: xrOptions.referenceSpaceType,
        optionalFeatures: xrOptions.optionalFeatures,
      };
      let sessionResult = await requestWebXRSession(target, mode, xrOptions);
      if (!sessionResult.ok) {
        diagnostics.status = 'failed';
        diagnostics.lastError = sessionResult.reason || 'three-session-failed';
        emit('spatial-three-session-failed', {
          attemptId: startOptions.attemptId || null,
          failureStage: 'request-session',
          error: diagnostics.lastError,
          requestedMode: mode,
        });
        return { handled: true, ok: false, reason: diagnostics.lastError, failureStage: 'request-session' };
      }
      let setSession = await adapter.setSession(sessionResult.session, adapterOptions);
      if (!setSession.ok) {
        await sessionResult.session.end?.();
        diagnostics.status = 'failed';
        diagnostics.lastError = setSession.reason || 'three-session-failed';
        emit('spatial-three-session-failed', {
          attemptId: startOptions.attemptId || null,
          failureStage: 'set-session',
          error: diagnostics.lastError,
          requestedMode: mode,
        });
        return { handled: true, ok: false, reason: diagnostics.lastError, failureStage: 'set-session' };
      }
      activeSession = sessionResult.session;
      diagnostics.status = 'running';
      updateSessionRuntimeDiagnostics();
      setupControllers(activeTarget.scene, activeTarget.renderer, activeTarget.camera, startOptions);
      activeTarget.renderer.setAnimationLoop?.((time, frame) => {
        diagnostics.frames += 1;
        let frameContext = {
          attemptId: startOptions.attemptId || null,
          frameNumber: diagnostics.frames,
          mode,
        };
        captureFrameStage('runtime-diagnostics', () => updateSessionRuntimeDiagnostics(), frameContext);
        let capturedPose = captureFrameStage(
          'viewer-pose',
          () => captureViewerPose(frame, setSession.referenceSpace, xrOptions),
          frameContext,
        );
        captureFrameStage('frame-viewports', () => {
          diagnostics.viewports = summarizeXRFrameViewports(frame, setSession.referenceSpace, activeSession, {
            viewerPose: capturedPose?.viewerPose || capturedPose?.result?.viewerPose,
          });
        }, frameContext);
        captureFrameStage('hover', () => updateHover(), frameContext);
        captureFrameStage('drag', () => updateDrag(), frameContext);
        captureFrameStage('frame-callback', () => {
          options.onFrame?.({ time, frame, target: activeTarget, session: activeSession });
        }, frameContext);
        if (startOptions.renderFrame !== false) {
          captureFrameStage('render', () => {
            activeTarget.renderer.render?.(activeTarget.scene, activeTarget.camera);
          }, frameContext);
        }
      });
      activeSession.addEventListener?.('end', cleanupSession, { once: true });
      emit('spatial-three-session-started', {
        attemptId: startOptions.attemptId || null,
        mode,
      });
      return { handled: true, ok: true, session: activeSession, diagnostics: getDiagnostics() };
    } catch (error) {
      diagnostics.status = 'failed';
      diagnostics.lastError = error?.name || 'three-session-failed';
      emit('spatial-three-session-failed', {
        attemptId: startOptions.attemptId || null,
        failureStage: 'exception',
        error: diagnostics.lastError,
        message: error?.message || '',
        requestedMode: mode,
      });
      return { handled: true, ok: false, reason: diagnostics.lastError, failureStage: 'exception', message: error?.message || '' };
    }
  }

  async function stop() {
    let session = activeSession;
    if (!session?.end) {
      cleanupSession();
      return false;
    }
    await session.end();
    return true;
  }

  function getDiagnostics() {
    updateSessionRuntimeDiagnostics();
    return {
      ...diagnostics,
      active: Boolean(activeSession),
      adapter: adapter.getDiagnostics?.() || adapter.getState?.() || null,
    };
  }

  return {
    start,
    stop,
    getDiagnostics,
    getState: getDiagnostics,
  };
}

export function createXRThreeSessionTelemetrySnapshot(diagnostics = {}, options = {}) {
  let adapter = diagnostics.adapter || {};
  let controller = adapter.controller || {};
  let drag = controller.diagnostics?.drag || {};
  let response = drag.response || null;
  let hover = diagnostics.hover || null;
  let textureQuality = summarizeTextureSourceQuality(adapter.textureSources);
  let now = Number(options.now ?? Date.now());
  return {
    version: 'xr-three-session-telemetry-v1',
    timestamp: Number.isFinite(now) ? now : null,
    status: diagnostics.status || 'unknown',
    mode: diagnostics.mode || null,
    active: Boolean(diagnostics.active),
    visibilityState: diagnostics.visibilityState || null,
    environmentBlendMode: diagnostics.environmentBlendMode || null,
    interactionMode: diagnostics.interactionMode || null,
    enabledFeatures: normalizeStringList(diagnostics.enabledFeatures),
    inputSources: normalizeInputSources(diagnostics.inputSources),
    primaryInputSource: diagnostics.primaryInputSource || null,
    sessionOptions: {
      referenceSpaceType: diagnostics.requestedReferenceSpaceType || null,
      optionalFeatures: normalizeStringList(diagnostics.requestedOptionalFeatures),
      requiredFeatures: normalizeStringList(diagnostics.requestedRequiredFeatures),
      domOverlay: Boolean(diagnostics.requestedDomOverlay),
    },
    renderState: diagnostics.renderState || null,
    viewports: diagnostics.viewports || null,
    frames: Number(diagnostics.frames || 0),
    frameErrors: Number(diagnostics.frameErrors || 0),
    lastFrameStage: diagnostics.lastFrameStage || null,
    controllers: Number(diagnostics.controllers || 0),
    controllerRayVisuals: Number(diagnostics.controllerRayVisuals || 0),
    hitReticleVisuals: Number(diagnostics.hitReticleVisuals || 0),
    selectedPanelId: diagnostics.selectedPanelId || null,
    draggingPanelId: diagnostics.draggingPanelId || null,
    hover: hover ? {
      panelId: hover.panelId || null,
      point: hover.point || null,
      distance: Number(hover.distance || 0),
      reticleVisible: Boolean(hover.reticleVisible),
      frameTarget: hover.frameTarget || null,
    } : null,
    interactionEvents: Number(diagnostics.interactionEvents || 0),
    lastEvent: diagnostics.lastEvent || null,
    lastError: diagnostics.lastError || null,
    panelCount: Number(adapter.panelCount || 0),
    panelFrameVisuals: Number(adapter.panelFrameVisualCount || 0),
    materialDiagnostics: adapter.materialDiagnostics || null,
    textureQuality,
    drag: {
      active: Boolean(drag.active),
      panelId: drag.panelId || null,
      frameTarget: drag.frameTarget || null,
      position: drag.position || null,
      rotation: drag.rotation || null,
      size: drag.size || null,
      resize: drag.resize || null,
      appliedDistance: response?.appliedDistance == null ? null : Number(response.appliedDistance),
      rawDistance: response?.rawDistance == null ? null : Number(response.rawDistance),
      smoothing: response?.smoothing == null ? null : Number(response.smoothing),
      maxStep: response?.maxStep == null ? null : Number(response.maxStep),
      deadzone: response?.deadzone == null ? null : Number(response.deadzone),
      clamped: Boolean(response?.clamped),
      settled: Boolean(response?.settled),
    },
  };
}

export function createXRThreeSessionHealthSummary(input = {}, options = {}) {
  let telemetry = input?.version === 'xr-three-session-telemetry-v1'
    ? input
    : createXRThreeSessionTelemetrySnapshot(input, options);
  let minFrames = Number(options.minFrames ?? 1);
  let minControllers = Number(options.minControllers ?? 1);
  let minFps = Number(options.minFps ?? 45);
  let fps = options.fps == null ? null : Number(options.fps);
  let issues = [];

  if (telemetry.lastError) {
    issues.push({ severity: 'blocked', code: 'session-error', value: telemetry.lastError });
  }
  if (telemetry.status === 'failed') {
    issues.push({ severity: 'blocked', code: 'session-failed' });
  }
  if (telemetry.status !== 'running') {
    issues.push({ severity: 'waiting', code: 'session-not-running', value: telemetry.status });
  }
  if (telemetry.active && telemetry.frames < minFrames) {
    issues.push({ severity: 'warning', code: 'no-xr-frames', value: telemetry.frames });
  }
  if (telemetry.active && telemetry.panelCount <= 0) {
    issues.push({ severity: 'blocked', code: 'no-panels' });
  }
  if (telemetry.active && telemetry.panelCount > 0 && telemetry.panelFrameVisuals <= 0) {
    issues.push({ severity: 'warning', code: 'no-panel-frame-visuals' });
  }
  if (telemetry.active && telemetry.renderState?.baseLayer?.present === false) {
    issues.push({ severity: 'blocked', code: 'xr-base-layer-missing' });
  }
  if (telemetry.active && telemetry.viewports && Number(telemetry.viewports.viewCount || 0) <= 0) {
    issues.push({ severity: 'blocked', code: 'xr-viewports-missing' });
  }
  if (telemetry.active && Number(telemetry.materialDiagnostics?.strictDiagnosticCount || 0) > 0) {
    issues.push({
      severity: 'blocked',
      code: 'strict-texture-diagnostic-material',
      value: telemetry.materialDiagnostics.strictDiagnosticCount,
    });
  }
  if (telemetry.active && Number(telemetry.materialDiagnostics?.transparentCount || 0) > 0) {
    issues.push({
      severity: 'warning',
      code: 'panel-material-transparent',
      value: telemetry.materialDiagnostics.transparentCount,
    });
  }
  if (telemetry.active && telemetry.textureQuality?.blocked > 0) {
    issues.push({
      severity: 'blocked',
      code: 'texture-quality-blocked',
      value: telemetry.textureQuality.blocked,
    });
  }
  if (telemetry.active && telemetry.textureQuality?.low > 0) {
    issues.push({
      severity: 'warning',
      code: 'texture-quality-low',
      value: telemetry.textureQuality.low,
    });
  }
  if (telemetry.active && telemetry.textureQuality?.warningCount > 0) {
    issues.push({
      severity: 'warning',
      code: 'texture-quality-warnings',
      value: telemetry.textureQuality.warningCount,
    });
  }
  if (telemetry.active && telemetry.controllers < minControllers) {
    issues.push({ severity: 'warning', code: 'no-input-controllers', value: telemetry.controllers });
  }
  if (telemetry.active && telemetry.controllerRayVisuals <= 0) {
    issues.push({ severity: 'warning', code: 'no-controller-ray-visuals' });
  }
  if (telemetry.active && telemetry.hitReticleVisuals <= 0) {
    issues.push({ severity: 'warning', code: 'no-hit-reticle-visual' });
  }
  if (telemetry.active && fps != null && Number.isFinite(fps) && fps > 0 && fps < minFps) {
    issues.push({ severity: 'warning', code: 'low-fps', value: fps });
  }
  if (telemetry.active && !telemetry.hover?.panelId) {
    issues.push({ severity: 'info', code: 'no-panel-hit-yet' });
  }

  let blocking = issues.filter((issue) => issue.severity === 'blocked');
  let warnings = issues.filter((issue) => issue.severity === 'warning');
  let waiting = issues.filter((issue) => issue.severity === 'waiting');
  let status = 'healthy';
  if (blocking.length) status = 'blocked';
  else if (waiting.length) status = 'waiting';
  else if (warnings.length) status = 'warning';

  return {
    version: 'xr-three-session-health-v1',
    status,
    reason: issues[0]?.code || 'ok',
    checks: {
      running: telemetry.status === 'running',
      active: telemetry.active === true,
      frames: telemetry.frames,
      panelCount: telemetry.panelCount,
      panelFrameVisuals: telemetry.panelFrameVisuals,
      controllers: telemetry.controllers,
      controllerRayVisuals: telemetry.controllerRayVisuals,
      hitReticleVisuals: telemetry.hitReticleVisuals,
      hoverPanelId: telemetry.hover?.panelId || null,
      textureQuality: telemetry.textureQuality || null,
      fps: Number.isFinite(fps) ? fps : null,
    },
    issues,
  };
}

export function createXRThreeInteractionReadinessSummary(input = {}, options = {}) {
  let telemetry = input?.version === 'xr-three-session-telemetry-v1'
    ? input
    : createXRThreeSessionTelemetrySnapshot(input, options);
  let texture = options.texture || null;
  let expectedPanelCount = Number(options.expectedPanelCount ?? telemetry.panelCount ?? 0);
  let expectedFrameVisuals = Number(options.expectedFrameVisuals ?? expectedPanelCount);
  let requireInteractionEvent = options.requireInteractionEvent === true;
  let checks = [];

  function add(id, status, details = {}) {
    checks.push({ id, status, ...details });
  }

  add('session-active', telemetry.active ? 'ready' : 'waiting', {
    status: telemetry.status,
    mode: telemetry.mode,
  });
  add('panels-present', telemetry.panelCount > 0 ? 'ready' : telemetry.active ? 'blocked' : 'waiting', {
    count: telemetry.panelCount,
  });
  add('panel-frame-visuals', telemetry.panelFrameVisuals >= expectedFrameVisuals ? 'ready' : telemetry.active ? 'warning' : 'waiting', {
    count: telemetry.panelFrameVisuals,
    expected: expectedFrameVisuals,
  });
  add('input-sources-present', telemetry.controllers > 0 || telemetry.inputSources.length > 0 ? 'ready' : telemetry.active ? 'warning' : 'waiting', {
    controllers: telemetry.controllers,
    inputSources: telemetry.inputSources.length,
  });
  add('controller-rays-visible', telemetry.controllerRayVisuals > 0 ? 'ready' : telemetry.active ? 'warning' : 'waiting', {
    count: telemetry.controllerRayVisuals,
  });
  add('hit-reticle-visible', telemetry.hitReticleVisuals > 0 ? 'ready' : telemetry.active ? 'warning' : 'waiting', {
    count: telemetry.hitReticleVisuals,
  });
  add('panel-hit-state', telemetry.hover?.panelId ? 'ready' : telemetry.active ? 'info' : 'waiting', {
    panelId: telemetry.hover?.panelId || null,
    frameTarget: telemetry.hover?.frameTarget || null,
  });
  add('interaction-events', telemetry.interactionEvents > 0 || !requireInteractionEvent ? 'ready' : telemetry.active ? 'warning' : 'waiting', {
    count: telemetry.interactionEvents,
    required: requireInteractionEvent,
  });
  add('drag-resize-state', telemetry.drag.active || telemetry.drag.resize || telemetry.drag.frameTarget ? 'ready' : 'waiting', {
    active: telemetry.drag.active,
    panelId: telemetry.drag.panelId,
    frameTarget: telemetry.drag.frameTarget,
    resize: telemetry.drag.resize,
  });
  if (texture) {
    add('texture-upload-ready', texture.blocked ? 'blocked' : Number(texture.ready || 0) >= Number(texture.total || 0) ? 'ready' : 'warning', {
      ready: Number(texture.ready || 0),
      total: Number(texture.total || 0),
      reason: texture.reason || null,
      stage: texture.stage || null,
    });
  }

  let blocked = checks.filter((check) => check.status === 'blocked');
  let warnings = checks.filter((check) => check.status === 'warning');
  let waiting = checks.filter((check) => check.status === 'waiting');
  let status = blocked.length ? 'blocked' : warnings.length ? 'warning' : waiting.length ? 'waiting' : 'ready';

  return {
    version: 'xr-three-interaction-readiness-v1',
    ready: status === 'ready',
    status,
    reason: blocked[0]?.id || warnings[0]?.id || waiting[0]?.id || 'ready',
    checks,
    issueCodes: checks.filter((check) => check.status !== 'ready').map((check) => check.id),
    frameTarget: telemetry.hover?.frameTarget || telemetry.drag.frameTarget || null,
    dragging: telemetry.drag.active ? {
      panelId: telemetry.drag.panelId,
      frameTarget: telemetry.drag.frameTarget,
      resize: telemetry.drag.resize,
      appliedDistance: telemetry.drag.appliedDistance,
      clamped: telemetry.drag.clamped,
      settled: telemetry.drag.settled,
    } : null,
  };
}

export function createXRThreeSessionWatchdogSummary(input = {}, options = {}) {
  let telemetry = input?.version === 'xr-three-session-telemetry-v1'
    ? input
    : createXRThreeSessionTelemetrySnapshot(input, options);
  let frames = Number(telemetry.frames || 0);
  let thresholdMs = Number(options.thresholdMs ?? 6000);
  let elapsedMs = options.elapsedMs == null ? null : Number(options.elapsedMs);
  let eventPrefix = options.eventPrefix || 'xr-three-session';
  let status = 'ok';
  let event = null;
  let reason = 'ok';

  if (telemetry.status === 'starting') {
    status = 'waiting';
    event = `${eventPrefix}-still-starting`;
    reason = 'session-still-starting';
  } else if (telemetry.status === 'running' && frames <= 0) {
    status = 'warning';
    event = `${eventPrefix}-no-frames`;
    reason = 'session-no-frames';
  }

  return {
    version: 'xr-three-session-watchdog-v1',
    status,
    event,
    reason,
    thresholdMs: Number.isFinite(thresholdMs) ? thresholdMs : 6000,
    elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : null,
    eventPrefix,
    sessionStatus: telemetry.status,
    active: telemetry.active,
    frames,
    mode: telemetry.mode,
  };
}

export function createXRThreeDiagnosticPayload(options = {}) {
  let extra = options.extra || options.details || {};
  let sessionDiagnostics = options.sessionDiagnostics || {};
  let telemetry = options.telemetry?.version === 'xr-three-session-telemetry-v1'
    ? options.telemetry
    : createXRThreeSessionTelemetrySnapshot(sessionDiagnostics, options);
  let health = options.health?.version === 'xr-three-session-health-v1'
    ? options.health
    : createXRThreeSessionHealthSummary(telemetry, { fps: options.fps });
  let support = options.support || {};
  let htmlCanvas = options.htmlCanvas || null;
  let texture = options.texture || null;
  let sceneQuality = options.sceneQuality || null;
  let visual = options.visual || null;
  let visualReadiness = options.visualReadiness || null;
  let interactionReadiness = options.interactionReadiness || null;
  let launchGate = options.launchGate || createWebXRLaunchGateSummary(support, {
    preferredMode: options.preferredMode || null,
    selectedMode: options.mode || telemetry.mode || null,
    launch: options.launch || null,
    texture,
    userActivation: options.userActivation || null,
    requireUserActivation: options.requireUserActivation === true,
  });
  let readiness = options.readiness || createXRReadinessSummary({
    launchGate,
    htmlCanvas,
    texture,
    sceneQuality,
    sessionHealth: health,
    sessionActive: telemetry.active,
    mode: options.mode || telemetry.mode || null,
  });

  return {
    version: 'xr-three-diagnostic-payload-v1',
    clientId: options.clientId || null,
    event: options.event || null,
    surface: options.surface || extra.surface || null,
    surfaceKind: options.surfaceKind || options.surface?.surfaceKind || extra.surfaceKind || extra.surface?.surfaceKind || null,
    entrypoint: options.entrypoint || options.surface?.entrypoint || extra.entrypoint || extra.surface?.entrypoint || null,
    projectId: options.projectId || options.surface?.projectId || extra.projectId || extra.surface?.projectId || null,
    targetSection: options.targetSection || options.surface?.targetSection || extra.targetSection || extra.surface?.targetSection || null,
    panelContentKind: options.panelContentKind || options.surface?.panelContentKind || extra.panelContentKind || extra.surface?.panelContentKind || null,
    pageUrl: redactXRDiagnosticUrl(options.pageUrl || ''),
    secureContext: options.secureContext === true,
    navigatorXr: options.navigatorXr === true,
    modes: options.modes || support.modes || {},
    launch: options.launch || null,
    mode: options.mode || telemetry.mode || null,
    selectedPanel: sessionDiagnostics.selectedPanelId || telemetry.selectedPanelId || null,
    hoveredPanel: sessionDiagnostics.hover?.panelId || telemetry.hover?.panelId || null,
    session: { ...telemetry, health },
    error: options.error || extra.error || null,
    details: { ...extra, htmlCanvas, sceneQuality, texture, visual, visualReadiness, interactionReadiness, launchGate, readiness },
  };
}

function normalizeTimelineValue(value) {
  if (value == null || value === '') return null;
  return String(value).replace(/\s+/g, '-').slice(0, 120);
}

function createXRThreeDiagnosticTimelineItem(event = {}) {
  let fields = [
    ['status', event.status],
    ['health', event.health],
    ['mode', event.mode],
    ['html', event.htmlCanvasAvailability],
    ['scene', event.sceneQualityStatus],
    ['ready', event.readinessStatus],
    ['visual', event.visualReadinessStatus],
    ['interaction', event.interactionReadinessStatus],
    ['textureMode', event.textureMode],
    ['texture', event.textureStage],
    ['resolver', event.textureResolverStage],
    ['gate', event.launchGateReason],
    ['stage', event.failureStage],
    ['error', event.error],
  ]
    .map(([key, value]) => [key, normalizeTimelineValue(value)])
    .filter(([, value]) => value);
  let eventName = normalizeTimelineValue(event.event) || 'event';

  return {
    event: eventName,
    receivedAt: event.receivedAt || null,
    fields: Object.fromEntries(fields),
    text: [
      eventName,
      ...fields.map(([key, value]) => `${key}:${value}`),
    ].join(' '),
  };
}

export function createXRThreeSessionOptions(mode = 'immersive-vr', startOptions = {}) {
  let defaultOptionalFeatures = [
    ...(startOptions.includeLocalFeature ? [WEBXR_FEATURES.local] : []),
    WEBXR_FEATURES.localFloor,
    WEBXR_FEATURES.boundedFloor,
    WEBXR_FEATURES.domOverlay,
  ];
  let explicitOptionalFeatures = normalizeStringList(startOptions.optionalFeatures);
  let requiredFeatures = [...new Set(normalizeStringList(startOptions.requiredFeatures))];
  let optionalFeatures = [...new Set(explicitOptionalFeatures.length ? explicitOptionalFeatures : defaultOptionalFeatures)];
  let referenceSpaceType = startOptions.referenceSpaceType || WEBXR_FEATURES.localFloor;
  let result = {
    requiredFeatures,
    optionalFeatures,
    referenceSpaceType,
  };
  if (startOptions.domOverlayRoot) {
    result.domOverlayRoot = startOptions.domOverlayRoot;
  }
  return result;
}

export function createXRThreeDiagnosticTimelineSummary(events = [], options = {}) {
  let limit = Math.max(0, Number(options.limit ?? 12));
  let list = Array.isArray(events) ? events.slice(limit ? -limit : 0) : [];
  let items = list.map(createXRThreeDiagnosticTimelineItem);
  return {
    version: 'xr-three-diagnostic-timeline-v1',
    count: items.length,
    latest: items.at(-1) || null,
    items,
    text: items.length ? items.map((item) => item.text).join(' -> ') : null,
  };
}

function findDiagnosticClient(summary = {}, clientId = null) {
  let clients = Array.isArray(summary.clients) ? summary.clients : [];
  return clients.find((client) => client.clientId === clientId) || null;
}

function inputSourcesText(inputSources = []) {
  return Array.isArray(inputSources) && inputSources.length
    ? inputSources.map((source) => source.targetRayMode || source.handedness || 'input').join(', ')
    : null;
}

export function createXRThreeDiagnosticServerSummary(summary = null, options = {}) {
  let currentClient = summary ? findDiagnosticClient(summary, options.clientId) : null;
  let latestClient = summary?.latestClient || null;
  let latestImmersiveClient = summary?.latestImmersiveClient || null;
  let currentSession = currentClient?.session || null;
  let currentChecks = currentSession?.health?.checks || {};
  let currentHtmlCanvas = currentClient?.htmlCanvas || summary?.htmlCanvas || null;
  let currentSceneQuality = currentClient?.sceneQuality || summary?.sceneQuality || null;
  let currentReadiness = currentClient?.readiness || summary?.readiness || null;
  let currentVisualReadiness = currentClient?.visualReadiness || summary?.visualReadiness || null;
  let currentInteractionReadiness = currentClient?.interactionReadiness || summary?.interactionReadiness || null;
  let currentTexture = currentClient?.texture || null;
  let currentTextureResolver = currentTexture?.resolverStages?.[0] || null;
  let currentLaunchGate = currentClient?.launchGate || null;
  let currentDeepGraph = currentClient?.deepGraph || summary?.deepGraph || null;
  let currentDeepGraphPreview = currentClient?.deepGraphPreview || summary?.deepGraphPreview || null;
  let recentEvents = Array.isArray(currentClient?.recentEvents) ? currentClient.recentEvents : [];
  let currentLastEvent = recentEvents.at(-1) || null;

  return {
    version: 'xr-three-diagnostic-server-summary-v1',
    available: Boolean(summary),
    summaryVersion: summary?.version || null,
    clientCount: Number(summary?.clientCount || 0),
    immersiveClientCount: Number(summary?.immersiveClientCount || 0),
    currentClient,
    latestClient,
    latestImmersiveClient,
    currentSession,
    currentChecks,
    currentHtmlCanvas,
    currentSceneQuality,
    currentReadiness,
    currentVisualReadiness,
    currentInteractionReadiness,
    currentTexture,
    currentTextureResolver,
    currentLaunchGate,
    currentDeepGraph,
    currentDeepGraphPreview,
    currentRunning: Boolean(currentSession?.active || currentSession?.status === 'running'),
    currentTimeline: createXRThreeDiagnosticTimelineSummary(recentEvents, options.timeline || {}),
    currentLastEvent,
    currentLastEventTimeline: createXRThreeDiagnosticTimelineSummary(currentLastEvent ? [currentLastEvent] : []),
    inputSourcesText: inputSourcesText(currentSession?.inputSources),
    latestImmersiveHealth: latestImmersiveClient?.session?.health?.status || null,
  };
}

function issue(code, severity, source, detail = null) {
  return {
    code,
    severity,
    source,
    detail,
  };
}

export function createXRThreeTroubleshootingSummary(diagnostics = null, options = {}) {
  let server = diagnostics?.version === 'xr-three-diagnostic-server-summary-v1'
    ? diagnostics
    : createXRThreeDiagnosticServerSummary(diagnostics, options);
  let issues = [];
  let client = server.currentClient || null;
  let session = server.currentSession || {};
  let checks = server.currentChecks || {};
  let texture = server.currentTexture || null;
  let htmlCanvas = server.currentHtmlCanvas || null;
  let launchGate = server.currentLaunchGate || null;
  let readiness = server.currentReadiness || null;
  let visualReadiness = server.currentVisualReadiness || null;
  let interactionReadiness = server.currentInteractionReadiness || null;
  let sceneQuality = server.currentSceneQuality || null;

  if (!server.available) {
    issues.push(issue('server-diagnostics-unavailable', 'waiting', 'server'));
  }
  if (server.available && !client) {
    issues.push(issue('client-diagnostics-missing', 'waiting', 'server'));
  }
  if (client?.stale) {
    issues.push(issue('client-diagnostics-stale', 'warning', 'server', { ageMs: client.ageMs }));
  }
  if (client?.lastError) {
    issues.push(issue('client-error', 'blocked', 'session', client.lastError));
  }
  if (launchGate?.blocked) {
    issues.push(issue('launch-gate-blocked', 'blocked', 'launch', launchGate.reason || null));
  }
  if (readiness?.status === 'blocked') {
    issues.push(issue('readiness-blocked', 'blocked', 'readiness', readiness.reason || null));
  }
  if (visualReadiness && visualReadiness.ready === false) {
    issues.push(issue('visual-readiness-blocked', visualReadiness.status === 'fail' ? 'blocked' : 'warning', 'visual', visualReadiness.reason || null));
  }
  if (interactionReadiness && interactionReadiness.ready === false) {
    issues.push(issue('interaction-readiness-blocked', interactionReadiness.status === 'blocked' ? 'blocked' : 'warning', 'interaction', interactionReadiness.reason || null));
  }
  if (server.currentRunning && Number(session.frames || checks.frames || 0) <= 0) {
    issues.push(issue('no-xr-frames', 'blocked', 'session'));
  }
  if (server.currentRunning && Number(session.panelCount || checks.panelCount || 0) <= 0) {
    issues.push(issue('no-panels', 'blocked', 'scene'));
  }
  if (
    server.currentRunning &&
    Number(session.panelCount || checks.panelCount || 0) > 0 &&
    Number(session.panelFrameVisuals || checks.panelFrameVisuals || 0) <= 0
  ) {
    issues.push(issue('panel-frame-visuals-missing', 'warning', 'scene'));
  }
  if (server.currentRunning && session.renderState?.baseLayer?.present === false) {
    issues.push(issue('xr-base-layer-missing', 'blocked', 'renderer'));
  }
  if (server.currentRunning && session.viewports && Number(session.viewports.viewCount || 0) <= 0) {
    issues.push(issue('xr-viewports-missing', 'blocked', 'renderer'));
  }
  if (server.currentRunning && Number(session.materialDiagnostics?.strictDiagnosticCount || 0) > 0) {
    issues.push(issue('strict-texture-diagnostic-material', 'blocked', 'material', {
      count: Number(session.materialDiagnostics.strictDiagnosticCount || 0),
      panelIds: session.materialDiagnostics.strictDiagnosticPanelIds || [],
    }));
  }
  if (server.currentRunning && Number(session.materialDiagnostics?.transparentCount || 0) > 0) {
    issues.push(issue('panel-material-transparent', 'warning', 'material', {
      count: Number(session.materialDiagnostics.transparentCount || 0),
    }));
  }
  if (texture?.blocked) {
    issues.push(issue('texture-gate-blocked', 'blocked', 'texture', texture.reason || texture.stage || null));
  } else if (texture && Number(texture.ready || 0) < Number(texture.total || 0)) {
    issues.push(issue('texture-not-ready', 'blocked', 'texture', {
      ready: Number(texture.ready || 0),
      total: Number(texture.total || 0),
      stage: texture.stage || null,
    }));
  }
  if (htmlCanvas && htmlCanvas.textureUploadAvailable === false) {
    issues.push(issue('html-canvas-texture-upload-missing', 'warning', 'html-canvas', htmlCanvas.availability || null));
  }
  if (sceneQuality?.status === 'low') {
    issues.push(issue('scene-quality-low', 'warning', 'scene', {
      lowQualityCount: Number(sceneQuality.lowQualityCount || 0),
      total: Number(sceneQuality.total || 0),
    }));
  }
  if (server.currentRunning && Number(session.controllers || checks.controllers || 0) <= 0) {
    issues.push(issue('input-controllers-missing', 'warning', 'input'));
  }
  if (server.currentRunning && Number(session.controllerRayVisuals || checks.controllerRayVisuals || 0) <= 0) {
    issues.push(issue('controller-rays-missing', 'warning', 'input'));
  }
  if (server.currentRunning && Number(session.hitReticleVisuals || checks.hitReticleVisuals || 0) <= 0) {
    issues.push(issue('hit-reticle-missing', 'warning', 'input'));
  }
  if (server.currentRunning && Number(session.interactionEvents || 0) <= 0) {
    issues.push(issue('interaction-events-missing', 'waiting', 'input'));
  }

  let status = 'ready';
  if (issues.some((item) => item.severity === 'blocked')) {
    status = 'blocked';
  } else if (issues.some((item) => item.severity === 'warning')) {
    status = 'warning';
  } else if (issues.some((item) => item.severity === 'waiting')) {
    status = 'waiting';
  } else if (server.currentRunning) {
    status = 'running';
  }
  let primaryIssue = issues[0] || null;

  return {
    version: 'xr-three-troubleshooting-summary-v1',
    status,
    primaryIssue,
    issues,
    issueCodes: issues.map((item) => item.code),
    issueCount: issues.length,
    serverAvailable: server.available,
    clientId: client?.clientId || null,
    currentRunning: server.currentRunning,
    frameCount: Number(session.frames || checks.frames || 0),
    panelCount: Number(session.panelCount || checks.panelCount || 0),
    textureReady: texture ? Number(texture.ready || 0) : null,
    textureTotal: texture ? Number(texture.total || 0) : null,
    timelineText: server.currentTimeline?.text || null,
  };
}
