import {
  createPresenterKinematicPlan,
  PRESENTER_KINEMATIC_LIMITS,
  samplePresenterKinematicPlan,
} from './presenter-kinematics.js';

export const PRESENTER_TEXT_SELECTION_RECEIPT_VERSION = 'presenter-text-selection-receipt-v2';
export const PRESENTER_TEXT_SELECTION_MATCH_MODES = Object.freeze(['exact', 'normalized']);

const MATCH_MODE_SET = new Set(PRESENTER_TEXT_SELECTION_MATCH_MODES);
const DIRECTION_SET = new Set(['forward', 'backward', 'none']);
const EXCLUDED_TEXT_PARENTS = new Set(['script', 'style', 'template', 'noscript']);

export class PresenterTextSelectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PresenterTextSelectionError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new PresenterTextSelectionError(code, message, details);
}

function integer(value, name, { min = 0, optional = false } = {}) {
  if (value === undefined && optional) return undefined;
  if (!Number.isInteger(value) || value < min) {
    fail('invalid-parameters', `${name} must be an integer greater than or equal to ${min}`);
  }
  return value;
}

function selectionOptions(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('invalid-parameters', 'text selection parameters must be an object');
  }
  let matchMode = String(value.matchMode || 'exact').trim().toLowerCase();
  if (!MATCH_MODE_SET.has(matchMode)) {
    fail('invalid-parameters', `unsupported text selection match mode "${matchMode}"`);
  }
  let direction = String(value.direction || 'forward').trim().toLowerCase();
  if (!DIRECTION_SET.has(direction)) {
    fail('invalid-parameters', `unsupported text selection direction "${direction}"`);
  }
  let quote = value.quote === undefined ? '' : String(value.quote);
  let startOffset = integer(value.startOffset, 'startOffset', { optional: true });
  let endOffset = integer(value.endOffset, 'endOffset', { optional: true });
  if ((startOffset === undefined) !== (endOffset === undefined)) {
    fail('invalid-parameters', 'startOffset and endOffset must be supplied together');
  }
  if (startOffset === undefined && !quote.trim()) {
    fail('invalid-parameters', 'quote or an explicit offset range is required');
  }
  let occurrence = integer(value.occurrence, 'occurrence', { min: 1, optional: true });
  return { quote, occurrence, matchMode, direction, startOffset, endOffset };
}

function normalizedProjection(value, mode) {
  let source = String(value || '');
  if (mode === 'exact') {
    return {
      text: source,
      starts: Array.from({ length: source.length }, (_, index) => index),
      ends: Array.from({ length: source.length }, (_, index) => index + 1),
    };
  }

  let text = '';
  let starts = [];
  let ends = [];
  let whitespaceStart = -1;
  let whitespaceEnd = -1;
  for (let index = 0; index < source.length; index += 1) {
    let character = source[index];
    if (/\s/u.test(character)) {
      if (text && whitespaceStart < 0) whitespaceStart = index;
      whitespaceEnd = index + 1;
      continue;
    }
    if (whitespaceStart >= 0) {
      text += ' ';
      starts.push(whitespaceStart);
      ends.push(whitespaceEnd);
      whitespaceStart = -1;
      whitespaceEnd = -1;
    }
    text += character;
    starts.push(index);
    ends.push(index + 1);
  }
  return { text, starts, ends };
}

