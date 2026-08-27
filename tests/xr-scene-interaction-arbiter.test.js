import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneInteractionArbiter } from '../xr/scene-interaction-arbiter.js';

const ray = (x = 0) => ({
  origin: { x, y: 1, z: 2 },
  direction: { x: 0, y: 0, z: -4 },
});

test('scene arbiter normalizes one ray, intersects once and selects a deterministic exact primitive', () => {
  let low = {};
  let high = {};
  let normalizations = 0;
  let intersections = 0;
  let arbiter = createSceneInteractionArbiter({ hitEpsilon: 0.001 });
  arbiter.registerTarget({
    ownerId: 'panels', id: 'low', generation: 3, priority: 1, objects: [low],
    resolveHit: (hit) => ({ primitiveId: `low:${hit.slot}`, contentPoint: hit.contentPoint }),
  });
  arbiter.registerTarget({
    ownerId: 'panels', id: 'high', generation: 4, priority: 8, objects: [high],
    resolveHit: (hit) => ({ primitiveId: `high:${hit.slot}`, contentPoint: hit.contentPoint }),
  });

  let winners = arbiter.updateFrame(
    [{ id: 'right', marker: 7 }],
    (source) => {
      normalizations += 1;
      assert.equal(source.marker, 7);
      return ray();
    },
    ({ sourceId, source, ray: normalized, objects }) => {
      intersections += 1;
      assert.equal(sourceId, 'right');
      assert.equal(source.marker, 7);
      assert.deepEqual(normalized.direction, { x: 0, y: 0, z: -1 });
      assert.deepEqual(objects, [low, high]);
      return [
        { object: low, distance: 1, slot: 'content', contentPoint: { x: 0.2, y: 0.4 } },
        { object: high, distance: 1.0004, slot: 'close', contentPoint: null },
      ];
    },
  );

  assert.equal(normalizations, 1);
  assert.equal(intersections, 1);
  assert.equal(winners.length, 1);
  assert.equal(winners[0], arbiter.getWinningHit('right'));
  assert.equal(winners[0].targetId, 'high', 'priority breaks only an epsilon-distance tie');
  assert.equal(winners[0].resolved.primitiveId, 'high:close');
  assert.equal(winners[0].distance, 1.0004, 'arbiter never rewrites scene distances');
});

test('capture hands off exact hit and stable generation without re-raycasting the captured source', () => {
  let objectA = {};
  let objectB = {};
  let events = [];
  let arbiter = createSceneInteractionArbiter();
  arbiter.registerTarget({
    ownerId: 'xr-shell', id: 'panel-a', generation: 12, objects: [objectA],
    resolveHit: (hit) => ({ primitiveId: hit.primitiveId, contentPoint: hit.contentPoint }),
    onPress: (identity, details) => events.push(['press', identity, details]),
    onMove: (identity, details) => events.push(['move', identity, details]),
    onRelease: (identity, details) => events.push(['release', identity, details]),
  });
  arbiter.registerTarget({
    ownerId: 'xr-shell', id: 'panel-b', generation: 2, objects: [objectB],
    resolveHit: (hit) => ({ primitiveId: hit.primitiveId }),
  });
  let hitBySource = new Map([
    ['left', { object: objectA, distance: 0.8, primitiveId: 'panel-a/resize-ne', contentPoint: { x: 1, y: 0 } }],
    ['right', { object: objectA, distance: 0.9, primitiveId: 'panel-a/content' }],
  ]);
  let update = () => arbiter.updateFrame(
    [{ id: 'left' }, { id: 'right' }],
    (source) => ray(source.id === 'left' ? -1 : 1),
    ({ sourceId }) => [hitBySource.get(sourceId)].filter(Boolean),
  );
  update();
  assert.deepEqual(arbiter.handlePress('left'), {
    ok: true,
    identity: { sourceId: 'left', ownerId: 'xr-shell', targetId: 'panel-a', targetGeneration: 12 },
  });
  assert.deepEqual(arbiter.handlePress('right'), { ok: false, reason: 'target-leased', sourceId: 'left' });

  let captureHit = arbiter.getCapture('left').hit;
  hitBySource.set('left', { object: objectB, distance: 0.4, primitiveId: 'panel-b/content' });
  update();
  let move = events.find(([phase]) => phase === 'move');
  assert.equal(move[2].captureHit, captureHit);
  assert.equal(move[2].winningHit, null, 'captured movement does not depend on a new ray winner');
  assert.deepEqual(move[1], {
    sourceId: 'left', ownerId: 'xr-shell', targetId: 'panel-a', targetGeneration: 12,
  });

  assert.equal(arbiter.handleRelease('left').ok, true);
  let release = events.find(([phase]) => phase === 'release');
  assert.equal(release[2].captureHit, captureHit, 'release is routed to the captured primitive without a second raycast');
  assert.equal(release[2].winningHit.resolved.primitiveId, 'panel-a/resize-ne', 'the frozen focus remains on the press-time primitive');
  assert.equal(arbiter.getCapture('left'), null);
  assert.equal(arbiter.handlePress('right').ok, true, 'lease is released exactly once');
});

