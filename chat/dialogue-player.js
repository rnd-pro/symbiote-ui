/**
 * Stateful dialogue player.
 *
 * Wraps a dialogue stage (see `dialogue-stage.js`) with transport controls —
 * play/pause/resume, next/prev/seek, and stop — over the same
 * `{ personas, turns }` timeline that `playDialogueTimeline` consumes. Where the
 * scheduler is a fire-and-forget run, this controller holds a cursor (`index`)
 * the host can steer, so a UI can drive playback like a media player.
 *
 * `onCue` fires at each turn's speak START (matching `playDialogueTimeline`).
 * `onIndexChange` fires whenever the cursor moves; `onStateChange` fires on
 * play, pause, resume, stop, and natural finish. Turns advance sequentially with
 * a fixed `defaultGapMs` between them — overlap/cross-talk stays the scheduler's
 * job. Node-safe at import time and against a non-browser stage, where `speak`
 * resolves immediately so playback still walks the timeline turn by turn.
 */

const DEFAULT_GAP_MS = 120;

function nonNegative(value, fallback) {
  let n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function clampIndex(index, total) {
  if (!Number.isFinite(index)) return 0;
  let i = Math.trunc(index);
  if (i < 0) return 0;
  if (i > total - 1) return Math.max(0, total - 1);
  return i;
}

/**
 * Create a transport controller over `stage` for `timeline`.
 *
 * @param {object} stage - a dialogue stage (`persona`, `speak`, `cancel`, `pause`, `resume`).
 * @param {object} timeline
 * @param {object} [timeline.personas] - `{ [id]: profile }`, registered up front.
 * @param {Array} [timeline.turns] - `{ persona, text, cue? }`.
 * @param {object} [options]
 * @param {(cue:any, turn:object, index:number) => void} [options.onCue] - fired at each turn's speak start.
 * @param {(index:number) => void} [options.onIndexChange] - fired whenever the cursor moves.
 * @param {(state:string) => void} [options.onStateChange] - 'playing' | 'paused' | 'stopped' | 'finished'.
 * @param {number} [options.defaultGapMs=120] - gap between sequential turns.
 * @returns {object} controller (see the shared contract).
 */
export function createDialoguePlayer(stage, timeline, options = {}) {
  let { onCue, onIndexChange, onStateChange, defaultGapMs } = options;
  let personas = timeline?.personas || {};
  let turns = Array.isArray(timeline?.turns) ? timeline.turns : [];
  let baseGap = nonNegative(defaultGapMs, DEFAULT_GAP_MS);
  let total = turns.length;

  if (stage && typeof stage.persona === 'function') {
    for (let [id, profile] of Object.entries(personas)) {
      stage.persona(id, profile || {});
    }
  }

  let index = 0;
  // Idle: not started or finished/stopped. Playing: a turn is speaking or the
  // gap is pending. Paused: held mid-utterance or mid-gap.
  let state = 'idle';
  let gapTimer = null;
  // Set to the active run token when an advance is requested while paused (the
  // current turn ended during a pause); `resume()` replays it.
  let pendingAdvance = null;
  // Generation token: bumped on every cancel/seek/stop so a stale speak end or
  // gap callback from a superseded turn cannot advance the cursor.
  let run = 0;

  let resolveDone;
  let done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  function emitState(next) {
    state = next;
    let cb = controller.onStateChange;
    if (typeof cb === 'function') {
      try {
        cb(next);
      } catch (_) {}
    }
  }

  function emitIndex() {
    let cb = controller.onIndexChange;
    if (typeof cb === 'function') {
      try {
        cb(index);
      } catch (_) {}
    }
  }

  function clearGap() {
    if (gapTimer !== null) {
      clearTimeout(gapTimer);
      gapTimer = null;
    }
  }

  /** Stop any in-flight speech and pending gap, invalidating their callbacks. */
  function halt() {
    run += 1;
    pendingAdvance = null;
    clearGap();
    if (stage && typeof stage.cancel === 'function') {
      try {
        stage.cancel();
      } catch (_) {}
    }
  }

  function finish() {
    halt();
    emitState('finished');
    resolveDone();
  }

  // Speak turn `index`, firing its cue at speak start. When it ends (and this
  // run is still current and playing), schedule the next turn after the gap, or
  // finish at the end of the timeline.
  function speakCurrent() {
    if (total === 0) {
      finish();
      return;
    }

    let token = run;
    let turn = turns[index];
    let cued = false;
    let fireCue = () => {
      if (cued) return;
      cued = true;
      let cb = controller.onCue;
      if (typeof cb === 'function') {
        try {
          cb(turn?.cue, turn, index);
        } catch (_) {}
      }
    };

    let speakPromise = Promise.resolve(
      stage && typeof stage.speak === 'function'
        ? stage.speak(turn?.persona, turn?.text, { onStart: fireCue })
        : undefined,
    ).catch(() => {});

    // Non-browser stages resolve without an `onStart` callback; guarantee one cue.
    speakPromise.then(() => {
      if (token !== run) return;
      fireCue();
    });

    speakPromise.then(() => {
      // Superseded by next/prev/seek/stop — the new owner drives.
      if (token !== run) return;
      // Paused while (or just before) this turn ended: hold the advance until
      // resume() instead of dropping it.
      if (state === 'paused') {
        pendingAdvance = token;
        return;
      }
      if (state !== 'playing') return;
      scheduleAdvance(token);
    });
  }

  // After a turn ends, finish at the timeline's end or move to the next turn
  // after the gap. Pausing during the gap re-defers through `pendingAdvance`.
  function scheduleAdvance(token) {
    if (token !== run) return;

    if (index >= total - 1) {
      finish();
      return;
    }

    gapTimer = setTimeout(() => {
      gapTimer = null;
      if (token !== run) return;
      if (state === 'paused') {
        pendingAdvance = token;
        return;
      }
      if (state !== 'playing') return;
      index += 1;
      emitIndex();
      speakCurrent();
    }, baseGap);
  }

  /** Move the cursor to `target` and speak it, cancelling anything in flight. */
  function gotoAndSpeak(target) {
    let next = clampIndex(target, total);
    halt();
    let changed = next !== index;
    index = next;
    if (changed) emitIndex();
    emitState('playing');
    speakCurrent();
  }

  let controller = {
    // Event handlers are settable so a UI can (re)bind after construction, not
    // only pass them via options at creation time. Initialized from options here.
    onCue,
    onIndexChange,
    onStateChange,

    /** Start from the current cursor, or resume if paused. */
    play() {
      if (state === 'paused') {
        controller.resume();
        return controller;
      }
      if (state === 'playing') return controller;
      if (total === 0) {
        finish();
        return controller;
      }
      emitState('playing');
      speakCurrent();
      return controller;
    },

    /** Hold the current utterance; no auto-advance while paused. */
    pause() {
      if (state !== 'playing') return controller;
      // An in-flight gap means the turn already ended; convert it to a pending
      // advance so resume() continues to the next turn instead of losing it.
      if (gapTimer !== null) {
        clearGap();
        pendingAdvance = run;
      }
      if (stage && typeof stage.pause === 'function') {
        try {
          stage.pause();
        } catch (_) {}
      }
      emitState('paused');
      return controller;
    },

    /** Resume after pause. Replays an advance deferred while paused. */
    resume() {
      if (state !== 'paused') return controller;
      if (stage && typeof stage.resume === 'function') {
        try {
          stage.resume();
        } catch (_) {}
      }
      emitState('playing');
      if (pendingAdvance === run) {
        let token = pendingAdvance;
        pendingAdvance = null;
        scheduleAdvance(token);
      }
      return controller;
    },

    /** Pause if playing, else play/resume. */
    toggle() {
      if (state === 'playing') controller.pause();
      else controller.play();
      return controller;
    },

    /** Stop the current speech and speak the next turn (clamped at the end). */
    next() {
      gotoAndSpeak(index + 1);
      return controller;
    },

    /** Stop the current speech and speak the previous turn (clamped at 0). */
    prev() {
      gotoAndSpeak(index - 1);
      return controller;
    },

    /** Jump to turn `i` and speak it. */
    seek(i) {
      gotoAndSpeak(i);
      return controller;
    },

    /** Stop playback, reset to index 0, and resolve `done`. */
    stop() {
      halt();
      let changed = index !== 0;
      index = 0;
      if (changed) emitIndex();
      emitState('stopped');
      resolveDone();
      return controller;
    },

    get index() {
      return index;
    },

    get total() {
      return total;
    },

    get isPlaying() {
      return state === 'playing';
    },

    get isPaused() {
      return state === 'paused';
    },

    done,
  };

  return controller;
}