function quoteMatches(source, options) {
  let { quote, occurrence, matchMode, startOffset, endOffset } = options;
  if (startOffset !== undefined) {
    if (endOffset <= startOffset || endOffset > source.length) {
      fail('invalid-range', 'text selection offsets must describe a nonempty range inside the target', {
        startOffset,
        endOffset,
        sourceLength: source.length,
      });
    }
    let selectedText = source.slice(startOffset, endOffset);
    if (quote.trim()) {
      let selectedProjection = normalizedProjection(selectedText, matchMode).text;
      let quoteProjection = normalizedProjection(quote, matchMode).text;
      if (selectedProjection !== quoteProjection) {
        fail('range-mismatch', 'the explicit range does not match the requested quote', {
          startOffset,
          endOffset,
        });
      }
    }
    return { startOffset, endOffset, selectedText, occurrence: occurrence || 1, matchCount: 1 };
  }

  let sourceProjection = normalizedProjection(source, matchMode);
  let needle = normalizedProjection(quote, matchMode).text;
  if (!needle) fail('invalid-parameters', 'quote must contain selectable text');
  let matches = [];
  let cursor = 0;
  while (cursor <= sourceProjection.text.length - needle.length) {
    let matchIndex = sourceProjection.text.indexOf(needle, cursor);
    if (matchIndex < 0) break;
    matches.push({
      startOffset: sourceProjection.starts[matchIndex],
      endOffset: sourceProjection.ends[matchIndex + needle.length - 1],
    });
    cursor = matchIndex + 1;
  }
  if (!matches.length) fail('quote-not-found', 'the requested quote is absent from the selection target');
  if (occurrence === undefined && matches.length > 1) {
    fail('quote-ambiguous', 'the requested quote occurs more than once; occurrence is required', {
      matchCount: matches.length,
    });
  }
  let selectedOccurrence = occurrence || 1;
  let selected = matches[selectedOccurrence - 1];
  if (!selected) {
    fail('occurrence-out-of-range', 'the requested quote occurrence is absent from the selection target', {
      occurrence: selectedOccurrence,
      matchCount: matches.length,
    });
  }
  return {
    ...selected,
    selectedText: source.slice(selected.startOffset, selected.endOffset),
    occurrence: selectedOccurrence,
    matchCount: matches.length,
  };
}

function isTextControl(target) {
  return typeof target?.value === 'string' && typeof target?.setSelectionRange === 'function';
}

function focusTarget(target) {
  if (typeof target?.focus !== 'function') return;
  try {
    target.focus({ preventScroll: true });
  } catch {
    target.focus();
  }
}

function textRuns(root) {
  let runs = [];
  let text = '';
  function visit(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      let value = String(node.data ?? node.nodeValue ?? '');
      if (!value) return;
      let start = text.length;
      text += value;
      runs.push({ node, start, end: text.length, length: value.length });
      return;
    }
    let localName = String(node.localName || '').toLowerCase();
    if (EXCLUDED_TEXT_PARENTS.has(localName)) return;
    for (let child of Array.from(node.childNodes || [])) visit(child);
  }
  visit(root);
  return { runs, text };
}

function rangeBoundary(runs, offset, edge) {
  if (!runs.length) fail('empty-target', 'the selection target contains no text nodes');
  if (edge === 'start') {
    let run = runs.find((item) => offset >= item.start && offset < item.end) || runs[runs.length - 1];
    return { node: run.node, offset: Math.max(0, Math.min(run.length, offset - run.start)) };
  }
  let run = runs.find((item) => offset > item.start && offset <= item.end) || runs[0];
  return { node: run.node, offset: Math.max(0, Math.min(run.length, offset - run.start)) };
}

function selectionFor(doc) {
  let selection = doc?.defaultView?.getSelection?.() || doc?.getSelection?.();
  if (!selection
    || typeof selection.removeAllRanges !== 'function'
    || typeof selection.addRange !== 'function') {
    fail('selection-unsupported', 'the document does not expose the Selection API');
  }
  return selection;
}

function priorRanges(selection) {
  let ranges = [];
  for (let index = 0; index < Number(selection.rangeCount || 0); index += 1) {
    let range = selection.getRangeAt(index);
    ranges.push(typeof range.cloneRange === 'function' ? range.cloneRange() : range);
  }
  return ranges;
}

function selectionHandle(receipt, clearSelection, restoreSelection) {
  let state = 'active';
  return Object.freeze({
    receipt: Object.freeze(receipt),
    clear() {
      clearSelection();
      state = 'cleared';
      return this.receipt;
    },
    restore() {
      restoreSelection();
      state = 'restored';
      return this.receipt;
    },
    get state() {
      return state;
    },
  });
}

function receipt(kind, match, options) {
  return {
    version: PRESENTER_TEXT_SELECTION_RECEIPT_VERSION,
    status: 'selected',
    kind,
    matchMode: options.matchMode,
    direction: options.direction,
    occurrence: match.occurrence,
    matchCount: match.matchCount,
    startOffset: match.startOffset,
    endOffset: match.endOffset,
    selectedText: match.selectedText,
  };
}