test('captured focus freezes raycast until release and resumes closest-hit selection afterwards', () => {
  let object = {};
  let intersections = 0;
  let moves = 0;
  let arbiter = createSceneInteractionArbiter();
  arbiter.registerTarget({
    ownerId: 'equipment', id: 'assembly', generation: 1, objects: [object],
    resolveHit: () => ({ primitiveId: 'equipment/body' }),
    onMove: (_identity, details) => {
      moves += 1;
      assert.equal(details.winningHit, null);
    },
  });
  let update = () => arbiter.updateFrame(
    [{ id: 'right', controller: {} }],
    () => ray(),
    () => {
      intersections += 1;
      return [{ object, distance: 1 }];
    },
  );
  update();
  assert.equal(intersections, 1);
  assert.equal(arbiter.handlePress('right').ok, true);
  update();
  update();
  assert.equal(intersections, 1, 'full-mesh intersection is frozen for the captured source');
  assert.equal(moves, 2);
  assert.equal(arbiter.getWinningHit('right')?.resolved?.primitiveId, 'equipment/body', 'last focus remains visible');
  assert.equal(arbiter.handleRelease('right').ok, true);
  update();
  assert.equal(intersections, 2, 'raycast resumes on the first post-release frame');
  assert.equal(arbiter.getWinningHit('right')?.resolved?.primitiveId, 'equipment/body');

  assert.equal(arbiter.handlePress('right').ok, true);
  update();
  assert.equal(intersections, 2);
  assert.equal(arbiter.handleCancel('right', 'select-cancelled'), true);
  update();
  assert.equal(intersections, 3, 'cancel restores focus eligibility exactly like release');
});

test('an explicitly handoff-capable target transfers its lease atomically between input sources', () => {
  let object = {};
  let events = [];
  let arbiter = createSceneInteractionArbiter();
  arbiter.registerTarget({
    ownerId: 'equipment', id: 'assembly', generation: 4, objects: [object],
    allowHandoff: true,
    resolveHit: () => ({ primitiveId: 'equipment/body' }),
    onPress: (identity) => events.push(['press', identity.sourceId]),
    onCancel: (identity, details) => events.push(['cancel', identity.sourceId, details.reason, details.nextSourceId]),
  });
  let update = () => arbiter.updateFrame(
    [{ id: 'left' }, { id: 'right' }],
    () => ray(),
    () => [{ object, distance: 1 }],
  );
  update();
  assert.equal(arbiter.handlePress('left').ok, true);
  assert.equal(arbiter.handlePress('right').ok, true);
  assert.equal(arbiter.getCapture('left'), null);
  assert.equal(arbiter.getCapture('right')?.identity.sourceId, 'right');
  assert.deepEqual(events, [
    ['press', 'left'],
    ['cancel', 'left', 'target-handoff', 'right'],
    ['press', 'right'],
  ]);
  assert.deepEqual(arbiter.getDiagnostics(), {
    targets: 1, captures: 1, leases: 1, sources: 2, disposed: false,
  });
});

