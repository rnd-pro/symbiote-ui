export const SHOW_READINESS_VERSION = 'symbiote-show-readiness-v1';

export class ShowReadinessError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ShowReadinessError';
    this.code = code;
    this.details = Object.freeze({ ...details });
    this.version = SHOW_READINESS_VERSION;
  }
}

function abortError(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  let error = new ShowReadinessError('aborted', 'show readiness wait was aborted');
  error.name = 'AbortError';
  return error;
}

function waitForEvent(target, names, { signal, timeoutMs = 0, failureNames = [] } = {}) {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    let timer = null;
    let cleanup = () => {
      for (let name of names) target?.removeEventListener?.(name, onReady);
      for (let name of failureNames) target?.removeEventListener?.(name, onFailure);
      signal?.removeEventListener?.('abort', onAbort);
      if (timer !== null) clearTimeout(timer);
    };
    let onReady = (event) => { cleanup(); resolve(event); };
    let onFailure = (event) => {
      cleanup();
      reject(new ShowReadinessError('resource-error', 'show resource failed before it became ready', { eventType: event?.type || '' }));
    };
    let onAbort = () => { cleanup(); reject(abortError(signal)); };
    for (let name of names) target?.addEventListener?.(name, onReady, { once: true });
    for (let name of failureNames) target?.addEventListener?.(name, onFailure, { once: true });
    signal?.addEventListener?.('abort', onAbort, { once: true });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(new ShowReadinessError('timeout', 'show resource readiness timed out', { timeoutMs }));
      }, timeoutMs);
    }
  });
}

function waitForAbortablePromise(promise, signal) {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  if (!signal) return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    let cleanup = () => signal.removeEventListener('abort', onAbort);
    let onAbort = () => {
      cleanup();
      reject(abortError(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); },
    );
  });
}

