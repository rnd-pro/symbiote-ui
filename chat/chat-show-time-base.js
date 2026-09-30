// Chat Show progress time base.
//
// The player projects its clock, its segmented bar and its seek coordinate from
// the host-owned timeline. Two coordinate systems exist, and the timeline itself
// selects between them:
//
// - duration-weighted (legacy): the turns tile one contiguous clock, so elapsed
//   time is the sum of the durations before the current turn plus the position
//   inside it. Correct whenever the host plays every turn it lists.
// - host-absolute composition (opt-in): every turn carries `startMs` on the
//   host's own composition clock. A host that SKIPS part of a longer
//   composition — a short mode that plays only the scene turns of a scene plus
//   detail-branch master — must still show that composition's clock and stay
//   seekable on it, so the unplayed span is a gap instead of a shorter total.
//
// The absolute base is opt-in and additive: turns without a finite non-negative
// `startMs` keep the legacy projection unchanged. Pure and node-safe, so the
// mapping is unit-testable without a DOM; `ChatShowPlayer` re-exports it.

const WEIGHTED_MODE = 'weighted';
const ABSOLUTE_MODE = 'absolute';

// `Number()` alone reads a missing, nullish or blank field as 0, which would
// silently opt a legacy timeline into the absolute time base.
function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  let numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function clampChatShowProgress(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function clampMs(value, upperMs) {
  let numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(upperMs, Math.max(0, numeric));
}

function endMsOf(turn) {
  return turn.startMs + turn.durationMs;
}

function formatClock(valueMs) {
  let totalSeconds = Math.max(0, Math.floor(Number(valueMs) / 1_000 || 0));
  let seconds = totalSeconds % 60;
  let totalMinutes = Math.floor(totalSeconds / 60);
  let minutes = totalMinutes % 60;
  let hours = Math.floor(totalMinutes / 60);
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// Accepts a resolved geometry, a host timeline, or a bare turn list, so a caller
// never has to re-derive which clock it is holding. A resolved geometry always
// carries its own `mode`, which is why re-resolving one can never silently
// reinterpret weighted turns as composition turns.
function toGeometry(source) {
  if (Array.isArray(source)) return resolveChatShowTimelineGeometry({ turns: source });
  if (source && typeof source === 'object' && typeof source.mode === 'string') return source;
  return resolveChatShowTimelineGeometry(source);
}

export function resolveChatShowTimelineGeometry(timeline) {
  let source = Array.isArray(timeline?.turns) ? timeline.turns : [];
  let durations = source.map((turn) => Number(turn?.durationMs));
  let seekable = source.length > 0
    && durations.every((durationMs) => Number.isFinite(durationMs) && durationMs > 0);
  let starts = source.map((turn) => finiteNumber(turn?.startMs));
  let absolute = seekable && starts.every((startMs) => startMs !== null && startMs >= 0);

  if (absolute) {
    let turns = source.map((_, index) => ({ startMs: starts[index], durationMs: durations[index] }));
    let computedTotalMs = turns.reduce(
      (latest, turn) => Math.max(latest, turn.startMs + turn.durationMs),
      0,
    );
    let declaredTotalMs = finiteNumber(timeline?.totalMs);
    return {
      mode: ABSOLUTE_MODE,
      turns,
      // A declared total wins, so a host can show a composition whose tail (or
      // head) carries no turn; a missing or zero declaration keeps the last end.
      totalMs: declaredTotalMs !== null && declaredTotalMs > 0 ? declaredTotalMs : computedTotalMs,
      seekable: true,
    };
  }

  // Weighted turns carry the accumulated duration prefix, the legacy contiguous
  // coordinate. It is only meaningful when the durations are usable, and it
  // exists for shape symmetry with the absolute base, never for gap logic.
  let turns = [];
  for (let index = 0; index < durations.length; index += 1) {
    turns.push({
      startMs: index > 0 ? turns[index - 1].startMs + durations[index - 1] : 0,
      durationMs: durations[index],
    });
  }
  return {
    mode: WEIGHTED_MODE,
    turns,
    totalMs: seekable ? durations.reduce((total, durationMs) => total + durationMs, 0) : 0,
    seekable,
  };
}

function resolveFillFraction(state, durationMs, caption) {
  let progress = state?.progress && typeof state.progress === 'object' ? state.progress : {};
  let positionMs = Number(progress.positionMs);
  if (Number.isFinite(positionMs) && Number.isFinite(durationMs) && durationMs > 0) {
    return positionMs / durationMs;
  }
  let fraction = Number(progress.fraction);
  if (Number.isFinite(fraction)) return fraction;
  let activeWordIndex = Number(caption.activeWordIndex ?? caption.wordIndex ?? -1);
  let words = Array.isArray(caption.words) ? caption.words : [];
  return activeWordIndex >= 0 && words.length ? (activeWordIndex + 1) / words.length : 0;
}

function resolveWeightedProgress(geometry, index, state = {}, caption = {}) {
  let source = geometry.turns;
  let weights = geometry.seekable ? source.map(({ durationMs }) => durationMs) : source.map(() => 1);
  let fraction = resolveFillFraction(state, source[index]?.durationMs, caption);
  if (state?.state === 'completed' && index === source.length - 1) fraction = 1;
  fraction = clampChatShowProgress(fraction);
  let totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let completedWeight = weights.slice(0, Math.max(0, index))
    .reduce((total, weight) => total + weight, 0);
  let currentWeight = index >= 0 ? weights[index] || 0 : 0;
  let overall = totalWeight ? (completedWeight + currentWeight * fraction) / totalWeight : 0;
  let elapsedMs = geometry.seekable ? completedWeight + currentWeight * fraction : 0;
  let totalMs = geometry.totalMs;
  return {
    now: Math.round(clampChatShowProgress(overall) * 100),
    value: Math.round(elapsedMs / 1_000),
    max: Math.max(0, Math.round(totalMs / 1_000)),
    text: `${index < 0 ? 0 : index + 1} / ${source.length} · ${formatClock(elapsedMs)} / ${formatClock(totalMs)}`,
    elapsedLabel: formatClock(elapsedMs),
    totalLabel: formatClock(totalMs),
    elapsedMs,
    totalMs,
    seekable: geometry.seekable,
    segments: weights.map((weight, segmentIndex) => {
      let fill = segmentIndex < index ? 1 : segmentIndex === index ? fraction : 0;
      return {
        style: `--chat-show-progress-weight:${weight};--chat-show-progress-fill:${fill}`,
      };
    }),
  };
}

// The unplayed composition span immediately before each turn. The first turn
// always reports zero, and a turn the previous one overlaps never reports a
// negative gap.
function resolveGaps(turns) {
  let gaps = turns.map(() => 0);
  let previousEndMs = 0;
  for (let index = 1; index < turns.length; index += 1) {
    previousEndMs = Math.max(previousEndMs, endMsOf(turns[index - 1]));
    gaps[index] = Math.max(0, turns[index].startMs - previousEndMs);
  }
  return gaps;
}

function resolveAbsoluteProgress(geometry, index, state = {}, caption = {}) {
  let source = geometry.turns;
  let current = source[index];
  let fraction = resolveFillFraction(state, current?.durationMs, caption);
  if (state?.state === 'completed' && index === source.length - 1) fraction = 1;
  fraction = clampChatShowProgress(fraction);
  let totalMs = geometry.totalMs;
  // The per-segment fill stays the turn-local fraction so a segment never
  // claims the gap in front of it, while the clock itself reads the host's
  // composition time: the turn's own start plus the clamped position in it.
  let elapsedMs = current
    ? current.startMs + clampMs(state?.progress?.positionMs, current.durationMs)
    : 0;
  let overall = totalMs > 0 ? clampChatShowProgress(elapsedMs / totalMs) : 0;
  let gaps = resolveGaps(source);
  return {
    now: Math.round(overall * 100),
    value: Math.round(elapsedMs / 1_000),
    max: Math.max(0, Math.round(totalMs / 1_000)),
    text: `${index < 0 ? 0 : index + 1} / ${source.length} · ${formatClock(elapsedMs)} / ${formatClock(totalMs)}`,
    elapsedLabel: formatClock(elapsedMs),
    totalLabel: formatClock(totalMs),
    elapsedMs,
    totalMs,
    seekable: geometry.seekable,
    segments: source.map((turn, segmentIndex) => {
      let fill = segmentIndex < index ? 1 : segmentIndex === index ? fraction : 0;
      let gapPercent = totalMs > 0 ? (gaps[segmentIndex] / totalMs) * 100 : 0;
      return {
        style: `--chat-show-progress-weight:${turn.durationMs};--chat-show-progress-fill:${fill};--chat-show-progress-gap:${gapPercent}`,
      };
    }),
  };
}

export function resolveChatShowProgress(source, index, state = {}, caption = {}) {
  let geometry = toGeometry(source);
  return geometry.mode === ABSOLUTE_MODE
    ? resolveAbsoluteProgress(geometry, index, state, caption)
    : resolveWeightedProgress(geometry, index, state, caption);
}

function resolveWeightedPosition(geometry, requestedMs) {
  let durations = geometry.turns.map(({ durationMs }) => durationMs);
  let totalMs = geometry.totalMs;
  let absoluteMs = Math.min(totalMs, Math.max(0, Number(requestedMs) || 0));
  let elapsedMs = 0;
  for (let index = 0; index < durations.length; index += 1) {
    let durationMs = durations[index];
    if (absoluteMs < elapsedMs + durationMs || index === durations.length - 1) {
      return {
        index,
        positionMs: Math.min(durationMs, Math.max(0, absoluteMs - elapsedMs)),
        absoluteMs,
        totalMs,
      };
    }
    elapsedMs += durationMs;
  }
  return null;
}

function resolveAbsolutePosition(geometry, requestedMs) {
  let turns = geometry.turns;
  let totalMs = geometry.totalMs;
  let absoluteMs = Math.min(totalMs, Math.max(0, Number(requestedMs) || 0));
  for (let index = 0; index < turns.length; index += 1) {
    let turn = turns[index];
    if (absoluteMs >= turn.startMs && absoluteMs < endMsOf(turn)) {
      return {
        index,
        positionMs: Math.min(turn.durationMs, absoluteMs - turn.startMs),
        absoluteMs,
        totalMs,
        snapped: false,
        gapMs: 0,
      };
    }
  }
  // The request landed on a composition span no turn covers. Resume at the next
  // turn that continues the composition clock; a request past the last turn
  // falls back to that turn's end, which is where playback already stands.
  let gaps = resolveGaps(turns);
  let next = turns.findIndex((turn) => turn.startMs > absoluteMs);
  if (next >= 0) {
    return {
      index: next,
      positionMs: 0,
      absoluteMs,
      totalMs,
      snapped: true,
      gapMs: gaps[next],
    };
  }
  let lastIndex = turns.length - 1;
  let resolvedMs = endMsOf(turns[lastIndex]);
  return {
    index: lastIndex,
    positionMs: turns[lastIndex].durationMs,
    absoluteMs,
    totalMs,
    snapped: absoluteMs > resolvedMs,
    gapMs: Math.max(0, absoluteMs - resolvedMs),
  };
}

export function resolveChatShowTimelinePosition(source, requestedMs) {
  let geometry = toGeometry(source);
  if (!geometry.seekable) return null;
  return geometry.mode === ABSOLUTE_MODE
    ? resolveAbsolutePosition(geometry, requestedMs)
    : resolveWeightedPosition(geometry, requestedMs);
}
