export const PRESENTER_GESTURE_POLICY_VERSION = 'symbiote-presenter-gesture-policy-v1';

export const PRESENTER_GESTURE_POLICY = Object.freeze({
  version: PRESENTER_GESTURE_POLICY_VERSION,
  markerMaxAreaRatio: 0.08,
  markerMaxWidthRatio: 0.55,
  markerMaxHeightRatio: 0.34,
  relationshipMinGapPx: 24,
  fallbackOrder: Object.freeze({
    annotation: Object.freeze(['marker', 'focus-frame']),
    relationship: Object.freeze(['arrow', 'focus-frame']),
    action: Object.freeze(['cursor-click']),
    reveal: Object.freeze(['cursor-click', 'focus-frame']),
  }),
});

const FRAME_SEMANTIC_ROLES = new Set(['panel', 'surface', 'region', 'workspace', 'map', 'graph', 'editor']);

function finite(value) {
  let number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function rect(value = {}) {
  let left = finite(value.left ?? value.x);
  let top = finite(value.top ?? value.y);
  let width = Math.max(0, finite(value.width));
  let height = Math.max(0, finite(value.height));
  return Object.freeze({ left, top, width, height, right: left + width, bottom: top + height });
}

function viewportRect(value = {}) {
  let width = Math.max(1, finite(value.width));
  let height = Math.max(1, finite(value.height));
  return Object.freeze({ width, height, area: width * height });
}

function geometry(targetRect, viewport) {
  let target = rect(targetRect);
  let surface = viewportRect(viewport);
  return Object.freeze({
    targetRect: target,
    viewport: surface,
    areaRatio: (target.width * target.height) / surface.area,
    widthRatio: target.width / surface.width,
    heightRatio: target.height / surface.height,
  });
}

function overlaps(left, right) {
  return left.left < right.right
    && left.right > right.left
    && left.top < right.bottom
    && left.bottom > right.top;
}

function edgeGap(left, right) {
  let horizontal = Math.max(0, Math.max(left.left, right.left) - Math.min(left.right, right.right));
  let vertical = Math.max(0, Math.max(left.top, right.top) - Math.min(left.bottom, right.bottom));
  return Math.hypot(horizontal, vertical);
}

function markerIsCompact(metrics, policy) {
  return metrics.areaRatio <= policy.markerMaxAreaRatio
    && metrics.widthRatio <= policy.markerMaxWidthRatio
    && metrics.heightRatio <= policy.markerMaxHeightRatio;
}

function relationIdentity(relation, sourceTargetId, destinationTargetId) {
  let id = String(relation?.id || '').trim();
  let from = String(relation?.from || relation?.sourceTargetId || '').trim();
  let to = String(relation?.to || relation?.destinationTargetId || '').trim();
  let source = String(sourceTargetId || from).trim();
  let destination = String(destinationTargetId || to).trim();
  return Object.freeze({ id, from, to, sourceTargetId: source, destinationTargetId: destination });
}

function result(base, selectedKind, reason, fallbackFrom = '') {
  return Object.freeze({
    ...base,
    selectedKind,
    reason,
    ...(fallbackFrom ? { fallbackFrom } : {}),
  });
}

/**
 * Resolve one visual gesture without product names or narration vocabulary.
 * The semantic cue remains immutable; only its visual projection may fall back.
 */
export function resolvePresenterGesturePolicy({
  cueKind = 'annotation',
  interactionType = '',
  annotation = null,
  semanticRole = '',
  targetRect = {},
  viewport = {},
  safety = null,
  relation = null,
  sourceTargetId = '',
  destinationTargetId = '',
  sourceRect = null,
  destinationRect = null,
  policy = PRESENTER_GESTURE_POLICY,
} = {}) {
  let metrics = geometry(targetRect, viewport);
  let base = {
    policyVersion: policy.version,
    cueKind,
    interactionType: String(interactionType || ''),
    targetAreaRatio: metrics.areaRatio,
    targetWidthRatio: metrics.widthRatio,
    targetHeightRatio: metrics.heightRatio,
    requestedAnnotationKind: String(annotation?.kind || ''),
    requestedMarker: String(annotation?.marker || ''),
    requestedIntent: String(annotation?.intent || ''),
    semanticRole: String(semanticRole || ''),
  };

  if (cueKind === 'action') {
    if (interactionType === 'panel-reveal' || interactionType === 'reveal') {
      return result({ ...base, sequence: Object.freeze(['cursor-click', 'focus-frame']) }, 'cursor-click-then-focus', 'reveal-needs-causal-confirmation');
    }
    return result(base, 'cursor-click', 'registered-action');
  }

  if (cueKind === 'focus') return result(base, 'focus-frame', 'explicit-focus-cue');

  if (cueKind === 'relationship') {
    let identity = relationIdentity(relation, sourceTargetId, destinationTargetId);
    let source = sourceRect ? rect(sourceRect) : null;
    let destination = destinationRect ? rect(destinationRect) : null;
    let bound = Boolean(identity.id)
      && identity.from === identity.sourceTargetId
      && identity.to === identity.destinationTargetId
      && identity.sourceTargetId !== identity.destinationTargetId;
    let separated = Boolean(source && destination && !overlaps(source, destination));
    let gapPx = source && destination ? edgeGap(source, destination) : 0;
    let relationBase = { ...base, relation: identity, relationGapPx: gapPx };
    if (bound && separated && gapPx >= policy.relationshipMinGapPx) {
      return result(relationBase, 'arrow', 'registered-separated-relationship');
    }
    return result(relationBase, 'focus-frame', bound ? 'relationship-geometry-ineligible' : 'relationship-unbound', 'arrow');
  }

  if (cueKind !== 'annotation') return result(base, 'none', 'unsupported-cue-kind');

  if (annotation?.kind === 'symbol') {
    return result(base, 'symbol', 'symbol-does-not-enclose-target');
  }

  if (safety?.safe === false) {
    return result(base, 'focus-frame', 'annotation-safety-fallback', 'marker');
  }

  if (FRAME_SEMANTIC_ROLES.has(String(semanticRole || ''))) {
    return result(base, 'focus-frame', 'semantic-region-prefers-frame', 'marker');
  }

  if (markerIsCompact(metrics, policy)) {
    return result(base, 'marker', 'compact-target');
  }

  return result(base, 'focus-frame', 'target-geometry-prefers-frame', 'marker');
}

export function createPresenterRelationshipPath({ sourceRect, destinationRect } = {}) {
  let source = rect(sourceRect);
  let destination = rect(destinationRect);
  let sourceCenter = { x: source.left + source.width / 2, y: source.top + source.height / 2 };
  let destinationCenter = { x: destination.left + destination.width / 2, y: destination.top + destination.height / 2 };
  let horizontal = Math.abs(destinationCenter.x - sourceCenter.x) >= Math.abs(destinationCenter.y - sourceCenter.y);
  let start = horizontal
    ? { x: destinationCenter.x >= sourceCenter.x ? source.right : source.left, y: sourceCenter.y }
    : { x: sourceCenter.x, y: destinationCenter.y >= sourceCenter.y ? source.bottom : source.top };
  let end = horizontal
    ? { x: destinationCenter.x >= sourceCenter.x ? destination.left : destination.right, y: destinationCenter.y }
    : { x: destinationCenter.x, y: destinationCenter.y >= sourceCenter.y ? destination.top : destination.bottom };
  let dx = end.x - start.x;
  let dy = end.y - start.y;
  let length = Math.max(1, Math.hypot(dx, dy));
  let ux = dx / length;
  let uy = dy / length;
  let arrowSize = Math.min(16, Math.max(8, length * 0.12));
  let left = { x: end.x - ux * arrowSize - uy * arrowSize * 0.55, y: end.y - uy * arrowSize + ux * arrowSize * 0.55 };
  let right = { x: end.x - ux * arrowSize + uy * arrowSize * 0.55, y: end.y - uy * arrowSize - ux * arrowSize * 0.55 };
  return Object.freeze({ start: Object.freeze(start), end: Object.freeze(end), arrowHead: Object.freeze([Object.freeze(left), Object.freeze(right)]), lengthPx: length });
}
