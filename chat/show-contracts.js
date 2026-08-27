export const SHOW_CONTRACT_VERSION = 'symbiote-show-v1';

export const SHOW_DIRECTIVE_TYPES = Object.freeze([
  'speech',
  'footnote',
  'status',
  'actions',
  'branch-enter',
  'branch-return',
  'resume',
  'attention',
  'media',
]);

export const SHOW_ATTENTION_MODES = Object.freeze([
  'cursor',
  'frame',
  'native-selection',
  'click',
  'marker',
]);

export const SHOW_MEDIA_MODES = Object.freeze([
  'short-muted-montage',
  'full-with-media-audio',
]);

export const SHOW_MARKER_SHAPES = Object.freeze([
  'freehand',
  'underline',
  'oval',
  'multi-oval',
  'arrow',
  'converging-arrows',
  'route',
  'bidirectional-route',
  'parallel-route',
  'label',
  'number',
  'box',
  'bracket',
  'slash',
]);

export const SHOW_ATTENTION_INTENTS = Object.freeze([
  'emphasize',
  'detail',
  'group',
  'pointer',
  'risk',
  'question',
  'success',
  'affinity',
  'flourish',
]);

export const SHOW_PRESENTER_STYLE_FIELDS = Object.freeze([
  'baseWidthPx',
  'noiseAmplitudePx',
  'minMovingSpeedPxPerMs',
  'targetSpeedPxPerMs',
  'maxSpeedPxPerMs',
  'minDurationMs',
]);

export const SHOW_MARKER_SHAPE_ALIASES = Object.freeze({
  ovals: 'multi-oval',
});

const DIRECTIVE_TYPES = new Set(SHOW_DIRECTIVE_TYPES);
const ATTENTION_MODES = new Set(SHOW_ATTENTION_MODES);
const MEDIA_MODES = new Set(SHOW_MEDIA_MODES);
const MARKER_SHAPES = new Set(SHOW_MARKER_SHAPES);
const ATTENTION_INTENTS = new Set(SHOW_ATTENTION_INTENTS);
const PRESENTER_STYLE_FIELDS = new Set(SHOW_PRESENTER_STYLE_FIELDS);
const STATUS_VALUES = new Set(['idle', 'running', 'paused', 'done', 'error', 'cancelled']);

export class ShowContractError extends TypeError {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ShowContractError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    this.version = SHOW_CONTRACT_VERSION;
  }
}

function fail(code, message, details) {
  throw new ShowContractError(code, message, details);
}

function record(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('invalid-record', `${name} must be an object`);
  }
  return value;
}

function text(value, name, { optional = false } = {}) {
  if (value === undefined && optional) return '';
  let result = typeof value === 'string' ? value.trim() : '';
  if (!result && !optional) fail('missing-field', `${name} must be a non-empty string`);
  return result;
}

function finite(value, name, { optional = false, min = 0 } = {}) {
  if (value === undefined && optional) return undefined;
  let result = Number(value);
  if (!Number.isFinite(result) || result < min) {
    fail('invalid-number', `${name} must be a finite number greater than or equal to ${min}`);
  }
  return result;
}

function normalizeAction(value, index) {
  let input = record(value, `actions[${index}]`);
  let id = text(input.id, `actions[${index}].id`);
  let label = text(input.label ?? input.title ?? input.text, `actions[${index}].label`);
  return Object.freeze({
    id,
    label,
    ...(input.variant ? { variant: String(input.variant) } : {}),
    ...(input.icon ? { icon: String(input.icon) } : {}),
    ...(Object.hasOwn(input, 'payload') ? { payload: input.payload } : {}),
  });
}

export function normalizeShowPlaybackSnapshot(value = {}) {
  let input = record(value, 'playback snapshot');
  let playbackState = String(input.playbackState || 'paused');
  if (!['playing', 'paused', 'ended'].includes(playbackState)) {
    fail('invalid-playback-state', `unsupported playbackState "${playbackState}"`);
  }
  return Object.freeze({
    episodeId: text(input.episodeId, 'episodeId', { optional: true }),
    positionMs: finite(input.positionMs ?? 0, 'positionMs'),
    cueIndex: Math.trunc(finite(input.cueIndex ?? 0, 'cueIndex')),
    playbackState,
    subjectId: text(input.subjectId, 'subjectId', { optional: true }),
  });
}

export function normalizeShowMarkerShape(value) {
  let requested = text(value, 'marker');
  let canonical = SHOW_MARKER_SHAPE_ALIASES[requested] || requested;
  if (!MARKER_SHAPES.has(canonical)) fail('invalid-marker-shape', `unsupported show marker shape "${requested}"`, { requested });
  return Object.freeze({ requested, canonical });
}

function normalizePresenterStyle(value) {
  let input = record(value, 'presenter style');
  let unknown = Object.keys(input).filter((key) => !PRESENTER_STYLE_FIELDS.has(key));
  if (unknown.length) fail('invalid-presenter-style', `unsupported presenter style field "${unknown[0]}"`);
  return Object.freeze(Object.fromEntries(
    Object.entries(input).map(([key, fieldValue]) => [key, finite(fieldValue, `style.${key}`)]),
  ));
}

