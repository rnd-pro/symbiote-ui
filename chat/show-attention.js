import { createPresenterTextSelectionAnimation } from './presenter-text-selection.js';
import { normalizePresenterSeed } from './presenter-kinematics.js';

export const SHOW_TRANSIENT_ATTENTION_MODES = Object.freeze(['frame', 'native-selection', 'click']);
export const SHOW_ATTENTION_ADMISSION_VERSION = 'show-attention-admission-v2';
export const SHOW_ATTENTION_MILESTONE_VERSION = 'show-attention-milestone-v2';
export const SHOW_ATTENTION_TERMINAL_VERSION = 'show-attention-terminal-v2';
export const SHOW_ATTENTION_PROVIDER_VERSION = 'show-attention-provider-v1';

const PLAN_RECT_FIELDS = Object.freeze(['targetRect', 'rect', 'drawRect', 'frameRect']);
const ADMISSION_REASON_MESSAGES = Object.freeze({
  'within-budget': 'the provider plan fits the explicit hard budget',
  'budget-exceeded': 'the provider plan exceeds the explicit hard budget',
  'invalid-budget': 'budgetMs must be a finite nonnegative number',
  'plan-unavailable': 'the provider did not return a finite planned duration',
  'provider-rejected': 'the provider rejected the zero-progress plan',
});