function selectControlText(target, options) {
  let match = quoteMatches(target.value, options);
  let previous = {
    start: Number.isInteger(target.selectionStart) ? target.selectionStart : 0,
    end: Number.isInteger(target.selectionEnd) ? target.selectionEnd : 0,
    direction: DIRECTION_SET.has(target.selectionDirection) ? target.selectionDirection : 'none',
  };
  focusTarget(target);
  try {
    target.setSelectionRange(match.startOffset, match.endOffset, options.direction);
  } catch (error) {
    fail('selection-unsupported', 'the target control does not support text range selection', {
      cause: error?.name || 'Error',
    });
  }
  return selectionHandle(
    receipt('control', match, options),
    () => target.setSelectionRange(match.endOffset, match.endOffset, 'none'),
    () => target.setSelectionRange(previous.start, previous.end, previous.direction),
  );
}

function selectDomText(target, options) {
  let doc = target?.ownerDocument;
  if (!doc || typeof doc.createRange !== 'function') {
    fail('range-unsupported', 'the target document does not expose the Range API');
  }
  let selection = selectionFor(doc);
  let previous = priorRanges(selection);
  focusTarget(target);
  let flattened = textRuns(target);
  let match = quoteMatches(flattened.text, options);
  let start = rangeBoundary(flattened.runs, match.startOffset, 'start');
  let end = rangeBoundary(flattened.runs, match.endOffset, 'end');
  let range = doc.createRange();
  if (typeof range.setStart !== 'function' || typeof range.setEnd !== 'function') {
    fail('range-unsupported', 'the target document Range cannot set text boundaries');
  }
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  selection.removeAllRanges();
  selection.addRange(range);

  return selectionHandle(
    receipt('dom-range', match, options),
    () => selection.removeAllRanges(),
    () => {
      selection.removeAllRanges();
      for (let previousRange of previous) selection.addRange(previousRange);
    },
  );
}

export function applyPresenterTextSelection(target, parameters = {}) {
  if (!target || typeof target !== 'object') {
    fail('invalid-target', 'text selection requires a DOM or text-control target');
  }
  let requested = parameters;
  if (
    parameters?.quote === undefined
    && parameters?.startOffset === undefined
    && parameters?.endOffset === undefined
  ) {
    let text = isTextControl(target) ? String(target.value || '') : textRuns(target).text;
    requested = { ...parameters, startOffset: 0, endOffset: text.length };
  }
  let options = selectionOptions(requested);
  return isTextControl(target)
    ? selectControlText(target, options)
    : selectDomText(target, options);
}

function selectionDistancePx(target, receipt, measurementRange = null) {
  let selectedLength = Math.max(1, receipt.endOffset - receipt.startOffset);
  if (receipt.kind === 'control') {
    let rect = target?.getBoundingClientRect?.();
    let width = Number(rect?.width);
    if (Number.isFinite(width) && width > 0) {
      return Math.max(8, width * selectedLength / Math.max(1, String(target.value || '').length));
    }
  } else {
    let rects = Array.from(measurementRange?.getClientRects?.() || []);
    let measured = rects.reduce((total, rect) => total + Math.max(0, Number(rect.width) || 0), 0);
    if (measured > 0) return measured;
    let width = Number(measurementRange?.getBoundingClientRect?.()?.width);
    if (Number.isFinite(width) && width > 0) return width;
  }
  return selectedLength * 8;
}

function selectionTargetRect(target) {
  let source = target?.getBoundingClientRect?.();
  if (!source) return null;
  let result = {};
  for (let field of ['left', 'top', 'right', 'bottom', 'width', 'height']) {
    let value = Number(source[field]);
    if (Number.isFinite(value)) result[field] = value;
  }
  return Object.keys(result).length ? Object.freeze(result) : null;
}

