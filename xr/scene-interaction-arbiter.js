const DEFAULT_HIT_EPSILON = 0.001;

function requiredId(value, name) {
  let result = String(value || '').trim();
  if (!result) throw new TypeError(`${name} must be a non-empty string.`);
  return result;
}

function targetGeneration(value) {
  let result = Number(value ?? 0);
  if (!Number.isInteger(result) || result < 0) {
    throw new TypeError('target.generation must be a non-negative integer.');
  }
  return result;
}

function finiteVector(value, name) {
  let vector = {
    x: Number(value?.x),
    y: Number(value?.y),
    z: Number(value?.z),
  };
  if (!Object.values(vector).every(Number.isFinite)) {
    throw new TypeError(`${name} must contain finite x, y and z coordinates.`);
  }
  return Object.freeze(vector);
}

function normalizedRay(value) {
  let origin = finiteVector(value?.origin, 'ray.origin');
  let direction = finiteVector(value?.direction, 'ray.direction');
  let length = Math.hypot(direction.x, direction.y, direction.z);
  if (!(length > 0)) throw new TypeError('ray.direction must be non-zero.');
  return Object.freeze({
    origin,
    direction: Object.freeze({
      x: direction.x / length,
      y: direction.y / length,
      z: direction.z / length,
    }),
  });
}

function mutableKey(ownerId, targetId) {
  return `${ownerId}\u0000${targetId}`;
}

function stableKey(ownerId, targetId, generation) {
  return `${mutableKey(ownerId, targetId)}\u0000${String(generation).padStart(12, '0')}`;
}

function identityFor(sourceId, target) {
  return Object.freeze({
    sourceId,
    ownerId: target.ownerId,
    targetId: target.id,
    targetGeneration: target.generation,
  });
}

function targetObjects(target) {
  let values = target.getCandidateObjects ? target.getCandidateObjects() : target.objects;
  if (!Array.isArray(values)) {
    throw new TypeError(`Target "${target.id}" candidate provider must return an array.`);
  }
  return [...new Set(values.filter(Boolean))];
}

function scalarPoint(value, dimensions = 3) {
  if (!value || typeof value !== 'object') return null;
  let point = { x: Number(value.x), y: Number(value.y) };
  if (dimensions === 3) point.z = Number(value.z);
  return Object.values(point).every(Number.isFinite) ? Object.freeze(point) : null;
}

function scalarString(value) {
  return ['string', 'number', 'boolean'].includes(typeof value) ? String(value) : null;
}