function immutableSerializable(value) {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => immutableSerializable(item)));
  }
  if (typeof value === 'object') {
    let result = {};
    for (let [key, item] of Object.entries(value)) {
      Object.defineProperty(result, key, {
        value: immutableSerializable(item),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return Object.freeze(result);
  }
  throw new TypeError('provider evidence must contain only serializable values');
}

function attentionError(code, message, details = null) {
  let error = new TypeError(message);
  error.code = code;
  if (details !== null) error.details = immutableSerializable(details);
  return error;
}

function providerFailureReason(error, fallbackCode) {
  let result = {};
  let code = typeof error?.code === 'string' && error.code ? error.code : fallbackCode;
  Object.defineProperty(result, 'code', {
    value: code,
    enumerable: true,
    configurable: true,
    writable: true,
  });
  if (error && typeof error === 'object') {
    for (let [key, value] of Object.entries(error)) {
      if (key === 'code') continue;
      Object.defineProperty(result, key, {
        value: immutableSerializable(value),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  if (!Object.hasOwn(result, 'name')) result.name = String(error?.name || 'Error');
  if (!Object.hasOwn(result, 'message')) result.message = String(error?.message || error);
  return immutableSerializable(result);
}

function providerOperationFailure(code, error) {
  return immutableSerializable({
    code,
    provider: providerFailureReason(error, 'provider-error'),
  });
}

function frozenRect(value) {
  if (!value || typeof value !== 'object') return null;
  let result = {};
  for (let field of ['left', 'top', 'right', 'bottom', 'width', 'height']) {
    let number = value[field];
    if (typeof number === 'number' && Number.isFinite(number)) result[field] = number;
  }
  return Object.keys(result).length ? Object.freeze(result) : null;
}

function planGeometry(plan = {}) {
  let result = {};
  for (let field of ['arcLengthPx', 'distancePx', 'startOffset', 'endOffset']) {
    let number = plan?.[field];
    if (typeof number === 'number' && Number.isFinite(number)) result[field] = number;
  }
  for (let field of ['matchMode', 'direction']) {
    if (plan?.[field] !== undefined) result[field] = String(plan[field]);
  }
  if (Number.isInteger(plan?.occurrence)) result.occurrence = plan.occurrence;
  for (let field of PLAN_RECT_FIELDS) {
    let rect = frozenRect(plan?.[field]);
    if (rect) result[field] = rect;
  }
  let hotspot = plan?.hotspot;
  if (Number.isFinite(hotspot?.x) && Number.isFinite(hotspot?.y)) {
    result.hotspot = Object.freeze({ x: hotspot.x, y: hotspot.y });
  }
  return immutableSerializable(result);
}

function stableIdentity(prefix, value) {
  let hash = normalizePresenterSeed(JSON.stringify(value)).toString(16).padStart(8, '0');
  return `${prefix}:${hash}`;
}

function opaqueIdentity(value) {
  if (value === undefined || value === null || value === '') return null;
  return String(value);
}

function providerReason(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'string') return Object.freeze({ code: value });
  if (typeof value !== 'object' || Array.isArray(value)) {
    return Object.freeze({ code: String(value) });
  }
  let exact = immutableSerializable(value);
  if (typeof exact.code === 'string' && exact.code) return exact;
  return Object.freeze({ ...exact, code: 'provider-rejected' });
}

function planRejectionReason(receipt) {
  let exact = providerReason(receipt?.reason || 'not-presented');
  let result = {};
  for (let [key, value] of Object.entries(exact)) {
    Object.defineProperty(result, key, {
      value,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(result, 'evidence', {
    value: immutableSerializable(receipt),
    enumerable: true,
    configurable: true,
    writable: true,
  });
  return immutableSerializable(result);
}

function admissionReason(code, exactProviderReason = null) {
  return Object.freeze({
    code,
    message: ADMISSION_REASON_MESSAGES[code],
    provider: exactProviderReason,
  });
}

function planMotion(plan, plannedDurationMs) {
  if (!plan || !Object.keys(plan).length) return null;
  let speed = {};
  for (let field of [
    'speedPxPerMs',
    'averageSpeedPxPerMs',
    'maxSpeedPxPerMs',
    'maxObservedSpeedPxPerMs',
  ]) {
    let value = Number(plan[field] ?? plan.timing?.[field]);
    speed[field] = Number.isFinite(value) ? value : null;
  }
  return immutableSerializable({
    durationMs: Number.isFinite(plannedDurationMs) ? plannedDurationMs : null,
    arcLengthPx: Number.isFinite(Number(plan.arcLengthPx ?? plan.timing?.arcLengthPx))
      ? Number(plan.arcLengthPx ?? plan.timing?.arcLengthPx)
      : null,
    distancePx: Number.isFinite(Number(plan.distancePx)) ? Number(plan.distancePx) : null,
    speed,
    phases: plan.phases ?? null,
    timing: plan.timing ?? null,
    tailPolicy: plan.tailPolicy ?? null,
  });
}

/**
 * @param {{mode?:string, gestureId?:string, targetId?:string, targetIdentity?:unknown,
 *   layoutIdentity?:unknown, geometryIdentity?:unknown, budgetMs:number, plan?:object,
 *   providerReason?:string|object}} request
 * @returns {object}
 */
export function createShowAttentionAdmission(request = {}) {
  let plan = request.plan && typeof request.plan === 'object' ? request.plan : {};
  let exactProviderReason = providerReason(request.providerReason);
  let planAvailable = !exactProviderReason && Object.keys(plan).length > 0;
  let availablePlan = planAvailable ? plan : {};
  let budgetMs = typeof request.budgetMs === 'number' ? request.budgetMs : Number.NaN;
  let plannedDuration = availablePlan.plannedDurationMs ?? availablePlan.durationMs;
  let plannedDurationMs = typeof plannedDuration === 'number'
    ? plannedDuration
    : Number.NaN;
  let planVersion = opaqueIdentity(availablePlan.planVersion || availablePlan.version);
  let normalizedPathHash = planAvailable
    ? String(availablePlan.normalizedPathHash || availablePlan.pathHash || '')
    : null;
  let geometry = planGeometry(availablePlan);
  let geometryIdentity = planAvailable
    ? opaqueIdentity(request.geometryIdentity ?? availablePlan.geometryIdentity)
    : null;
  if (!geometryIdentity && Object.keys(geometry).length) {
    geometryIdentity = stableIdentity('show-geometry', geometry);
  }
  let planIdentity = opaqueIdentity(availablePlan.planIdentity ?? availablePlan.identity);
  if (!planIdentity && planVersion) planIdentity = stableIdentity('show-plan', {
    planVersion,
    normalizedPathHash,
    plannedDurationMs: Number.isFinite(plannedDurationMs) ? plannedDurationMs : null,
    geometryIdentity,
  });
  let layoutIdentity = opaqueIdentity(request.layoutIdentity ?? availablePlan.layoutIdentity);
  if (!layoutIdentity && geometryIdentity) {
    layoutIdentity = stableIdentity('show-layout', { geometryIdentity });
  }
  let targetIdentity = opaqueIdentity(request.targetIdentity);
  let code = 'within-budget';
  if (exactProviderReason) code = 'provider-rejected';
  else if (!Number.isFinite(budgetMs) || budgetMs < 0) code = 'invalid-budget';
  else if (!Number.isFinite(plannedDurationMs) || plannedDurationMs < 0) code = 'plan-unavailable';
  else if (plannedDurationMs > budgetMs) code = 'budget-exceeded';
  else {
    let missing = [];
    if (!targetIdentity) missing.push('target.identity');
    if (!layoutIdentity) missing.push('target.layoutIdentity');
    if (!geometryIdentity) missing.push('target.geometryIdentity');
    if (!planIdentity) missing.push('plan.identity');
    if (String(request.mode || 'cursor') !== 'click' && !normalizedPathHash) {
      missing.push('plan.normalizedPathHash');
    }
    if (missing.length) {
      code = 'provider-rejected';
      exactProviderReason = Object.freeze({
        code: 'identity-unavailable',
        fields: Object.freeze(missing),
      });
    }
  }
  let status = code === 'within-budget' ? 'admitted' : 'rejected';
  return Object.freeze({
    version: SHOW_ATTENTION_ADMISSION_VERSION,
    status,
    provider: Object.freeze({
      id: 'symbiote-ui/show-attention',
      version: SHOW_ATTENTION_PROVIDER_VERSION,
    }),
    effect: Object.freeze({
      mode: String(request.mode || 'cursor'),
      gestureId: String(request.gestureId || ''),
    }),
    target: Object.freeze({
      id: opaqueIdentity(request.targetId),
      identity: targetIdentity,
      layoutIdentity,
      geometryIdentity,
      geometry: planAvailable && Object.keys(geometry).length ? geometry : null,
    }),
    budget: Object.freeze({
      limitMs: Number.isFinite(budgetMs) ? budgetMs : null,
      plannedDurationMs: planAvailable && Number.isFinite(plannedDurationMs)
        ? plannedDurationMs
        : null,
    }),
    plan: Object.freeze({
      version: planVersion,
      identity: planIdentity,
      normalizedPathHash,
      motion: planAvailable ? planMotion(availablePlan, plannedDurationMs) : null,
      evidence: planAvailable ? immutableSerializable(availablePlan) : null,
    }),
    reason: admissionReason(code, exactProviderReason),
  });
}

function presenterFrame(request, overrides = {}) {
  return {
    ...request.frame,
    ...(request.seed === undefined ? {} : { seed: request.seed }),
    ...(request.style === undefined ? {} : { style: request.style }),
    ...(request.gestureId === undefined ? {} : { gestureId: request.gestureId }),
    ...overrides,
  };
}

function providerMilestone(milestone, observedAt, admission, receipt) {
  return Object.freeze({
    version: SHOW_ATTENTION_MILESTONE_VERSION,
    milestone,
    observedAt,
    admission,
    providerReceipt: immutableSerializable(receipt),
  });
}

function providerTerminal(status, observedAt, admission, receipt, timing = {}) {
  return Object.freeze({
    version: SHOW_ATTENTION_TERMINAL_VERSION,
    status,
    observedAt,
    admission,
    providerReceipt: immutableSerializable(receipt),
    timing: immutableSerializable(timing),
  });
}

function receiptDuration(receipt) {
  let durationMs = Number(receipt?.durationMs);
  return Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
}

function receiptProgress(receipt) {
  for (let value of [receipt?.progress, receipt?.revealProgress]) {
    let progress = Number(value);
    if (Number.isFinite(progress)) return Math.max(0, Math.min(1, progress));
  }
  let durationMs = receiptDuration(receipt);
  let elapsedMs = Number(receipt?.elapsedMs);
  if (durationMs && Number.isFinite(elapsedMs)) {
    return Math.max(0, Math.min(1, elapsedMs / durationMs));
  }
  return durationMs ? 0 : 1;
}

function performanceClock(target) {
  let view = target?.ownerDocument?.defaultView;
  let clock = view?.performance || globalThis.performance;
  if (!clock || typeof clock.now !== 'function' || !Number.isFinite(Number(clock.timeOrigin))) {
    throw new TypeError('Show attention requires a Performance clock with a finite timeOrigin');
  }
  return {
    timeOriginMs: Number(clock.timeOrigin),
    now: () => {
      let value = Number(clock.now());
      if (!Number.isFinite(value)) throw new TypeError('performance.now() must return a finite value');
      return value;
    },
  };
}

function performanceObservedAt(clock, monotonicTimeMs = clock.now()) {
  let value = Number(monotonicTimeMs);
  if (!Number.isFinite(value)) throw new TypeError('performance observation must be finite');
  return Object.freeze({
    domain: 'performance',
    timeOriginMs: clock.timeOriginMs,
    monotonicTimeMs: value,
  });
}

function resolveFrameHost(target) {
  let view = target?.ownerDocument?.defaultView;
  let clock = performanceClock(target);
  let host = { clock };
  if (view && typeof view.requestAnimationFrame === 'function'
    && typeof view.cancelAnimationFrame === 'function') {
    host.request = view.requestAnimationFrame.bind(view);
    host.cancel = view.cancelAnimationFrame.bind(view);
    host.reducedMotion = () => Boolean(
      view.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
    );
  }
  if (view && typeof view.setTimeout === 'function' && typeof view.clearTimeout === 'function') {
    host.timeout = view.setTimeout.bind(view);
    host.clearTimeout = view.clearTimeout.bind(view);
  }
  return host;
}

export class ShowAttentionController {
  constructor({ cursor, selectText, resolveTarget, onAdmission, onMilestone, onTerminal } = {}) {
    this.cursor = cursor || null;
    this.selectText = typeof selectText === 'function' ? selectText : createPresenterTextSelectionAnimation;
    this.resolveTarget = typeof resolveTarget === 'function' ? resolveTarget : (value) => value;
    this.onAdmission = typeof onAdmission === 'function' ? onAdmission : null;
    this.onMilestone = typeof onMilestone === 'function' ? onMilestone : null;
    this.onTerminal = typeof onTerminal === 'function' ? onTerminal : null;
    this._transient = null;
    this._markers = [];
    this._cursorOwner = '';
    this._animation = null;
    this._generation = 0;
    this._activeRequest = null;
    this._admission = null;
    // A controller instance is one active presenter session. Bootstrap the
    // arrow immediately so scene setup/navigation cannot leave an invisible
    // gap before the first authored attention event. reset()/dispose() remain
    // the terminal owners that hide it.
    this.cursor?.clear?.({ preserveInk: false, preserveCursor: true });
    let clock = performanceClock(null);
    let observedAt = performanceObservedAt(clock);
    this._settled = Promise.resolve(providerTerminal(
      'completed',
      observedAt,
      null,
      null,
      { startedAt: null, firstFrameAt: null, elapsedMs: 0, durationMs: 0, terminalReason: 'idle' },
    ));
  }

  get lastAdmission() {
    return this._admission;
  }

  get snapshot() {
    return Object.freeze({
      cursorOwner: this._cursorOwner,
      transientMode: this._transient?.mode || '',
      markerCount: this._markers.length,
      markers: Object.freeze([...this._markers]),
      animating: Boolean(this._animation),
      animationMode: this._animation?.mode || '',
      animationElapsedMs: this._animation?.elapsedMs || 0,
      animationDurationMs: this._animation?.durationMs || 0,
      animationProgress: this._animation?.progress || 0,
      paused: Boolean(this._animation?.paused),
      generation: this._generation,
      gestureId: this._animation?.gestureId || '',
      admission: this._admission,
    });
  }

  /** Resolves when the active presenter gesture settles or is cancelled. */
  whenSettled() {
    return this._settled;
  }

  _finishAnimation(animation, status, observedAt, terminalReason) {
    if (animation.finished) return animation.terminal;
    animation.finished = true;
    if (animation.frameId !== null && animation.host.cancel) {
      animation.host.cancel(animation.frameId);
      animation.frameId = null;
    }
    if (animation.timeoutId !== null && animation.host.clearTimeout) {
      animation.host.clearTimeout(animation.timeoutId);
      animation.timeoutId = null;
    }
    if (this._animation === animation) this._animation = null;
    let terminal = providerTerminal(
      status,
      observedAt,
      animation.admission,
      animation.receipt,
      {
        startedAt: animation.startedAt,
        firstFrameAt: animation.firstFrameAt,
        elapsedMs: animation.elapsedMs,
        durationMs: animation.durationMs,
        terminalReason,
      },
    );
    animation.terminal = terminal;
    animation.resolve(terminal);
    animation.onTerminal?.(terminal);
    return terminal;
  }

  _failAnimation(animation, observedAt, code, error) {
    return this._finishAnimation(
      animation,
      'failed',
      observedAt,
      providerOperationFailure(code, error),
    );
  }

  _cancelAnimation(reason = 'cancelled') {
    let animation = this._animation;
    if (!animation) return;
    let observedAt = performanceObservedAt(animation.host.clock);
    this._finishAnimation(animation, 'cancelled', observedAt, reason);
  }

  _reportFirstFrame(animation, observedAt) {
    if (animation.firstFrameAt || animation.finished) return;
    animation.startedAt = observedAt;
    animation.firstFrameAt = observedAt;
    animation.onMilestone?.(providerMilestone(
      'first-frame',
      observedAt,
      animation.admission,
      animation.receipt,
    ));
  }

  _completeVisual(animation, observedAt) {
    if (animation.finished) return;
    animation.onSettled?.(animation.receipt);
    animation.onMilestone?.(providerMilestone(
      'settled',
      observedAt,
      animation.admission,
      animation.receipt,
    ));
    this._finishAnimation(animation, 'completed', observedAt, 'settled');
  }

  _settleStandalone(status, target, admission, receipt, terminalReason, onTerminal) {
    let clock = performanceClock(target);
    let observedAt = performanceObservedAt(clock);
    let terminal = providerTerminal(status, observedAt, admission, receipt, {
      startedAt: null,
      firstFrameAt: null,
      elapsedMs: 0,
      durationMs: receiptDuration(receipt),
      terminalReason,
    });
    this._settled = Promise.resolve(terminal);
    onTerminal?.(terminal);
    return terminal;
  }

  _settleProvisional({
    status,
    target,
    admission,
    receipt,
    terminalReason,
    onTerminal,
    handle = null,
  }) {
    handle?.clear?.();
    this.clearTransient(status, { preserveInk: true, preserveCursor: false });
    this._activeRequest = null;
    this._admission = admission;
    return this._settleStandalone(
      status,
      target,
      admission,
      receipt,
      terminalReason,
      onTerminal,
    );
  }

  _animate({
    mode,
    gestureId,
    target,
    receipt,
    render,
    onSettled,
    admission,
    onMilestone,
    onTerminal,
    alreadyRendered = false,
  }) {
    let host = resolveFrameHost(target);
    let durationMs = receiptDuration(receipt);
    let resolve;
    let settled = new Promise((done) => { resolve = done; });
    let animation = {
      mode,
      gestureId,
      host,
      frameId: null,
      timeoutId: null,
      frameOriginAt: null,
      startedAt: null,
      firstFrameAt: null,
      elapsedMs: 0,
      durationMs,
      progress: receiptProgress(receipt),
      receipt,
      resolve,
      render,
      onSettled,
      admission,
      onMilestone,
      onTerminal,
      paused: false,
      finished: false,
      terminal: null,
      tick: null,
      armFallback: null,
    };
    this._settled = settled;

    if (!receipt?.presented) {
      let observedAt = performanceObservedAt(host.clock);
      this._finishAnimation(animation, 'rejected', observedAt, 'provider-not-presented');
      return receipt;
    }

    let immediate = !host.request || !durationMs || receiptProgress(receipt) >= 1
      || host.reducedMotion?.();
    if (immediate) {
      let observedAt;
      try {
        animation.elapsedMs = durationMs;
        if (!alreadyRendered) animation.receipt = render(durationMs);
        animation.progress = receiptProgress(animation.receipt);
      } catch (error) {
        observedAt = performanceObservedAt(host.clock);
        this._failAnimation(animation, observedAt, 'provider-render-failed', error);
        throw error;
      }
      observedAt = performanceObservedAt(host.clock);
      try {
        this._reportFirstFrame(animation, observedAt);
      } catch (error) {
        this._failAnimation(animation, observedAt, 'provider-milestone-failed', error);
        throw error;
      }
      try {
        this._completeVisual(animation, observedAt);
      } catch (error) {
        this._failAnimation(animation, observedAt, 'provider-settlement-failed', error);
        throw error;
      }
      return animation.receipt;
    }

    this._animation = animation;

    let armFallback = () => {
      if (!host.timeout || animation.finished || animation.paused) return;
      if (animation.timeoutId !== null && host.clearTimeout) {
        host.clearTimeout(animation.timeoutId);
      }
      animation.timeoutId = host.timeout(() => {
        animation.timeoutId = null;
        if (this._animation !== animation || animation.finished || animation.paused) return;
        animation.elapsedMs = durationMs;
        let observedAt = performanceObservedAt(host.clock);
        try {
          animation.receipt = render(durationMs);
          animation.progress = receiptProgress(animation.receipt);
        } catch (error) {
          this._failAnimation(animation, observedAt, 'provider-render-failed', error);
          return;
        }
        try {
          this._reportFirstFrame(animation, observedAt);
        } catch (error) {
          this._failAnimation(animation, observedAt, 'provider-milestone-failed', error);
          return;
        }
        try {
          this._completeVisual(animation, observedAt);
        } catch (error) {
          this._failAnimation(animation, observedAt, 'provider-settlement-failed', error);
        }
      }, Math.max(0, durationMs - animation.elapsedMs));
    };
    animation.armFallback = armFallback;

    let tick = (timestamp) => {
      if (this._animation !== animation) return;
      animation.frameId = null;
      if (animation.paused) return;
      if (animation.frameOriginAt === null) animation.frameOriginAt = timestamp - animation.elapsedMs;
      animation.elapsedMs = Math.min(durationMs, Math.max(0, timestamp - animation.frameOriginAt));
      let observedAt = performanceObservedAt(host.clock, timestamp);
      try {
        animation.receipt = render(animation.elapsedMs);
        animation.progress = receiptProgress(animation.receipt);
      } catch (error) {
        this._failAnimation(animation, observedAt, 'provider-render-failed', error);
        return;
      }
      try {
        this._reportFirstFrame(animation, observedAt);
      } catch (error) {
        this._failAnimation(animation, observedAt, 'provider-milestone-failed', error);
        return;
      }
      if (this._animation !== animation || animation.finished || animation.paused) return;
      if (animation.elapsedMs >= durationMs || animation.progress >= 1) {
        try {
          this._completeVisual(animation, observedAt);
        } catch (error) {
          this._failAnimation(animation, observedAt, 'provider-settlement-failed', error);
        }
        return;
      }
      animation.frameId = host.request(tick);
    };
    animation.tick = tick;
    animation.frameId = host.request(tick);
    armFallback();
    return receipt;
  }

  pause() {
    let animation = this._animation;
    if (!animation || animation.paused) return false;
    animation.paused = true;
    if (animation.frameId !== null) {
      animation.host.cancel(animation.frameId);
      animation.frameId = null;
    }
    if (animation.timeoutId !== null && animation.host.clearTimeout) {
      animation.host.clearTimeout(animation.timeoutId);
      animation.timeoutId = null;
    }
    return true;
  }

  resume() {
    let animation = this._animation;
    if (!animation || !animation.paused) return false;
    animation.paused = false;
    animation.frameOriginAt = null;
    animation.frameId = animation.host.request(animation.tick);
    animation.armFallback?.();
    return true;
  }

  seek(elapsedMs = 0) {
    let animation = this._animation;
    if (!animation) return null;
    if (animation.frameId !== null) {
      animation.host.cancel(animation.frameId);
      animation.frameId = null;
    }
    if (animation.timeoutId !== null && animation.host.clearTimeout) {
      animation.host.clearTimeout(animation.timeoutId);
      animation.timeoutId = null;
    }
    animation.elapsedMs = Math.min(animation.durationMs, Math.max(0, Number(elapsedMs) || 0));
    animation.frameOriginAt = null;
    let observedAt = performanceObservedAt(animation.host.clock);
    try {
      animation.receipt = animation.render(animation.elapsedMs);
      animation.progress = receiptProgress(animation.receipt);
    } catch (error) {
      this._failAnimation(animation, observedAt, 'provider-render-failed', error);
      throw error;
    }
    try {
      this._reportFirstFrame(animation, observedAt);
    } catch (error) {
      this._failAnimation(animation, observedAt, 'provider-milestone-failed', error);
      throw error;
    }
    if (this._animation !== animation || animation.finished) return animation.receipt;
    if (animation.elapsedMs >= animation.durationMs || animation.progress >= 1) {
      try {
        this._completeVisual(animation, observedAt);
      } catch (error) {
        this._failAnimation(animation, observedAt, 'provider-settlement-failed', error);
        throw error;
      }
    } else if (!animation.paused) {
      animation.frameId = animation.host.request(animation.tick);
      animation.armFallback?.();
    }
    return animation.receipt;
  }

  cancel(reason = 'cancelled') {
    if (!this._animation) return false;
    this._cancelAnimation(reason);
    return true;
  }

  captureState() {
    return Object.freeze({
      version: 'show-attention-state-v1',
      request: this._activeRequest ? Object.freeze({ ...this._activeRequest }) : null,
      elapsedMs: this._animation?.elapsedMs || 0,
      paused: Boolean(this._animation?.paused),
    });
  }

  restoreState(state = {}) {
    let request = state?.request;
    if (!request) return { presented: false, reason: 'state-empty' };
    let receipt = this.present(request);
    if (this._animation) {
      this.seek(state.elapsedMs);
      if (state.paused) this.pause();
    }
    return receipt;
  }

  reset(reason = 'branch-reset') {
    this.clearTransient(reason, { preserveInk: false, preserveCursor: false });
    this.clearMarkers();
    this._activeRequest = null;
  }

  clearTransient(status = 'cleared', { preserveInk = true, preserveCursor = false } = {}) {
    this._cancelAnimation(status);
    this._transient?.handle?.clear?.();
    this._transient = null;
    this._cursorOwner = '';
    this.cursor?.clear?.({ preserveInk, preserveCursor });
  }

  clearMarkers() {
    if (this._animation?.mode === 'marker') {
      this._cancelAnimation('cleared-markers');
      this._cursorOwner = '';
    }
    this._markers = [];
    this.cursor?.clearAccumulatedAnnotations?.();
  }

  present(request = {}) {
    let mode = String(request.mode || 'cursor');
    let onAdmission = typeof request.onAdmission === 'function'
      ? request.onAdmission
      : this.onAdmission;
    let onMilestone = typeof request.onMilestone === 'function'
      ? request.onMilestone
      : this.onMilestone;
    let onTerminal = typeof request.onTerminal === 'function'
      ? request.onTerminal
      : this.onTerminal;
    let requestsProviderV2 = request.budgetMs !== undefined
      || ['onAdmission', 'onMilestone', 'onTerminal'].some((key) => Object.hasOwn(request, key))
      || Boolean(this.onAdmission || this.onMilestone || this.onTerminal);
    if (requestsProviderV2 && typeof onAdmission !== 'function') {
      let error = attentionError(
        'SHOW_ATTENTION_ADMISSION_REPORTER_REQUIRED',
        'provider-v2 attention requires a callable onAdmission reporter',
      );
      throw error;
    }
    let generation = ++this._generation;
    let gestureId = String(request.gestureId || request.id || `${mode}:${generation}`);
    let requiresAdmission = requestsProviderV2;
    let target = null;
    let planningError = null;
    try {
      target = this.resolveTarget(request.target ?? request.targetId);
    } catch (error) {
      if (!requiresAdmission) throw error;
      planningError = error;
    }
    this._cancelAnimation('replaced');

    if (!planningError && !target) {
      if (!requiresAdmission) {
        this.clearTransient('replaced', { preserveInk: true, preserveCursor: false });
        this._activeRequest = null;
        return { presented: false, reason: 'target-unresolved', mode };
      }
      let admission = createShowAttentionAdmission({
        mode,
        gestureId,
        targetId: request.targetId,
        targetIdentity: request.targetIdentity,
        layoutIdentity: request.layoutIdentity,
        budgetMs: request.budgetMs,
        providerReason: { code: 'target-unresolved' },
      });
      this._admission = admission;
      try {
        onAdmission(admission);
      } catch (error) {
        this._settleProvisional({
          status: 'failed',
          target: null,
          admission,
          receipt: null,
          terminalReason: providerOperationFailure('admission-callback-failed', error),
          onTerminal,
        });
        throw error;
      }
      let rejected = Object.freeze({
        presented: false,
        reason: admission.reason,
        mode,
        admission,
      });
      this._settleProvisional({
        status: 'rejected',
        target: null,
        admission,
        receipt: null,
        terminalReason: admission.reason,
        onTerminal,
      });
      return rejected;
    }

    let annotation = request.annotation
      || {
        ...(request.intent === undefined ? {} : { intent: request.intent }),
        ...(request.marker === undefined ? {} : { marker: request.marker }),
        ...(request.label === undefined ? {} : { label: request.label }),
      };
    let handle = null;
    let planReceipt;
    let render;
    let planOnly = requiresAdmission;
    try {
      if (planningError) throw planningError;
      if (mode === 'marker') {
        render = (elapsedMs) => this.cursor?.presentAnnotationFrame?.(
          target,
          annotation,
          presenterFrame(request, { elapsedMs, accumulate: true, ownsCursor: true }),
        ) || { presented: false, reason: 'cursor-unavailable' };
        planReceipt = this.cursor?.presentAnnotationFrame?.(
          target,
          annotation,
          presenterFrame(request, {
            ...(planOnly ? { elapsedMs: 0 } : {}),
            accumulate: true,
            ownsCursor: true,
            planOnly,
          }),
        ) || { presented: false, reason: 'cursor-unavailable' };
      } else if (mode === 'native-selection') {
        handle = this.selectText?.(target, request.selection || request);
        planReceipt = handle?.receipt || handle || { presented: false, reason: 'selection-unavailable' };
        render = typeof handle?.presentFrame === 'function'
          ? (elapsedMs) => handle.presentFrame(elapsedMs)
          : () => planReceipt;
      } else if (mode === 'click') {
        render = (elapsedMs) => this.cursor?.presentClickFrame?.(
          target,
          presenterFrame(request, { elapsedMs, preserveInk: true }),
        ) || { presented: false, reason: 'cursor-unavailable' };
        planReceipt = this.cursor?.presentClickFrame?.(
          target,
          presenterFrame(request, { elapsedMs: 0, preserveInk: true, planOnly }),
        ) || { presented: false, reason: 'cursor-unavailable' };
      } else {
        render = (elapsedMs) => this.cursor?.presentFocusFrame?.(target, presenterFrame(request, {
          elapsedMs,
          preserveInk: true,
          mode: mode === 'frame' ? 'frame' : 'cursor',
        })) || { presented: false, reason: 'cursor-unavailable' };
        planReceipt = this.cursor?.presentFocusFrame?.(target, presenterFrame(request, {
          elapsedMs: 0,
          preserveInk: true,
          mode: mode === 'frame' ? 'frame' : 'cursor',
          planOnly,
        })) || { presented: false, reason: 'cursor-unavailable' };
      }
    } catch (error) {
      if (!requiresAdmission) throw error;
      let exactReason = providerFailureReason(error, 'provider-planning-failed');
      let admission = createShowAttentionAdmission({
        mode,
        gestureId,
        targetId: request.targetId,
        targetIdentity: request.targetIdentity ?? target?.id,
        layoutIdentity: request.layoutIdentity,
        budgetMs: request.budgetMs,
        providerReason: exactReason,
      });
      this._admission = admission;
      try {
        onAdmission(admission);
      } catch (admissionError) {
        this._settleProvisional({
          status: 'failed',
          target,
          admission,
          receipt: null,
          terminalReason: providerOperationFailure(
            'admission-callback-failed',
            admissionError,
          ),
          onTerminal,
          handle,
        });
        throw admissionError;
      }
      let expected = typeof error?.code === 'string' && Boolean(error.code);
      let rejected = Object.freeze({
        presented: false,
        reason: admission.reason,
        mode,
        admission,
      });
      this._settleProvisional({
        status: expected ? 'rejected' : 'failed',
        target,
        admission,
        receipt: null,
        terminalReason: expected ? admission.reason : exactReason,
        onTerminal,
        handle,
      });
      if (!expected) throw error;
      return rejected;
    }

    let admission = requiresAdmission
      ? createShowAttentionAdmission({
        mode,
        gestureId,
        targetId: request.targetId,
        targetIdentity: request.targetIdentity ?? target?.id,
        layoutIdentity: request.layoutIdentity,
        geometryIdentity: request.geometryIdentity,
        budgetMs: request.budgetMs,
        plan: planReceipt,
        ...(!planReceipt?.presented ? {
          providerReason: planRejectionReason(planReceipt),
        } : {}),
      })
      : null;
    this._admission = admission;
    try {
      if (admission) onAdmission?.(admission);
    } catch (error) {
      this._settleProvisional({
        status: 'failed',
        target,
        admission,
        receipt: planReceipt,
        terminalReason: providerOperationFailure('admission-callback-failed', error),
        onTerminal,
        handle,
      });
      throw error;
    }

    if (admission?.status === 'rejected') {
      let rejected = Object.freeze({
        ...planReceipt,
        presented: false,
        reason: admission.reason,
        admission,
      });
      this._settleProvisional({
        status: 'rejected',
        target,
        admission,
        receipt: planReceipt,
        terminalReason: admission.reason,
        onTerminal,
        handle,
      });
      return rejected;
    }

    this.clearTransient('replaced', {
      preserveInk: true,
      preserveCursor: true,
    });
    this._activeRequest = Object.freeze({ ...request });
    let onSettled = null;
    if (mode === 'marker') {
      this._cursorOwner = 'marker';
      onSettled = (finalReceipt) => {
        this._markers.push(Object.freeze({
          targetId: String(request.targetId || ''),
          receipt: finalReceipt,
        }));
      };
    } else if (mode === 'native-selection') {
      this._transient = { mode, handle };
      this._cursorOwner = 'native-selection';
    } else {
      this._transient = { mode, receipt: planReceipt };
      this._cursorOwner = mode;
    }

    let receipt = this._animate({
      mode,
      gestureId,
      target,
      receipt: planReceipt,
      render,
      onSettled,
      admission,
      onMilestone,
      onTerminal,
      alreadyRendered: !requiresAdmission && mode !== 'native-selection',
    });
    return Object.freeze({
      ...receipt,
      admission,
    });
  }

  dispose() {
    this.clearTransient('disposed', { preserveInk: false, preserveCursor: false });
    this.clearMarkers();
    this._activeRequest = null;
  }
}