export function normalizeShowDirective(value = {}) {
  let input = record(value, 'show directive');
  let type = text(input.type, 'type');
  if (!DIRECTIVE_TYPES.has(type)) fail('unsupported-directive', `unsupported show directive "${type}"`, { type });

  let result = { version: SHOW_CONTRACT_VERSION, type };
  if (input.id !== undefined) result.id = text(input.id, 'id');

  if (type === 'speech') {
    result.text = text(input.text, 'text');
    if (input.cueId !== undefined) result.cueId = text(input.cueId, 'cueId');
    if (input.voice !== undefined) result.voice = text(input.voice, 'voice');
  } else if (type === 'footnote') {
    result.text = text(input.text, 'text');
    if (input.referenceId !== undefined) result.referenceId = text(input.referenceId, 'referenceId');
    if (input.href !== undefined) result.href = text(input.href, 'href');
  } else if (type === 'status') {
    result.status = String(input.status || 'idle');
    if (!STATUS_VALUES.has(result.status)) fail('invalid-status', `unsupported show status "${result.status}"`);
    result.text = text(input.text, 'text', { optional: true });
  } else if (type === 'actions') {
    if (!Array.isArray(input.actions) || !input.actions.length) fail('missing-actions', 'actions must contain at least one action');
    result.actions = Object.freeze(input.actions.map(normalizeAction));
    if (Object.hasOwn(input, 'context')) result.context = input.context;
  } else if (type === 'branch-enter') {
    result.branchId = text(input.branchId, 'branchId');
    result.snapshot = normalizeShowPlaybackSnapshot(input.snapshot || {});
  } else if (type === 'branch-return') {
    result.branchId = text(input.branchId, 'branchId', { optional: true });
    result.resume = 'explicit';
  } else if (type === 'resume') {
    result.explicit = true;
  } else if (type === 'attention') {
    result.mode = String(input.mode || 'cursor');
    if (!ATTENTION_MODES.has(result.mode)) fail('invalid-attention-mode', `unsupported attention mode "${result.mode}"`);
    result.targetId = text(input.targetId, 'targetId');
    if (input.intent !== undefined) {
      result.intent = text(input.intent, 'intent');
      if (!ATTENTION_INTENTS.has(result.intent)) fail('invalid-attention-intent', `unsupported attention intent "${result.intent}"`);
    }
    if (input.marker !== undefined) {
      let marker = normalizeShowMarkerShape(input.marker);
      result.marker = marker.canonical;
      if (marker.requested !== marker.canonical) result.requestedMarker = marker.requested;
    }
    if (input.label !== undefined) result.label = text(String(input.label), 'label');
    if (input.quote !== undefined) result.quote = text(input.quote, 'quote');
    if (input.occurrence !== undefined) result.occurrence = Math.trunc(finite(input.occurrence, 'occurrence', { min: 1 }));
    if (input.seed !== undefined) {
      if (!['string', 'number'].includes(typeof input.seed) || String(input.seed).length === 0) {
        fail('invalid-seed', 'seed must be a non-empty string or finite number');
      }
      if (typeof input.seed === 'number' && !Number.isFinite(input.seed)) fail('invalid-seed', 'seed must be finite');
      result.seed = input.seed;
    }
    if (input.style !== undefined) result.style = normalizePresenterStyle(input.style);
    if (input.gestureId !== undefined) result.gestureId = text(input.gestureId, 'gestureId');
    if (input.cueTimeMs !== undefined) result.cueTimeMs = finite(input.cueTimeMs, 'cueTimeMs');
    if (input.mediaTimeMs !== undefined) result.mediaTimeMs = finite(input.mediaTimeMs, 'mediaTimeMs');
  } else if (type === 'media') {
    result.mediaId = text(input.mediaId, 'mediaId');
    result.mode = String(input.mode || 'short-muted-montage');
    if (!MEDIA_MODES.has(result.mode)) fail('invalid-media-mode', `unsupported media mode "${result.mode}"`);
    if (input.startMs !== undefined) result.startMs = finite(input.startMs, 'startMs');
    if (input.endMs !== undefined) result.endMs = finite(input.endMs, 'endMs');
    if (result.endMs !== undefined && result.startMs !== undefined && result.endMs <= result.startMs) {
      fail('invalid-media-range', 'endMs must be greater than startMs');
    }
  }

  return Object.freeze(result);
}

export function createShowEvent(directive, options = {}) {
  let normalized = normalizeShowDirective(directive);
  let sequence = Math.trunc(finite(options.sequence ?? 0, 'sequence'));
  let timestampMs = finite(options.timestampMs ?? 0, 'timestampMs');
  return Object.freeze({
    version: SHOW_CONTRACT_VERSION,
    type: `show:${normalized.type}`,
    sequence,
    timestampMs,
    directive: normalized,
  });
}