test('capture latches immutable scalar geometry while retaining exact object identity', () => {
  let object = {};
  let rawHit = {
    object,
    distance: 0.75,
    point: { x: 1, y: 2, z: 3 },
    localPoint: { x: 0.1, y: 0.2, z: 0.3 },
    uv: { x: 0.25, y: 0.75 },
    primitive: 'corner-ne',
  };
  let resolved;
  let releases = [];
  let arbiter = createSceneInteractionArbiter();
  arbiter.registerTarget({
    ownerId: 'panels', id: 'immutable', generation: 4, objects: [object],
    resolveHit: (hit) => {
      resolved = {
        panelId: 'immutable',
        primitiveId: 'immutable/resize-northEast',
        operation: 'resize',
        handle: 'northEast',
        contentPoint: hit.uv,
        frameTarget: { panelId: 'immutable', zone: 'resize', operation: 'resize', handle: 'northEast', point: hit.uv },
        hit,
      };
      return resolved;
    },
    onRelease: (identity, details) => releases.push({ identity, details }),
  });
  arbiter.updateFrame([{ id: 'right' }], () => ray(), () => [rawHit]);
  assert.equal(arbiter.handlePress('right').ok, true);
  let capture = arbiter.getCapture('right').hit;

  rawHit.distance = 99;
  rawHit.point.x = 99;
  rawHit.localPoint.y = 99;
  rawHit.uv.x = 0.99;
  resolved.primitiveId = 'mutated';
  resolved.frameTarget.handle = 'southWest';

  assert.equal(capture.object, object);
  assert.equal(capture.resolved.hit.object, object);
  assert.deepEqual(capture.point, { x: 1, y: 2, z: 3 });
  assert.deepEqual(capture.localPoint, { x: 0.1, y: 0.2, z: 0.3 });
  assert.deepEqual(capture.uv, { x: 0.25, y: 0.75 });
  assert.equal(capture.distance, 0.75);
  assert.equal(capture.resolved.primitiveId, 'immutable/resize-northEast');
  assert.equal(capture.resolved.frameTarget.handle, 'northEast');
  assert.ok(Object.isFrozen(capture));
  assert.ok(Object.isFrozen(capture.point));
  assert.ok(Object.isFrozen(capture.resolved));
  assert.ok(Object.isFrozen(capture.resolved.frameTarget));

  assert.equal(arbiter.handleRelease('right').ok, true);
  assert.equal(releases[0].details.captureHit, capture);
});

test('target registration and candidate refresh are transactional', () => {
  let retained = {};
  let conflict = {};
  let ghost = {};
  let refreshGhost = {};
  let errors = [];
  let cancels = [];
  let arbiter = createSceneInteractionArbiter({ onError: (error, context) => errors.push({ error, context }) });
  let unregisterOld = arbiter.registerTarget({
    ownerId: 'owner', id: 'panel', generation: 1, objects: [retained],
    resolveHit: () => ({ primitiveId: 'panel/content' }),
    onCancel: (identity, details) => cancels.push([identity, details]),
  });
  arbiter.registerTarget({
    ownerId: 'other', id: 'conflict', generation: 0, objects: [conflict],
    resolveHit: () => ({ primitiveId: 'other/content' }),
  });
  arbiter.updateFrame([{ id: 'source' }], () => ray(), () => [{ object: retained, distance: 1 }]);
  assert.equal(arbiter.handlePress('source').ok, true);

  assert.throws(() => arbiter.registerTarget({
    ownerId: 'owner', id: 'panel', generation: 2, objects: [ghost, conflict],
    resolveHit: () => ({ primitiveId: 'replacement/content' }),
  }), /already registered/);
  assert.equal(arbiter.getCapture('source')?.identity.targetGeneration, 1, 'failed replacement keeps the old capture');
  assert.deepEqual(arbiter.getCandidateObjects(), [retained, conflict], 'failed replacement leaves no ghost mapping');
  let unregisterGhost = arbiter.registerTarget({
    ownerId: 'third', id: 'ghost', generation: 0, objects: [ghost],
    resolveHit: () => ({ primitiveId: 'ghost/content' }),
  });

  let dynamicObjects = [refreshGhost];
  arbiter.registerTarget({
    ownerId: 'dynamic', id: 'panel', generation: 0,
    getCandidateObjects: () => dynamicObjects,
    resolveHit: () => ({ primitiveId: 'dynamic/content' }),
  });
  dynamicObjects = [{}, conflict];
  let refreshCandidate = dynamicObjects[0];
  arbiter.getCandidateObjects();
  assert.equal(errors.at(-1).context.reason, 'candidate-provider-error');
  arbiter.registerTarget({
    ownerId: 'fourth', id: 'refresh-ghost', generation: 0, objects: [refreshCandidate],
    resolveHit: () => ({ primitiveId: 'refresh-ghost/content' }),
  });

  let unregisterReplacement = arbiter.registerTarget({
    ownerId: 'owner', id: 'panel', generation: 2, objects: [retained],
    resolveHit: () => ({ primitiveId: 'replacement/content' }),
  });
  assert.equal(cancels.length, 1);
  assert.equal(cancels[0][1].reason, 'target-generation-replaced');
  assert.equal(unregisterOld(), false, 'stale unregister cannot remove the replacement generation');
  assert.equal(arbiter.getCandidateObjects().includes(retained), true);
  assert.equal(unregisterReplacement(), true);
  assert.equal(unregisterGhost(), true);
});