function finiteNumber(value) {
  let number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readTargetRect(target) {
  let rect = target?.getBoundingClientRect?.() || {};
  let left = finiteNumber(rect.left);
  let top = finiteNumber(rect.top);
  let width = finiteNumber(rect.width);
  let height = finiteNumber(rect.height);
  return Object.freeze({
    left,
    top,
    width,
    height,
    right: Number.isFinite(Number(rect.right)) ? Number(rect.right) : left + width,
    bottom: Number.isFinite(Number(rect.bottom)) ? Number(rect.bottom) : top + height,
  });
}

function collectScrollObservers(target, doc) {
  let observers = [];
  let offsetTargets = [];
  let seenEvents = new Set();
  let seenOffsets = new Set();
  let add = (eventTarget, offsetTarget, kind) => {
    if (!eventTarget || typeof eventTarget.addEventListener !== 'function' || seenEvents.has(eventTarget)) return;
    seenEvents.add(eventTarget);
    observers.push({ eventTarget, offsetTarget, kind });
    if (offsetTarget && !seenOffsets.has(offsetTarget)) {
      seenOffsets.add(offsetTarget);
      offsetTargets.push({
        target: offsetTarget,
        kind,
        label: String(offsetTarget.id || offsetTarget.tagName || kind || '').toLowerCase(),
      });
    }
  };
  let current = target?.parentElement || target?.getRootNode?.()?.host || null;
  while (current) {
    add(current, current, 'element');
    let next = current.parentElement || current.getRootNode?.()?.host || null;
    if (next === current) break;
    current = next;
  }
  let scrollingElement = doc?.scrollingElement || doc?.documentElement || null;
  add(scrollingElement, scrollingElement, 'document-scroll-element');
  add(doc, scrollingElement, 'document');
  return { observers, offsetTargets };
}

function readVisualSnapshot(target, offsetTargets) {
  return Object.freeze({
    targetRect: readTargetRect(target),
    scrollOffsets: Object.freeze(offsetTargets.map(({ target: item, kind, label }, index) => Object.freeze({
      index,
      kind,
      label,
      left: finiteNumber(item?.scrollLeft),
      top: finiteNumber(item?.scrollTop),
    }))),
  });
}

function compareVisualSnapshots(previous, current, epsilonPx) {
  let rectChanged = ['left', 'top', 'width', 'height', 'right', 'bottom']
    .some((key) => Math.abs(current.targetRect[key] - previous.targetRect[key]) > epsilonPx);
  let offsetsChanged = current.scrollOffsets.length !== previous.scrollOffsets.length
    || current.scrollOffsets.some((offset, index) => {
      let before = previous.scrollOffsets[index];
      return !before
        || Math.abs(offset.left - before.left) > epsilonPx
        || Math.abs(offset.top - before.top) > epsilonPx;
    });
  return { rectChanged, offsetsChanged, changed: rectChanged || offsetsChanged };
}

export function waitForShowVisualSettlement(target, options = {}) {
  if (!target) return Promise.reject(new ShowReadinessError('missing-target', 'a visual target is required'));
  if (options.signal?.aborted) return Promise.reject(abortError(options.signal));
  let doc = options.document || target.ownerDocument || (typeof document !== 'undefined' ? document : null);
  let view = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
  let requestFrameMethod = options.requestAnimationFrame || view?.requestAnimationFrame;
  let cancelFrameMethod = options.cancelAnimationFrame || view?.cancelAnimationFrame;
  let requestFrame = typeof requestFrameMethod === 'function'
    ? options.requestAnimationFrame
      ? (callback) => options.requestAnimationFrame(callback)
      : (callback) => view.requestAnimationFrame(callback)
    : null;
  let cancelFrame = typeof cancelFrameMethod === 'function'
    ? (id) => (options.cancelAnimationFrame ? options.cancelAnimationFrame(id) : view.cancelAnimationFrame(id))
    : () => {};
  let epsilonPx = Number.isFinite(Number(options.epsilonPx)) ? Math.max(0, Number(options.epsilonPx)) : 0.1;
  let stableFrameCount = Math.max(2, Number.parseInt(options.stableFrameCount || '2', 10) || 2);
  let inactivityMs = Math.max(1, Number.parseInt(options.inactivityMs || options.timeoutMs || '5000', 10) || 5000);
  let { observers, offsetTargets } = collectScrollObservers(target, doc);
  let nativeScrollEndSupported = observers.some(({ eventTarget }) => 'onscrollend' in eventTarget);

  return new Promise((resolve, reject) => {
    let done = false;
    let frameId = null;
    let framePending = false;
    let frameQueued = false;
    let watchdog = null;
    let previous = readVisualSnapshot(target, offsetTargets);
    let stableFrames = 0;
    let frames = 0;
    let movingFrames = 0;
    let rectMovingFrames = 0;
    let offsetMovingFrames = 0;
    let scrollEvents = 0;
    let scrollEndEvents = 0;
    let sawScrollActivity = false;
    let sawLatestScrollEnd = false;
    let platformDone = true;
    let firstFrameAtMs = null;
    let settledAtMs = null;

    let cleanup = () => {
      done = true;
      if (framePending && frameId !== null) cancelFrame(frameId);
      frameId = null;
      framePending = false;
      if (watchdog !== null) globalThis.clearTimeout(watchdog);
      watchdog = null;
      for (let { eventTarget } of observers) {
        eventTarget.removeEventListener?.('scroll', onScroll);
        eventTarget.removeEventListener?.('scrollend', onScrollEnd);
      }
      options.signal?.removeEventListener?.('abort', onAbort);
    };
    let fail = (error) => {
      if (done) return;
      cleanup();
      reject(error);
    };
    let armWatchdog = (phase) => {
      if (watchdog !== null) globalThis.clearTimeout(watchdog);
      watchdog = globalThis.setTimeout(() => {
        fail(new ShowReadinessError('timeout', 'show visual settlement stopped making progress', {
          phase,
          inactivityMs,
          frames,
          movingFrames,
          scrollEvents,
          scrollEndEvents,
        }));
      }, inactivityMs);
    };
    let finish = () => {
      if (done) return;
      let motion = sawScrollActivity || offsetMovingFrames > 0
        ? 'scroll'
        : rectMovingFrames > 0 ? 'transform' : 'none';
      let finalSnapshot = readVisualSnapshot(target, offsetTargets);
      let receipt = Object.freeze({
        version: SHOW_READINESS_VERSION,
        status: 'settled',
        motion,
        reason: motion === 'scroll' ? 'scrollend-and-stable' : 'stable',
        frames,
        movingFrames,
        stableFrames,
        scrollEvents,
        scrollEndEvents,
        nativeScrollEndSupported,
        firstFrameAtMs,
        settledAtMs,
        targetRect: finalSnapshot.targetRect,
        scrollOffsets: finalSnapshot.scrollOffsets,
      });
      cleanup();
      resolve(receipt);
    };
    let scheduleFrame = () => {
      if (done || framePending || frameQueued) return;
      if (!requestFrame) {
        fail(new ShowReadinessError('frame-unavailable', 'requestAnimationFrame is required for visual settlement'));
        return;
      }
      frameQueued = true;
      queueMicrotask(() => {
        frameQueued = false;
        if (done || framePending) return;
        framePending = true;
        let id = requestFrame(onFrame);
        frameId = framePending ? id : null;
      });
    };
    let onFrame = (timestamp) => {
      if (done) return;
      framePending = false;
      frameId = null;
      frames += 1;
      let frameTime = Number.isFinite(Number(timestamp)) ? Number(timestamp) : null;
      if (firstFrameAtMs === null) firstFrameAtMs = frameTime;
      let current = readVisualSnapshot(target, offsetTargets);
      let comparison = compareVisualSnapshots(previous, current, epsilonPx);
      previous = current;
      if (comparison.changed) {
        movingFrames += 1;
        if (comparison.rectChanged) rectMovingFrames += 1;
        if (comparison.offsetsChanged) {
          if (!nativeScrollEndSupported) {
            fail(new ShowReadinessError(
              'scrollend-unavailable',
              'native scrollend is required to settle actual show scrolling',
              { frames, movingFrames, scrollEvents },
            ));
            return;
          }
          offsetMovingFrames += 1;
          sawScrollActivity = true;
          sawLatestScrollEnd = false;
        }
        stableFrames = 0;
        armWatchdog('visual-motion');
      } else {
        stableFrames += 1;
      }
      let scrollSettled = !sawScrollActivity || sawLatestScrollEnd;
      if (platformDone && scrollSettled && stableFrames >= stableFrameCount) {
        settledAtMs = frameTime;
        finish();
        return;
      }
      if ((!platformDone || (sawScrollActivity && !sawLatestScrollEnd)) && stableFrames >= stableFrameCount) return;
      scheduleFrame();
    };
    let onScroll = () => {
      if (done) return;
      if (!nativeScrollEndSupported) {
        fail(new ShowReadinessError(
          'scrollend-unavailable',
          'native scrollend is required to settle actual show scrolling',
          { frames, movingFrames, scrollEvents },
        ));
        return;
      }
      scrollEvents += 1;
      sawScrollActivity = true;
      sawLatestScrollEnd = false;
      stableFrames = 0;
      armWatchdog('scroll-progress');
      scheduleFrame();
    };
    let onScrollEnd = () => {
      if (done) return;
      scrollEndEvents += 1;
      sawLatestScrollEnd = true;
      stableFrames = 0;
      armWatchdog('scrollend-stability');
      scheduleFrame();
    };
    let onAbort = () => fail(abortError(options.signal));

    for (let { eventTarget } of observers) {
      eventTarget.addEventListener?.('scroll', onScroll);
      eventTarget.addEventListener?.('scrollend', onScrollEnd);
    }
    options.signal?.addEventListener?.('abort', onAbort, { once: true });
    armWatchdog('visual-settlement-start');

    let startResult;
    try {
      startResult = options.start?.();
    } catch (error) {
      fail(error);
      return;
    }
    if (startResult && typeof startResult.then === 'function') {
      platformDone = false;
      Promise.resolve(startResult).then(
        () => {
          if (done) return;
          platformDone = true;
          stableFrames = 0;
          armWatchdog('platform-scroll-complete');
          scheduleFrame();
        },
        fail,
      );
    }
    if (requestFrame || platformDone) scheduleFrame();
  });
}

export async function waitForShowDocumentReady(doc, options = {}) {
  if (!doc) throw new ShowReadinessError('missing-document', 'a document is required');
  if (doc.readyState === 'loading') {
    await waitForEvent(doc, ['DOMContentLoaded'], options);
  }
  if (doc.fonts?.ready && typeof doc.fonts.ready.then === 'function') {
    await waitForAbortablePromise(doc.fonts.ready, options.signal);
  }
  return doc;
}

export async function waitForShowElement(doc, target, options = {}) {
  let resolve = () => {
    if (typeof target === 'function') return target(doc);
    if (typeof target === 'string') return doc?.querySelector?.(target) || null;
    return target || null;
  };
  let element = resolve();
  if (element) return element;
  let Observer = options.MutationObserver || doc?.defaultView?.MutationObserver || globalThis.MutationObserver;
  if (!Observer) throw new ShowReadinessError('observer-unavailable', 'MutationObserver is required to wait for a DOM target');
  if (options.signal?.aborted) throw abortError(options.signal);
  return new Promise((resolvePromise, reject) => {
    let timer = null;
    let observer;
    let cleanup = () => {
      observer?.disconnect?.();
      options.signal?.removeEventListener?.('abort', onAbort);
      if (timer !== null) clearTimeout(timer);
    };
    let onAbort = () => { cleanup(); reject(abortError(options.signal)); };
    observer = new Observer(() => {
      let next = resolve();
      if (!next) return;
      cleanup();
      resolvePromise(next);
    });
    observer.observe(doc.documentElement || doc, { childList: true, subtree: true, attributes: true });
    options.signal?.addEventListener?.('abort', onAbort, { once: true });
    if (options.timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(new ShowReadinessError('timeout', 'show target readiness timed out', { timeoutMs: options.timeoutMs }));
      }, options.timeoutMs);
    }
  });
}

export async function waitForShowMediaReady(media, options = {}) {
  if (!media) throw new ShowReadinessError('missing-media', 'a media element is required');
  if (Number(media.readyState) >= 2) return media;
  await waitForEvent(media, ['loadeddata', 'canplay'], { ...options, failureNames: ['error', 'abort'] });
  return media;
}

export async function waitForShowDomReadiness(options = {}) {
  let doc = options.document || (typeof document !== 'undefined' ? document : null);
  await waitForShowDocumentReady(doc, options);
  let target = options.target === undefined ? null : await waitForShowElement(doc, options.target, options);
  let visualSettlement = null;
  if (target && options.scroll !== false && typeof target.scrollIntoView === 'function') {
    visualSettlement = await waitForShowVisualSettlement(target, {
      ...options,
      document: doc,
      start: () => target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }),
    });
  }
  let media = [];
  for (let item of Array.isArray(options.media) ? options.media : []) {
    media.push(await waitForShowMediaReady(item, options));
  }
  return Object.freeze({
    version: SHOW_READINESS_VERSION,
    document: doc,
    target,
    visualSettlement,
    media: Object.freeze(media),
  });
}