function scalarPrimitive(value) {
  if (typeof value === 'string') return value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function scalarNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  let result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function scalarFrameTarget(value) {
  if (!value || typeof value !== 'object') return null;
  return Object.freeze({
    version: scalarString(value.version),
    panelId: scalarString(value.panelId),
    zone: scalarString(value.zone),
    operation: scalarString(value.operation),
    action: scalarString(value.action),
    handle: scalarString(value.handle),
    point: scalarPoint(value.point, 2),
  });
}

function scalarRawHit(value) {
  if (!value || typeof value !== 'object') return null;
  let worldPoint = scalarPoint(value.worldPoint || value.point, 3);
  return Object.freeze({
    object: value.object || null,
    distance: scalarNumber(value.distance),
    point: worldPoint,
    worldPoint,
    localPoint: scalarPoint(value.localPoint, 3),
    uv: scalarPoint(value.uv, 2),
    normal: scalarPoint(value.normal, 3),
    primitive: scalarPrimitive(value.primitive),
    primitiveId: scalarPrimitive(value.primitiveId),
    instanceId: scalarNumber(value.instanceId),
    index: scalarNumber(value.index),
    faceIndex: scalarNumber(value.faceIndex),
    frameTarget: scalarFrameTarget(value.frameTarget),
  });
}

function scalarResolvedHit(value) {
  if (!value || typeof value !== 'object') return null;
  return Object.freeze({
    panelId: scalarString(value.panelId),
    primitiveId: scalarPrimitive(value.primitiveId ?? value.primitive),
    primitive: scalarPrimitive(value.primitive ?? value.primitiveId),
    zone: scalarString(value.zone ?? value.frameTarget?.zone),
    operation: scalarString(value.operation ?? value.frameTarget?.operation),
    action: scalarString(value.action ?? value.frameTarget?.action),
    handle: scalarString(value.handle ?? value.frameTarget?.handle),
    acquire: value.acquire !== false,
    distance: scalarNumber(value.distance),
    contentPoint: scalarPoint(value.contentPoint, 2),
    worldPoint: scalarPoint(value.worldPoint, 3),
    localPoint: scalarPoint(value.localPoint, 3),
    uv: scalarPoint(value.uv, 2),
    frameTarget: scalarFrameTarget(value.frameTarget),
    hit: scalarRawHit(value.hit),
  });
}

function latchedCaptureHit(hit) {
  let raw = scalarRawHit(hit);
  return Object.freeze({
    ...raw,
    targetKey: scalarString(hit.targetKey),
    targetId: scalarString(hit.targetId),
    resolved: scalarResolvedHit(hit.resolved),
    acquire: hit.acquire !== false,
  });
}

/**
 * Owns scene-wide pointer arbitration. Targets provide side-effect-free
 * candidate lists; the arbiter normalizes one ray per source, selects one
 * deterministic winner, and owns every capture and mutable-target lease.
 */
export function createSceneInteractionArbiter(options = {}) {
  let epsilon = Number(options.hitEpsilon ?? DEFAULT_HIT_EPSILON);
  if (!Number.isFinite(epsilon) || epsilon < 0) {
    throw new TypeError('hitEpsilon must be a finite non-negative number.');
  }
  let onError = typeof options.onError === 'function' ? options.onError : null;
  let targets = new Map();
  let mutableTargets = new Map();
  let objectTargets = new WeakMap();
  let captures = new Map();
  let targetLeases = new Map();
  let winningHits = new Map();
  let pressHits = new Map();
  let sourceFrames = new Map();
  let transitionSources = new Set();
  let disposed = false;

  function report(error, context) {
    let wrapped = error instanceof Error ? error : new Error(String(error));
    try {
      onError?.(wrapped, Object.freeze({ ...context }));
    } catch {
      // Diagnostics must never interrupt interaction cleanup.
    }
  }

  function safeHandler(target, name, args, context) {
    let handler = target?.[name];
    if (typeof handler !== 'function') return { ok: true };
    try {
      return { ok: true, value: handler(...args) };
    } catch (error) {
      report(error, { ...context, handler: name });
      return { ok: false, error };
    }
  }

  function releaseLease(sourceId, capture) {
    let key = mutableKey(capture.identity.ownerId, capture.identity.targetId);
    if (targetLeases.get(key) === sourceId) targetLeases.delete(key);
  }

  function notifyCancel(capture, reason, detail = null) {
    if (!capture || capture.cancelNotified) return;
    capture.cancelNotified = true;
    let frame = sourceFrames.get(capture.identity.sourceId) || null;
    safeHandler(capture.target, 'onCancel', [capture.identity, Object.freeze({
      reason,
      detail,
      nextSourceId: detail?.nextSourceId || null,
      captureHit: capture.hit,
      winningHit: winningHits.get(capture.identity.sourceId) || null,
      ray: frame?.ray || null,
      source: frame?.source || null,
    })], {
      reason,
      sourceId: capture.identity.sourceId,
      targetId: capture.identity.targetId,
    });
  }

  function cancelCapture(sourceId, reason, detail = null) {
    let capture = captures.get(sourceId);
    if (!capture) return false;
    let ownsTransition = !transitionSources.has(sourceId);
    if (ownsTransition) transitionSources.add(sourceId);
    try {
      captures.delete(sourceId);
      releaseLease(sourceId, capture);
      notifyCancel(capture, reason, detail);
      return true;
    } finally {
      if (ownsTransition) transitionSources.delete(sourceId);
    }
  }

  function notifyHover(sourceId, hit, phase) {
    if (!hit?.target) return true;
    let frame = sourceFrames.get(sourceId) || null;
    let result = safeHandler(hit.target, 'onHover', [identityFor(sourceId, hit.target), Object.freeze({
      phase,
      hit,
      ray: frame?.ray || null,
      source: frame?.source || null,
    })], { phase, sourceId, targetId: hit.target.id });
    if (!result.ok) cancelCapture(sourceId, 'hover-handler-error', result.error);
    return result.ok;
  }

  function clearWinner(sourceId, reason = 'hover-left') {
    let previous = winningHits.get(sourceId);
    winningHits.delete(sourceId);
    pressHits.delete(sourceId);
    if (previous) notifyHover(sourceId, previous, reason === 'hover-left' ? 'leave' : reason);
  }

  function setWinner(sourceId, next) {
    let previous = winningHits.get(sourceId) || null;
    if (!next) {
      clearWinner(sourceId);
      return;
    }
    let changed = previous?.targetKey !== next.targetKey;
    if (changed && previous) notifyHover(sourceId, previous, 'leave');
    winningHits.set(sourceId, next);
    if (!notifyHover(sourceId, next, changed ? 'enter' : 'move')) {
      winningHits.delete(sourceId);
    }
  }

  function clearSource(sourceId, reason) {
    cancelCapture(sourceId, reason);
    clearWinner(sourceId, reason);
    sourceFrames.delete(sourceId);
  }

  function removeTarget(targetKey, reason = 'target-unregistered', expectedTarget = null) {
    let target = targets.get(targetKey);
    if (!target || (expectedTarget && target !== expectedTarget)) return false;
    targets.delete(targetKey);
    if (mutableTargets.get(target.mutableKey) === targetKey) mutableTargets.delete(target.mutableKey);
    for (let object of target.mappedObjects) {
      if (objectTargets.get(object) === targetKey) objectTargets.delete(object);
    }
    for (let [sourceId, capture] of [...captures]) {
      if (capture.target === target) cancelCapture(sourceId, reason);
    }
    for (let [sourceId, winner] of [...winningHits]) {
      if (winner.target === target) clearWinner(sourceId, reason);
    }
    return true;
  }

  function refreshTargetObjects(target) {
    let next = targetObjects(target);
    for (let object of next) {
      let owner = objectTargets.get(object);
      if (owner && owner !== target.key) {
        throw new Error(`Interaction object is already registered by target "${targets.get(owner)?.id || owner}".`);
      }
    }
    let previous = target.mappedObjects;
    let removed = previous.filter((object) => !next.includes(object));
    for (let object of previous) {
      if (!next.includes(object) && objectTargets.get(object) === target.key) objectTargets.delete(object);
    }
    for (let object of next) {
      objectTargets.set(object, target.key);
    }
    target.mappedObjects = next;
    if (removed.length) {
      let belongsTo = (object, roots) => {
        for (let current = object; current; current = current.parent) {
          if (roots.includes(current)) return true;
        }
        return false;
      };
      for (let [sourceId, capture] of [...captures]) {
        if (capture.target === target
          && belongsTo(capture.hit.object, removed)
          && !belongsTo(capture.hit.object, next)) {
          cancelCapture(sourceId, 'target-object-lost');
        }
      }
      for (let [sourceId, winner] of [...winningHits]) {
        if (winner.target === target
          && belongsTo(winner.object, removed)
          && !belongsTo(winner.object, next)) {
          clearWinner(sourceId, 'target-object-lost');
        }
      }
    }
    return next;
  }

  function resolveTarget(object) {
    for (let current = object; current; current = current.parent) {
      let key = objectTargets.get(current);
      if (key && targets.has(key)) return targets.get(key);
    }
    return null;
  }

  function compareHits(a, b) {
    let delta = a.distance - b.distance;
    if (Math.abs(delta) > epsilon) return delta;
    let priority = b.target.priority - a.target.priority;
    if (priority) return priority;
    let keyOrder = a.targetKey.localeCompare(b.targetKey);
    if (keyOrder) return keyOrder;
    return delta;
  }

  function candidateHit(rawHit) {
    let distance = Number(rawHit?.distance);
    if (!Number.isFinite(distance) || distance < 0) return null;
    let target = resolveTarget(rawHit?.object);
    if (!target) return null;
    let resolved = null;
    if (typeof target.resolveHit === 'function') {
      try {
        resolved = target.resolveHit(rawHit);
      } catch (error) {
        report(error, { reason: 'target-hit-resolution-error', targetId: target.id });
        return null;
      }
      if (!resolved) return null;
    }
    return Object.freeze({
      ...rawHit,
      distance,
      target,
      targetKey: target.key,
      targetId: target.id,
      resolved,
      acquire: target.acquire && resolved?.acquire !== false,
    });
  }

  function registerTarget(input) {
    if (disposed) throw new Error('Cannot register an interaction target after arbiter disposal.');
    if (!input || typeof input !== 'object') throw new TypeError('target must be an object.');
    let ownerId = requiredId(input.ownerId, 'target.ownerId');
    let id = requiredId(input.id, 'target.id');
    let generation = targetGeneration(input.generation);
    let priority = Number(input.priority ?? 0);
    if (!Number.isFinite(priority)) throw new TypeError('target.priority must be finite.');
    let key = stableKey(ownerId, id, generation);
    let mutable = mutableKey(ownerId, id);
    let previousKey = mutableTargets.get(mutable);
    let previous = previousKey ? targets.get(previousKey) || null : null;
    let target = {
      ...input,
      id,
      ownerId,
      generation,
      priority,
      acquire: input.acquire !== false,
      key,
      mutableKey: mutable,
      mappedObjects: [],
    };
    let mappedObjects = targetObjects(target);
    for (let object of mappedObjects) {
      let owner = objectTargets.get(object);
      if (owner && owner !== previous?.key) {
        throw new Error(`Interaction object is already registered by target "${targets.get(owner)?.id || owner}".`);
      }
    }
    target.mappedObjects = mappedObjects;
    if (previous) {
      for (let object of previous.mappedObjects) {
        if (!mappedObjects.includes(object) && objectTargets.get(object) === previous.key) objectTargets.delete(object);
      }
      if (previous.key !== key) targets.delete(previous.key);
    }
    targets.set(key, target);
    mutableTargets.set(mutable, key);
    for (let object of mappedObjects) objectTargets.set(object, key);
    if (previous) {
      let reason = previous.generation === generation
        ? 'target-registration-replaced'
        : 'target-generation-replaced';
      for (let [sourceId, capture] of [...captures]) {
        if (capture.target === previous) cancelCapture(sourceId, reason);
      }
      for (let [sourceId, winner] of [...winningHits]) {
        if (winner.target === previous) clearWinner(sourceId, reason);
      }
    }
    let active = true;
    return () => {
      if (!active) return false;
      active = false;
      return removeTarget(key, 'target-unregistered', target);
    };
  }

  function getCandidateObjects() {
    if (disposed) return [];
    let result = [];
    let seen = new Set();
    for (let target of targets.values()) {
      let objects;
      try {
        objects = refreshTargetObjects(target);
      } catch (error) {
        report(error, { reason: 'candidate-provider-error', targetId: target.id });
        objects = [...target.mappedObjects];
      }
      for (let object of objects) {
        if (!seen.has(object)) {
          seen.add(object);
          result.push(object);
        }
      }
    }
    return result;
  }

  function updateFrame(sources, normalizeSourceRay, intersectRay) {
    if (disposed) return Object.freeze([]);
    if (!Array.isArray(sources)) throw new TypeError('sources must be an array.');
    if (typeof normalizeSourceRay !== 'function' || typeof intersectRay !== 'function') {
      throw new TypeError('updateFrame requires normalizeSourceRay and intersectRay functions.');
    }
    let uniqueSources = new Map();
    for (let source of sources) {
      let sourceId = requiredId(source?.id, 'source.id');
      if (uniqueSources.has(sourceId)) throw new Error(`Duplicate interaction source id "${sourceId}".`);
      uniqueSources.set(sourceId, source);
    }
    for (let sourceId of [...sourceFrames.keys()]) {
      if (!uniqueSources.has(sourceId)) clearSource(sourceId, 'source-lost');
    }
    let objects = null;
    let winners = [];
    for (let [sourceId, source] of uniqueSources) {
      let ray;
      try {
        ray = normalizedRay(normalizeSourceRay(source));
      } catch (error) {
        report(error, { reason: 'ray-normalization-error', sourceId });
        let capture = captures.get(sourceId);
        if (capture) {
          let previousRay = sourceFrames.get(sourceId)?.ray || null;
          sourceFrames.set(sourceId, { source, ray: previousRay });
          let move = safeHandler(capture.target, 'onMove', [capture.identity, Object.freeze({
            source,
            ray: previousRay,
            captureHit: capture.hit,
            winningHit: null,
          })], { reason: 'move', sourceId, targetId: capture.identity.targetId });
          if (!move.ok) cancelCapture(sourceId, 'move-handler-error', move.error);
        } else {
          clearWinner(sourceId, 'ray-normalization-error');
          sourceFrames.set(sourceId, { source, ray: null });
        }
        continue;
      }
      sourceFrames.set(sourceId, { source, ray });
      let capture = captures.get(sourceId);
      if (capture) {
        if (!targets.has(capture.targetKey)) {
          cancelCapture(sourceId, 'target-lost');
          continue;
        }
        let move = safeHandler(capture.target, 'onMove', [capture.identity, Object.freeze({
          source,
          ray,
          captureHit: capture.hit,
          winningHit: null,
        })], { reason: 'move', sourceId, targetId: capture.identity.targetId });
        if (!move.ok) cancelCapture(sourceId, 'move-handler-error', move.error);
        continue;
      }
      if (!objects) objects = getCandidateObjects();
      let rawHits;
      try {
        rawHits = intersectRay(Object.freeze({ sourceId, source, ray, objects: [...objects] }));
        if (!Array.isArray(rawHits)) throw new TypeError('intersectRay must return an array.');
      } catch (error) {
        report(error, { reason: 'intersection-error', sourceId });
        clearWinner(sourceId, 'intersection-error');
        continue;
      }
      let hits = rawHits.map(candidateHit).filter(Boolean).sort(compareHits);
      let winner = hits[0] || null;
      setWinner(sourceId, winner);
      // Hover-only surfaces (for example the expanded menu reveal area) must
      // not make an actionable mesh in the same logical panel impossible to
      // press. They still occlude every other target, so input never tunnels
      // through a panel into equipment behind it.
      let pressHit = winner?.acquire === false
        ? hits.find((hit) => hit.targetKey === winner.targetKey && hit.acquire !== false) || winner
        : winner;
      if (pressHit) pressHits.set(sourceId, pressHit);
      else pressHits.delete(sourceId);
      if (winner) winners.push(winner);
    }
    return Object.freeze(winners);
  }

  function handlePress(sourceIdValue) {
    if (disposed) return Object.freeze({ ok: false, reason: 'disposed' });
    let sourceId = requiredId(sourceIdValue, 'sourceId');
    if (transitionSources.has(sourceId)) {
      return Object.freeze({ ok: false, reason: 'source-transition-active' });
    }
    transitionSources.add(sourceId);
    try {
      if (captures.has(sourceId)) return Object.freeze({ ok: false, reason: 'source-already-captured' });
      let hit = pressHits.get(sourceId) || winningHits.get(sourceId);
      if (!hit) return Object.freeze({ ok: false, reason: 'no-winner' });
      let target = targets.get(hit.targetKey);
      if (!target || mutableTargets.get(target.mutableKey) !== target.key) {
        clearWinner(sourceId, 'target-stale');
        return Object.freeze({ ok: false, reason: 'target-stale' });
      }
      if (!target.acquire || hit.acquire === false) return Object.freeze({ ok: false, reason: 'non-acquiring-target' });
      let leaseOwner = targetLeases.get(target.mutableKey);
      if (leaseOwner && leaseOwner !== sourceId) {
        if (target.allowHandoff !== true) {
          return Object.freeze({ ok: false, reason: 'target-leased', sourceId: leaseOwner });
        }
        let previousCapture = captures.get(leaseOwner) || null;
        if (!previousCapture || previousCapture.targetKey !== target.key) {
          targetLeases.delete(target.mutableKey);
        } else if (!cancelCapture(leaseOwner, 'target-handoff', { nextSourceId: sourceId })) {
          return Object.freeze({ ok: false, reason: 'handoff-cancel-failed', sourceId: leaseOwner });
        }
      }
      let identity = identityFor(sourceId, target);
      let captureHit = latchedCaptureHit(hit);
      let capture = { identity, target, targetKey: target.key, hit: captureHit, cancelNotified: false };
      captures.set(sourceId, capture);
      targetLeases.set(target.mutableKey, sourceId);
      let frame = sourceFrames.get(sourceId) || null;
      let press = safeHandler(target, 'onPress', [identity, Object.freeze({
        hit: captureHit,
        ray: frame?.ray || null,
        source: frame?.source || null,
      })], { reason: 'press', sourceId, targetId: target.id });
      if (!press.ok) {
        cancelCapture(sourceId, 'press-handler-error', press.error);
        return Object.freeze({ ok: false, reason: 'press-handler-error' });
      }
      return Object.freeze({ ok: true, identity });
    } finally {
      transitionSources.delete(sourceId);
    }
  }

  function handleRelease(sourceIdValue) {
    let sourceId = requiredId(sourceIdValue, 'sourceId');
    if (transitionSources.has(sourceId)) {
      return Object.freeze({ ok: false, reason: 'source-transition-active' });
    }
    transitionSources.add(sourceId);
    try {
      let capture = captures.get(sourceId);
      if (!capture) return Object.freeze({ ok: false, reason: 'source-not-captured' });
      captures.delete(sourceId);
      releaseLease(sourceId, capture);
      let frame = sourceFrames.get(sourceId) || null;
      let release = safeHandler(capture.target, 'onRelease', [capture.identity, Object.freeze({
        ray: frame?.ray || null,
        source: frame?.source || null,
        captureHit: capture.hit,
        winningHit: winningHits.get(sourceId) || null,
      })], { reason: 'release', sourceId, targetId: capture.identity.targetId });
      if (!release.ok) {
        notifyCancel(capture, 'release-handler-error', release.error);
        return Object.freeze({ ok: false, reason: 'release-handler-error', error: release.error });
      }
      return Object.freeze({ ok: true, identity: capture.identity });
    } finally {
      transitionSources.delete(sourceId);
    }
  }

  function handleCancel(sourceIdValue, reason = 'source-cancelled') {
    let sourceId = requiredId(sourceIdValue, 'sourceId');
    if (transitionSources.has(sourceId)) return false;
    transitionSources.add(sourceId);
    try {
      return cancelCapture(sourceId, reason);
    } finally {
      transitionSources.delete(sourceId);
    }
  }

  function handleSourceLost(sourceIdValue) {
    let sourceId = requiredId(sourceIdValue, 'sourceId');
    let existed = captures.has(sourceId) || winningHits.has(sourceId) || sourceFrames.has(sourceId);
    clearSource(sourceId, 'source-lost');
    return existed;
  }

  function cancelTarget(identity, reason = 'target-cancelled') {
    let ownerId = requiredId(identity?.ownerId, 'identity.ownerId');
    let targetId = requiredId(identity?.targetId, 'identity.targetId');
    let generation = targetGeneration(identity?.targetGeneration);
    let key = stableKey(ownerId, targetId, generation);
    let count = 0;
    for (let [sourceId, capture] of [...captures]) {
      if (capture.targetKey === key && cancelCapture(sourceId, reason)) count += 1;
    }
    return count;
  }

  function cancelAll(reason = 'session-ended') {
    let count = 0;
    for (let sourceId of [...captures.keys()]) {
      if (cancelCapture(sourceId, reason)) count += 1;
    }
    for (let sourceId of [...winningHits.keys()]) clearWinner(sourceId, reason);
    sourceFrames.clear();
    return count;
  }

  function handleVisibilityChange(state) {
    if (state === 'hidden') return cancelAll('visibility-hidden');
    return 0;
  }

  function dispose() {
    if (disposed) return false;
    disposed = true;
    cancelAll('disposed');
    targets.clear();
    mutableTargets.clear();
    targetLeases.clear();
    pressHits.clear();
    transitionSources.clear();
    objectTargets = new WeakMap();
    return true;
  }

  return Object.freeze({
    registerTarget,
    getCandidateObjects,
    updateFrame,
    handlePress,
    handleRelease,
    handleCancel,
    handleSourceLost,
    cancelTarget,
    cancelAll,
    handleSessionEnd: () => cancelAll('session-ended'),
    handleVisibilityChange,
    getCapture: (sourceId) => captures.get(sourceId) || null,
    getWinningHit: (sourceId) => winningHits.get(sourceId) || null,
    getDiagnostics: () => Object.freeze({
      targets: targets.size,
      captures: captures.size,
      leases: targetLeases.size,
      sources: sourceFrames.size,
      disposed,
    }),
    dispose,
  });
}
