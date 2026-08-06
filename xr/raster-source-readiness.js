function revision(value, name) {
  let result = Number(value);
  if (!Number.isInteger(result) || result < 0) {
    throw new TypeError(`${name} must be a non-negative integer.`);
  }
  return result;
}

function requiredCallback(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be a function.`);
  return value;
}

export function createRasterSourceReadiness(options = {}) {
  let onCaptureNeeded = requiredCallback(options.onCaptureNeeded, 'onCaptureNeeded');
  let onFrameAccepted = requiredCallback(options.onFrameAccepted, 'onFrameAccepted');
  let onResourceRelease = requiredCallback(options.onResourceRelease, 'onResourceRelease');
  let onError = typeof options.onError === 'function' ? options.onError : null;
  let generation = -1;
  let visualRevision = -1;
  let readyRevision = -1;
  let attemptSequence = 0;
  let activeAttempt = null;
  let currentFrame = null;
  let dirty = false;
  let ready = false;
  let pending = false;
  let disposed = false;
  let lastError = null;
  let releasedObjects = new WeakSet();
  let releasedValues = new Set();

  function report(error, phase, attempt = null) {
    let value = error instanceof Error ? error : new Error(String(error));
    lastError = Object.freeze({
      phase,
      message: value.message,
      generation: attempt?.generation ?? generation,
      visualRevision: attempt?.visualRevision ?? visualRevision,
      attemptId: attempt?.attemptId ?? null,
    });
    try {
      onError?.(value, lastError);
    } catch {}
  }

  function releaseOnce(resource) {
    if (resource === undefined || resource === null) return false;
    let reference = (typeof resource === 'object' && resource !== null) || typeof resource === 'function';
    let released = reference ? releasedObjects.has(resource) : releasedValues.has(resource);
    if (released) return false;
    if (reference) releasedObjects.add(resource);
    else releasedValues.add(resource);
    try {
      onResourceRelease(resource);
    } catch (error) {
      report(error, 'resource-release');
    }
    return true;
  }

  function abortActive(reason) {
    let attempt = activeAttempt;
    if (!attempt) return false;
    activeAttempt = null;
    attempt.settled = true;
    if (!attempt.controller.signal.aborted) attempt.controller.abort(new Error(reason));
    return true;
  }

  function isActiveAttempt(attempt) {
    return !disposed
      && activeAttempt === attempt
      && !attempt.settled
      && attempt.generation === generation;
  }

  function hasNewerReadyRevision(attempt) {
    return !disposed
      && generation === attempt.generation
      && !dirty
      && ready
      && readyRevision === visualRevision
      && readyRevision > attempt.visualRevision;
  }

  function advanceAfterAttempt(attempt) {
    if (hasNewerReadyRevision(attempt)) {
      pending = true;
      advanceCapture();
      return true;
    }
    pending = false;
    return false;
  }

  function completeAttempt(attempt, frame) {
    if (!isActiveAttempt(attempt)) {
      if (frame !== currentFrame?.resource) releaseOnce(frame);
      return Object.freeze({ ok: false, reason: disposed ? 'disposed' : 'stale-attempt' });
    }
    if (currentFrame?.generation === attempt.generation
      && currentFrame.visualRevision >= attempt.visualRevision) {
      attempt.settled = true;
      activeAttempt = null;
      if (frame !== currentFrame.resource) releaseOnce(frame);
      advanceAfterAttempt(attempt);
      return Object.freeze({ ok: false, reason: 'non-monotonic-frame' });
    }
    attempt.settled = true;
    let previous = currentFrame;
    try {
      onFrameAccepted(attempt.generation, attempt.visualRevision, frame);
    } catch (error) {
      if (frame !== currentFrame?.resource) releaseOnce(frame);
      report(error, 'frame-accepted', attempt);
      if (!disposed && generation === attempt.generation && activeAttempt === attempt) {
        activeAttempt = null;
        if (!advanceAfterAttempt(attempt)) {
          dirty = true;
          ready = false;
        }
      }
      return Object.freeze({ ok: false, reason: 'frame-accepted-handler-error' });
    }
    if (disposed || generation !== attempt.generation || activeAttempt !== attempt) {
      if (frame !== currentFrame?.resource) releaseOnce(frame);
      return Object.freeze({
        ok: false,
        reason: disposed ? 'disposed' : 'state-changed-during-frame-accepted',
      });
    }
    if (currentFrame?.generation === attempt.generation
      && currentFrame.visualRevision >= attempt.visualRevision) {
      activeAttempt = null;
      if (frame !== currentFrame.resource) releaseOnce(frame);
      advanceAfterAttempt(attempt);
      return Object.freeze({ ok: false, reason: 'non-monotonic-frame' });
    }
    activeAttempt = null;
    currentFrame = {
      resource: frame,
      generation: attempt.generation,
      visualRevision: attempt.visualRevision,
      attemptId: attempt.attemptId,
    };
    lastError = null;
    if (previous?.resource !== frame) releaseOnce(previous?.resource);
    if (!advanceAfterAttempt(attempt)) {
      if (visualRevision > attempt.visualRevision) {
        dirty = true;
        ready = false;
      } else {
        dirty = false;
        ready = true;
      }
    }
    return Object.freeze({ ok: true, attemptId: attempt.attemptId });
  }

  function rejectAttempt(attempt, reason) {
    if (!isActiveAttempt(attempt)) return Object.freeze({ ok: false, reason: 'stale-attempt' });
    attempt.settled = true;
    activeAttempt = null;
    report(
      reason instanceof Error ? reason : new Error(String(reason || 'Raster capture rejected.')),
      'capture-rejected',
      attempt,
    );
    if (!advanceAfterAttempt(attempt)) {
      dirty = true;
      ready = false;
    }
    return Object.freeze({ ok: true, attemptId: attempt.attemptId });
  }

  function advanceCapture() {
    if (disposed
      || activeAttempt
      || !pending
      || !ready
      || dirty
      || readyRevision !== visualRevision) {
      return false;
    }
    if (currentFrame?.generation === generation
      && currentFrame.visualRevision >= readyRevision) {
      pending = false;
      return false;
    }
    pending = false;
    let attempt = {
      generation,
      visualRevision: readyRevision,
      attemptId: ++attemptSequence,
      controller: new AbortController(),
      settled: false,
    };
    activeAttempt = attempt;
    let request = Object.freeze({
      generation: attempt.generation,
      visualRevision: attempt.visualRevision,
      attemptId: attempt.attemptId,
      signal: attempt.controller.signal,
      complete: (frame) => completeAttempt(attempt, frame),
      reject: (reason) => rejectAttempt(attempt, reason),
    });
    let result;
    try {
      result = onCaptureNeeded(request);
    } catch (error) {
      rejectAttempt(attempt, error);
      return false;
    }
    if (result && typeof result.then === 'function') {
      Promise.resolve(result).then(
        (frame) => {
          if (frame === undefined) {
            rejectAttempt(attempt, new Error('Raster capture resolved without a frame resource.'));
          } else completeAttempt(attempt, frame);
        },
        (error) => rejectAttempt(attempt, error),
      );
    } else if (result !== undefined) {
      completeAttempt(attempt, result);
    }
    return true;
  }

  function startCapture(value) {
    if (disposed) return false;
    let next = revision(value, 'generation');
    if (next <= generation) return false;
    abortActive('Raster generation superseded.');
    generation = next;
    visualRevision = -1;
    readyRevision = -1;
    pending = false;
    dirty = true;
    ready = false;
    lastError = null;
    releaseOnce(currentFrame?.resource);
    currentFrame = null;
    return true;
  }

  function markDirty(value) {
    if (disposed) return false;
    let next = revision(value, 'visualRevision');
    if (next <= visualRevision) return false;
    visualRevision = next;
    pending = false;
    dirty = true;
    ready = false;
    return true;
  }

  function markReady(value) {
    if (disposed) return false;
    let next = revision(value, 'visualRevision');
    if (next < visualRevision) return false;
    if (next === readyRevision && !dirty && (activeAttempt || pending || currentFrame)) {
      return false;
    }
    if (next > visualRevision) visualRevision = next;
    readyRevision = next;
    dirty = false;
    ready = true;
    lastError = null;
    let acceptedRevision = currentFrame?.generation === generation
      ? currentFrame.visualRevision
      : -1;
    pending = activeAttempt
      ? next > activeAttempt.visualRevision
      : next > acceptedRevision;
    advanceCapture();
    return true;
  }

  function retry() {
    if (disposed
      || activeAttempt
      || !dirty
      || visualRevision < 0
      || readyRevision !== visualRevision
      || lastError?.generation !== generation
      || lastError?.visualRevision !== visualRevision) {
      return false;
    }
    dirty = false;
    ready = true;
    pending = true;
    lastError = null;
    advanceCapture();
    return true;
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    pending = false;
    abortActive('Raster source disposed.');
    releaseOnce(currentFrame?.resource);
    currentFrame = null;
    ready = false;
    dirty = false;
    return true;
  }

  return Object.freeze({
    startCapture,
    markDirty,
    markReady,
    retry,
    dispose,
    getState: () => Object.freeze({
      generation,
      visualRevision,
      capturing: Boolean(activeAttempt),
      activeAttempt: activeAttempt ? Object.freeze({
        generation: activeAttempt.generation,
        visualRevision: activeAttempt.visualRevision,
        attemptId: activeAttempt.attemptId,
      }) : null,
      currentFrame: currentFrame ? Object.freeze({ ...currentFrame, resource: currentFrame.resource }) : null,
      dirty,
      ready,
      pending,
      disposed,
      lastError,
    }),
  });
}
