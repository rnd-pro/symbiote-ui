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
  if (target && options.scroll !== false && typeof target.scrollIntoView === 'function') {
    let scrollResult = target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    if (scrollResult && typeof scrollResult.then === 'function') {
      await waitForAbortablePromise(scrollResult, options.signal);
    }
    let requestFrame = doc?.defaultView?.requestAnimationFrame;
    if (typeof requestFrame === 'function') {
      await new Promise((resolve) => requestFrame(() => requestFrame(resolve)));
    }
  }
  let media = [];
  for (let item of Array.isArray(options.media) ? options.media : []) {
    media.push(await waitForShowMediaReady(item, options));
  }
  return Object.freeze({ version: SHOW_READINESS_VERSION, document: doc, target, media: Object.freeze(media) });
}