function selectionCursor(target, offsets, sourceLength, direction, range = null) {
  if (range && typeof range.getClientRects === 'function') {
    let rects = Array.from(range.getClientRects() || []).filter((rect) => [
      rect?.left,
      rect?.right,
      rect?.bottom,
    ].every((value) => Number.isFinite(Number(value))));
    let endpoint = direction === 'backward' ? rects[0] : rects.at(-1);
    if (endpoint) {
      return Object.freeze({
        x: Number(direction === 'backward' ? endpoint.left : endpoint.right),
        y: Number(endpoint.bottom),
        visible: true,
      });
    }
  }

  let rect = selectionTargetRect(target);
  if (!rect) return null;
  let length = Math.max(1, Number(sourceLength) || 0);
  let activeOffset = direction === 'backward' ? offsets.start : offsets.end;
  let progress = Math.min(1, Math.max(0, activeOffset / length));
  return Object.freeze({
    x: Number(rect.left || 0) + Number(rect.width || 0) * progress,
    y: Number.isFinite(Number(rect.bottom))
      ? Number(rect.bottom)
      : Number(rect.top || 0) + Number(rect.height || 0),
    visible: true,
  });
}

function selectionKinematicStyle(style, distancePx) {
  let source = style && typeof style === 'object' && !Array.isArray(style)
    ? { ...style }
    : {};
  let authoredMinimum = Number(source.minDurationMs);
  let minimumDurationMs = Number.isFinite(authoredMinimum) && authoredMinimum > 0
    ? authoredMinimum
    : PRESENTER_KINEMATIC_LIMITS.minDurationMs;
  // Minimum-jerk motion peaks at 1.875 × average speed. Cap the
  // perceptual floor so even short selections reach the shared moving-speed minimum.
  let minimumSpeedDurationCap = 1.875 * distancePx
    / PRESENTER_KINEMATIC_LIMITS.minMovingSpeedPxPerMs;
  source.minDurationMs = Math.max(1, Math.min(minimumDurationMs, minimumSpeedDurationCap));
  return source;
}

function animatedReceipt(receipt, sample, plan, cursor = null) {
  return Object.freeze({
    ...receipt,
    presented: true,
    planVersion: plan.version,
    status: sample.progress >= 1 ? 'selected' : 'selecting',
    elapsedMs: sample.elapsedMs,
    durationMs: plan.durationMs,
    progress: sample.progress,
    distancePx: sample.distancePx,
    speedPxPerMs: sample.speedPxPerMs,
    normalizedPathHash: plan.normalizedPathHash,
    ...(cursor ? { cursor } : {}),
    timing: Object.freeze({
      arcLengthPx: plan.arcLengthPx,
      durationMs: plan.durationMs,
      maxObservedSpeedPxPerMs: plan.maxObservedSpeedPxPerMs,
      maxSpeedPxPerMs: plan.limits.maxSpeedPxPerMs,
    }),
  });
}

function progressiveOffsets(receipt, progress) {
  let length = receipt.endOffset - receipt.startOffset;
  let visibleLength = Math.min(length, Math.max(0, Math.round(length * progress)));
  if (receipt.direction === 'backward') {
    return { start: receipt.endOffset - visibleLength, end: receipt.endOffset };
  }
  return { start: receipt.startOffset, end: receipt.startOffset + visibleLength };
}

/**
 * Creates a cancelable presenter selection whose frames progressively extend
 * the browser's real Selection/Range (or text-control selection). The caller
 * owns the clock and calls presentFrame(elapsedMs); no timestamp is invented.
 * Duration is derived from measured selection travel, never supplied by the consumer.
 */
