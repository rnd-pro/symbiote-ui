import { createXRPanelContentViewport } from './layout-projection.js';

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v, s) {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function normalize(v) {
  let length = Math.hypot(v[0], v[1], v[2]);
  if (!length) return [0, 0, -1];
  return [v[0] / length, v[1] / length, v[2] / length];
}

function numberOr(value, fallback) {
  let number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundMetric(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function degToRad(value) {
  return Number(value || 0) * Math.PI / 180;
}

function panelAxes(panel) {
  let yaw = degToRad(panel.rotation?.[1] || 0);
  let right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  let up = [0, 1, 0];
  let normal = normalize([Math.sin(yaw), 0, Math.cos(yaw)]);
  return { right, up, normal };
}

export function hitTestXRPanel(ray, panel) {
  if (!ray || !panel) return null;
  let origin = ray.origin || [0, 0, 0];
  let direction = normalize(ray.direction || [0, 0, -1]);
  let center = panel.position || [0, 0, -1];
  let [width, height] = panel.size || [1, 1];
  let { right, up, normal } = panelAxes(panel);
  let denom = dot(normal, direction);
  if (Math.abs(denom) < 0.000001) return null;
  let t = dot(normal, subtract(center, origin)) / denom;
  if (t < 0) return null;

  let hitPoint = add(origin, scale(direction, t));
  let local = subtract(hitPoint, center);
  let xMeters = dot(local, right);
  let yMeters = dot(local, up);
  let x = xMeters / width + 0.5;
  let y = 0.5 - yMeters / height;
  if (x < 0 || x > 1 || y < 0 || y > 1) return null;

  return {
    panelId: panel.id,
    point: { x, y },
    worldPoint: hitPoint,
    distance: t,
    panel,
  };
}

export function hitTestXRPanels(ray, panels = []) {
  return panels
    .map((panel) => hitTestXRPanel(ray, panel))
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

export function createXRPointerEvent(hit, input = {}, type = 'pointermove') {
  if (!hit) return null;
  let target = createXRPanelPointerTarget(hit, input);
  return {
    type,
    source: input.source || 'xr-controller',
    targetId: hit.panelId,
    point: hit.point,
    contentPoint: target.contentPoint,
    contentViewport: target.contentViewport,
    worldPoint: hit.worldPoint,
    distance: hit.distance,
    buttons: {
      primary: Boolean(input.primary),
      secondary: Boolean(input.secondary),
    },
    ray: input.ray || null,
  };
}

export function createXRPanelPointerTarget(hit, options = {}) {
  if (!hit) return null;
  let panel = options.panel || hit.panel || {};
  let point = {
    x: clamp(numberOr(hit.point?.x, 0), 0, 1),
    y: clamp(numberOr(hit.point?.y, 0), 0, 1),
  };
  let contentViewport = options.contentViewport || panel.contentViewport || createXRPanelContentViewport(panel);
  return {
    panelId: String(hit.panelId || panel.id || ''),
    targetId: String(hit.panelId || panel.id || ''),
    point,
    contentPoint: {
      x: roundMetric(point.x * contentViewport.width),
      y: roundMetric(point.y * contentViewport.height),
    },
    contentViewport,
    source: options.source || 'xr-controller',
  };
}

export function createXRPointerHit(panel, point = {}, options = {}) {
  if (!panel) return null;
  let normalizedPoint = {
    x: clamp(numberOr(point.x, 0), 0, 1),
    y: clamp(numberOr(point.y, 0), 0, 1),
  };
  return {
    panelId: panel.id,
    point: normalizedPoint,
    worldPoint: options.worldPoint || null,
    distance: numberOr(options.distance, 0),
    panel,
  };
}

export function createXRPointerHitFromDomEvent(panel, element, event, options = {}) {
  if (!panel || !element?.getBoundingClientRect || !event) return null;
  let rect = element.getBoundingClientRect();
  return createXRPointerHit(panel, {
    x: (numberOr(event.clientX, rect.left) - rect.left) / Math.max(rect.width, 1),
    y: (numberOr(event.clientY, rect.top) - rect.top) / Math.max(rect.height, 1),
  }, options);
}

export function createXRPointerRayFromDomEvent(event, element, options = {}) {
  if (!event || !element?.getBoundingClientRect) return null;
  let rect = element.getBoundingClientRect();
  let width = Math.max(numberOr(rect.width, 0), 1);
  let height = Math.max(numberOr(rect.height, 0), 1);
  let normalizedX = (numberOr(event.clientX, rect.left) - rect.left) / width - 0.5;
  let normalizedY = 0.5 - (numberOr(event.clientY, rect.top) - rect.top) / height;
  let horizontalMeters = numberOr(options.horizontalMeters, 1.4);
  let verticalMeters = numberOr(options.verticalMeters, 0.72);
  let eyeHeight = numberOr(options.eyeHeight, 1.32);
  let horizontalSkew = numberOr(options.horizontalSkew, 0.28);
  let verticalSkew = numberOr(options.verticalSkew, 0.18);

  return {
    version: 'xr-dom-pointer-ray-v1',
    source: options.source || 'dom-pointer',
    origin: [
      roundMetric(normalizedX * horizontalMeters),
      roundMetric(eyeHeight + normalizedY * verticalMeters),
      numberOr(options.originZ, 0),
    ],
    direction: normalize([
      -normalizedX * horizontalSkew,
      -normalizedY * verticalSkew,
      -1,
    ]),
    normalized: {
      x: roundMetric(normalizedX + 0.5),
      y: roundMetric(0.5 - normalizedY),
    },
  };
}

export function normalizeXRInputRay(inputSource, frame, referenceSpace) {
  let pose = frame?.getPose?.(inputSource?.targetRaySpace, referenceSpace);
  let transform = pose?.transform;
  if (!transform) return null;
  let matrix = transform.matrix;
  if (Array.isArray(matrix) || ArrayBuffer.isView(matrix)) {
    return {
      origin: [matrix[12], matrix[13], matrix[14]],
      direction: normalize([-matrix[8], -matrix[9], -matrix[10]]),
    };
  }
  return null;
}

function inputSourceKind(inputSource = {}) {
  let mode = inputSource.targetRayMode || '';
  let profiles = Array.isArray(inputSource.profiles) ? inputSource.profiles.join(' ') : '';
  if (inputSource.hand) return 'hand';
  if (mode === 'gaze') return 'gaze';
  if (mode === 'screen') return 'screen';
  if (/hand|pinch/i.test(profiles)) return 'hand';
  return 'controller';
}

export function createXRInputSourceSummary(inputSource = {}, options = {}) {
  let profiles = Array.isArray(inputSource.profiles) ? [...inputSource.profiles].map(String) : [];
  return {
    version: 'xr-input-source-summary-v1',
    id: options.id || inputSource.id || null,
    handedness: inputSource.handedness || 'none',
    targetRayMode: inputSource.targetRayMode || null,
    kind: inputSourceKind(inputSource),
    primary: options.primary === true,
    profiles,
    capabilities: {
      targetRay: Boolean(inputSource.targetRaySpace),
      grip: Boolean(inputSource.gripSpace),
      hand: Boolean(inputSource.hand),
      gamepad: Boolean(inputSource.gamepad),
      squeeze: Boolean(inputSource.gamepad || inputSource.profiles?.length),
    },
  };
}

function inputScore(summary, options = {}) {
  let score = 0;
  if (summary.targetRayMode === 'tracked-pointer') score += 40;
  if (summary.kind === 'controller') score += options.preferHands ? 8 : 20;
  if (summary.kind === 'hand') score += options.preferHands ? 24 : 12;
  if (summary.handedness === (options.dominantHand || 'right')) score += 8;
  if (summary.capabilities.targetRay) score += 8;
  if (summary.capabilities.gamepad) score += 4;
  return score;
}

export function selectPrimaryXRInputSource(inputSources = [], options = {}) {
  let sources = [...inputSources].map((source, index) => ({
    source,
    summary: createXRInputSourceSummary(source, { id: source?.id || `input-${index}` }),
  }));
  let selected = sources
    .map((item) => ({ ...item, score: inputScore(item.summary, options) }))
    .sort((a, b) => b.score - a.score)[0] || null;
  return {
    version: 'xr-primary-input-source-v1',
    selected: selected ? {
      ...selected.summary,
      primary: true,
      score: selected.score,
    } : null,
    source: selected?.source || null,
    summaries: sources.map((item) => item.summary),
    reason: selected ? 'best-target-ray-score' : 'no-input-sources',
  };
}