test('candidate changes cannot cancel an active capture before explicit release', () => {
  let object = {};
  let conflict = {};
  let objects = [object];
  let cancellations = [];
  let arbiter = createSceneInteractionArbiter();
  arbiter.registerTarget({
    ownerId: 'other', id: 'conflict', objects: [conflict],
    resolveHit: () => ({ primitiveId: 'other/content' }),
  });
  arbiter.registerTarget({
    ownerId: 'owner', id: 'dynamic', generation: 3,
    getCandidateObjects: () => objects,
    resolveHit: () => ({ primitiveId: 'dynamic/content' }),
    onCancel: (identity, details) => cancellations.push([identity, details]),
  });
  let update = () => arbiter.updateFrame(
    [{ id: 'source' }],
    () => ray(),
    ({ objects: candidates }) => candidates.includes(object) ? [{ object, distance: 1 }] : [],
  );
  update();
  assert.equal(arbiter.handlePress('source').ok, true);
  objects = [{}, conflict];
  update();
  assert.equal(arbiter.getCapture('source')?.identity.targetGeneration, 3, 'failed refresh preserves capture');
  assert.equal(cancellations.length, 0);

  objects = [];
  update();
  assert.equal(arbiter.getCapture('source')?.identity.targetGeneration, 3);
  assert.equal(cancellations.length, 0, 'ray/candidate refresh is frozen while the source owns capture');
  assert.equal(arbiter.handleRelease('source').ok, true);
  update();
  assert.equal(arbiter.getCapture('source'), null);
  assert.equal(cancellations.length, 0);
  assert.equal(arbiter.getCandidateObjects().includes(object), false, 'candidate refresh resumes after release');
});

test('source transition callbacks reject reentrant press release and cancel without leaking leases', () => {
  let object = {};
  let events = [];
  let arbiter = createSceneInteractionArbiter();
  arbiter.registerTarget({
    ownerId: 'owner', id: 'panel', objects: [object],
    resolveHit: () => ({ primitiveId: 'panel/content' }),
    onPress: () => {
      events.push(['press/release', arbiter.handleRelease('source')]);
      events.push(['press/cancel', arbiter.handleCancel('source')]);
    },
    onRelease: () => {
      events.push(['release/press', arbiter.handlePress('source')]);
      events.push(['release/cancel', arbiter.handleCancel('source')]);
    },
  });
  let update = () => arbiter.updateFrame(
    [{ id: 'source' }],
    () => ray(),
    () => [{ object, distance: 1 }],
  );
  update();
  assert.equal(arbiter.handlePress('source').ok, true);
  assert.deepEqual(events, [
    ['press/release', { ok: false, reason: 'source-transition-active' }],
    ['press/cancel', false],
  ]);
  assert.equal(arbiter.getDiagnostics().captures, 1);
  assert.equal(arbiter.getDiagnostics().leases, 1);
  assert.equal(arbiter.handleRelease('source').ok, true);
  assert.deepEqual(events.slice(2), [
    ['release/press', { ok: false, reason: 'source-transition-active' }],
    ['release/cancel', false],
  ]);
  assert.equal(arbiter.getDiagnostics().captures, 0);
  assert.equal(arbiter.getDiagnostics().leases, 0);
  update();
  assert.equal(arbiter.handlePress('source').ok, true, 'source can acquire again after the callback chain exits');
});

test('generation replacement, source loss, visibility and session end cancel captures once', () => {
  let object = {};
  let cancellations = [];
  let arbiter = createSceneInteractionArbiter();
  let register = (generation) => arbiter.registerTarget({
    ownerId: 'owner', id: 'panel', generation, objects: [object],
    resolveHit: () => ({ primitiveId: 'panel/content' }),
    onCancel: (identity, details) => cancellations.push({ identity, reason: details.reason }),
  });
  register(1);
  let update = (ids = ['source']) => arbiter.updateFrame(
    ids.map((id) => ({ id })),
    () => ray(),
    () => [{ object, distance: 1 }],
  );
  update();
  arbiter.handlePress('source');
  register(2);
  assert.deepEqual(cancellations.map(({ reason }) => reason), ['target-generation-replaced']);
  assert.equal(cancellations[0].identity.targetGeneration, 1);

  update();
  arbiter.handlePress('source');
  assert.equal(arbiter.handleSourceLost('source'), true);
  assert.deepEqual(cancellations.map(({ reason }) => reason), ['target-generation-replaced', 'source-lost']);
  assert.equal(arbiter.handleSourceLost('source'), false);

  update();
  arbiter.handlePress('source');
  assert.equal(arbiter.handleVisibilityChange('hidden'), 1);
  assert.equal(arbiter.handleVisibilityChange('hidden'), 0);

  update();
  arbiter.handlePress('source');
  assert.equal(arbiter.handleSessionEnd(), 1);
  assert.deepEqual(cancellations.map(({ reason }) => reason), [
    'target-generation-replaced', 'source-lost', 'visibility-hidden', 'session-ended',
  ]);
});