export function createPresenterTextSelectionAnimation(target, parameters = {}) {
  if (!target || typeof target !== 'object') {
    fail('invalid-target', 'text selection requires a DOM or text-control target');
  }
  let requested = parameters;
  if (
    parameters?.quote === undefined
    && parameters?.startOffset === undefined
    && parameters?.endOffset === undefined
  ) {
    let text = isTextControl(target) ? String(target.value || '') : textRuns(target).text;
    requested = { ...parameters, startOffset: 0, endOffset: text.length };
  }
  let options = selectionOptions(requested);
  let kind = isTextControl(target) ? 'control' : 'dom-range';
  let source;
  let match;
  let previous;
  let measurementRange = null;
  let applyOffsets;
  let measureCursor;
  let clearSelection;
  let restoreSelection;

  if (kind === 'control') {
    source = String(target.value || '');
    match = quoteMatches(source, options);
    previous = {
      start: Number.isInteger(target.selectionStart) ? target.selectionStart : 0,
      end: Number.isInteger(target.selectionEnd) ? target.selectionEnd : 0,
      direction: DIRECTION_SET.has(target.selectionDirection) ? target.selectionDirection : 'none',
    };
    applyOffsets = ({ start, end }) => {
      target.setSelectionRange(start, end, options.direction);
      return null;
    };
    measureCursor = (offsets) => selectionCursor(
      target,
      offsets,
      source.length,
      options.direction,
    );
    clearSelection = () => target.setSelectionRange(match.endOffset, match.endOffset, 'none');
    restoreSelection = () => target.setSelectionRange(previous.start, previous.end, previous.direction);
  } else {
    let doc = target?.ownerDocument;
    if (!doc || typeof doc.createRange !== 'function') {
      fail('range-unsupported', 'the target document does not expose the Range API');
    }
    let selection = selectionFor(doc);
    previous = priorRanges(selection);
    let flattened = textRuns(target);
    source = flattened.text;
    match = quoteMatches(source, options);
    let rangeFor = ({ start, end }) => {
      let startBoundary = rangeBoundary(flattened.runs, start, 'start');
      let endBoundary = rangeBoundary(flattened.runs, end, 'end');
      let range = doc.createRange();
      range.setStart(startBoundary.node, startBoundary.offset);
      range.setEnd(endBoundary.node, endBoundary.offset);
      return range;
    };
    measurementRange = rangeFor({ start: match.startOffset, end: match.endOffset });
    applyOffsets = (offsets) => {
      let range = rangeFor(offsets);
      selection.removeAllRanges();
      selection.addRange(range);
      return range;
    };
    measureCursor = (offsets, range = null) => selectionCursor(
      target,
      offsets,
      source.length,
      options.direction,
      range || rangeFor(offsets),
    );
    clearSelection = () => selection.removeAllRanges();
    restoreSelection = () => {
      selection.removeAllRanges();
      for (let previousRange of previous) selection.addRange(previousRange);
    };
  }

  let baseReceipt = receipt(kind, match, options);
  baseReceipt.targetRect = selectionTargetRect(target);
  let distancePx = selectionDistancePx(target, baseReceipt, measurementRange);
  let plan = createPresenterKinematicPlan({
    kind: 'underline',
    seed: parameters.seed ?? parameters.gestureId ?? `${baseReceipt.kind}:${baseReceipt.startOffset}:${baseReceipt.endOffset}`,
    style: selectionKinematicStyle(parameters.style, distancePx),
    noiseAmplitudePx: 0,
    pointAt: (progress) => ({ x: distancePx * progress, y: 0 }),
  });
  let lastOffsets = progressiveOffsets(baseReceipt, 0);
  let currentReceipt = animatedReceipt(
    baseReceipt,
    samplePresenterKinematicPlan(plan, 0),
    plan,
    measureCursor(lastOffsets),
  );
  let state = 'planned';
  let activated = false;
  return Object.freeze({
    get receipt() {
      return currentReceipt;
    },
    presentFrame(elapsedMs = 0) {
      let elapsed = Math.min(plan.durationMs, Math.max(0, Number(elapsedMs) || 0));
      if (!activated) {
        focusTarget(target);
        activated = true;
      }
      let sample = samplePresenterKinematicPlan(plan, elapsed);
      lastOffsets = progressiveOffsets(baseReceipt, sample.progress);
      let activeRange = applyOffsets(lastOffsets);
      currentReceipt = animatedReceipt(
        baseReceipt,
        sample,
        plan,
        measureCursor(lastOffsets, activeRange),
      );
      state = 'active';
      return currentReceipt;
    },
    refresh() {
      if (!activated) return currentReceipt;
      let activeRange = applyOffsets(lastOffsets);
      currentReceipt = Object.freeze({
        ...currentReceipt,
        cursor: measureCursor(lastOffsets, activeRange),
      });
      state = 'active';
      return currentReceipt;
    },
    clear() {
      if (activated) clearSelection();
      state = 'cleared';
      return currentReceipt;
    },
    restore() {
      if (activated) restoreSelection();
      state = 'restored';
      return currentReceipt;
    },
    get state() {
      return state;
    },
  });
}