test('non-acquiring primitives and thrown handlers cannot leak capture or target lease', () => {
  let passive = {};
  let broken = {};
  let errors = [];
  let cancels = 0;
  let arbiter = createSceneInteractionArbiter({ onError: (error, context) => errors.push({ error, context }) });
  arbiter.registerTarget({
    ownerId: 'owner', id: 'passive', generation: 0, objects: [passive],
    resolveHit: () => ({ primitiveId: 'reveal-strip', acquire: false }),
  });
  arbiter.registerTarget({
    ownerId: 'owner', id: 'broken', generation: 0, objects: [broken],
    resolveHit: () => ({ primitiveId: 'broken/button' }),
    onPress: () => { throw new Error('press failed'); },
    onCancel: () => { cancels += 1; },
  });
  let current = passive;
  arbiter.updateFrame([{ id: 'source' }], () => ray(), () => [{ object: current, distance: 1 }]);
  assert.deepEqual(arbiter.handlePress('source'), { ok: false, reason: 'non-acquiring-target' });
  current = broken;
  arbiter.updateFrame([{ id: 'source' }], () => ray(), () => [{ object: current, distance: 1 }]);
  assert.deepEqual(arbiter.handlePress('source'), { ok: false, reason: 'press-handler-error' });
  assert.equal(arbiter.getCapture('source'), null);
  assert.equal(arbiter.getDiagnostics().leases, 0);
  assert.equal(cancels, 1);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].context.handler, 'onPress');
});

test('hover-only surface yields press to an actionable hit in the same target without tunnelling across targets', () => {
  let hoverSurface = {};
  let actionSurface = {};
  let equipment = {};
  let presses = [];
  let arbiter = createSceneInteractionArbiter();
  arbiter.registerTarget({
    ownerId: 'workspace',
    id: 'panel',
    generation: 1,
    objects: [hoverSurface, actionSurface],
    resolveHit(hit) {
      return hit.object === hoverSurface
        ? { primitiveId: 'panel/reveal', acquire: false }
        : { primitiveId: 'panel/resize', acquire: true };
    },
    onPress(_identity, details) {
      presses.push(details.hit.resolved.primitiveId);
    },
  });
  arbiter.registerTarget({
    ownerId: 'scene',
    id: 'equipment',
    generation: 1,
    objects: [equipment],
    resolveHit: () => ({ primitiveId: 'equipment/body' }),
  });
  arbiter.updateFrame(
    [{ id: 'right' }],
    () => ray(),
    () => [
      { object: hoverSurface, distance: 1 },
      { object: equipment, distance: 1.005 },
      { object: actionSurface, distance: 1.01 },
    ],
  );

  assert.equal(arbiter.getWinningHit('right').resolved.primitiveId, 'panel/reveal');
  assert.equal(arbiter.handlePress('right').ok, true);
  assert.deepEqual(presses, ['panel/resize']);
  assert.equal(arbiter.getCapture('right').identity.targetId, 'panel');
});

test('release handler failure returns the exact error after capture and lease cleanup', () => {
  let object = {};
  let releaseFailure = new Error('release-failed');
  let errors = [];
  let cancellations = [];
  let arbiter = createSceneInteractionArbiter({
    onError: (error, context) => errors.push({ error, context }),
  });
  arbiter.registerTarget({
    ownerId: 'owner',
    id: 'panel',
    generation: 2,
    objects: [object],
    resolveHit: () => ({ primitiveId: 'panel/action-focus' }),
    onRelease: () => {
      throw releaseFailure;
    },
    onCancel: (identity, details) => cancellations.push({ identity, details }),
  });
  arbiter.updateFrame(
    [{ id: 'source' }],
    () => ray(),
    () => [{ object, distance: 1 }],
  );
  assert.equal(arbiter.handlePress('source').ok, true);

  let release = arbiter.handleRelease('source');

  assert.deepEqual(release, {
    ok: false,
    reason: 'release-handler-error',
    error: releaseFailure,
  });
  assert.equal(arbiter.getCapture('source'), null);
  assert.equal(arbiter.getDiagnostics().captures, 0);
  assert.equal(arbiter.getDiagnostics().leases, 0);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].error, releaseFailure);
  assert.equal(errors[0].context.handler, 'onRelease');
  assert.equal(cancellations.length, 1);
  assert.equal(cancellations[0].details.reason, 'release-handler-error');
  assert.equal(cancellations[0].details.detail, releaseFailure);
});
