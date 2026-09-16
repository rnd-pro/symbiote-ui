import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  LIVE_OBSERVATION_PRESENCE,
  LIVE_OBSERVATION_SCHEMA_VERSION,
  createLiveInspectToolDescriptor,
  createLiveObservationRegistry,
  normalizeLiveObservation,
} from '../webmcp/live-observation.js';

test('normalizeLiveObservation reports supported-but-unadvertised capabilities as unavailable', () => {
  let observation = normalizeLiveObservation({
    targetId: 'panel.inspector',
    role: 'panel',
    state: { open: false },
    capabilities: { supported: ['open', 'close'], available: ['open'] },
  });
  assert.equal(observation.presence, 'present');
  assert.deepEqual([...observation.capabilities.supported], ['open', 'close']);
  assert.deepEqual([...observation.capabilities.available], ['open']);
  assert.deepEqual(observation.capabilities.unavailable, [
    { id: 'close', reason: 'not-available-in-current-state' },
  ]);
});

test('normalizeLiveObservation keeps an explicit unavailable reason', () => {
  let observation = normalizeLiveObservation({
    targetId: 'panel.inspector',
    presence: 'hidden',
    capabilities: {
      supported: ['open', 'close'],
      available: [],
      unavailable: [{ id: 'open', reason: 'not-mounted' }],
    },
  });
  assert.equal(observation.presence, 'hidden');
  assert.deepEqual(observation.capabilities.unavailable, [
    { id: 'open', reason: 'not-mounted' },
    { id: 'close', reason: 'not-available-in-current-state' },
  ]);
});

test('unknown presence values collapse to unknown', () => {
  let observation = normalizeLiveObservation({ targetId: 'x', presence: 'banana' });
  assert.equal(observation.presence, 'unknown');
  assert.ok(LIVE_OBSERVATION_PRESENCE.includes(observation.presence));
});

test('registry observe() scopes providers by target id prefix', () => {
  let calls = [];
  let registry = createLiveObservationRegistry({ providers: [
    {
      id: 'projects',
      targetIdPrefix: 'project-link.',
      observe({ targetId }) {
        calls.push(['projects', targetId]);
        return [{ targetId: targetId || 'project-link.alpha', state: { selected: true } }];
      },
    },
    {
      id: 'panels',
      targetIdPrefix: 'panel.',
      observe({ targetId }) {
        calls.push(['panels', targetId]);
        return [{ targetId: targetId || 'panel.inspector', state: { open: false } }];
      },
    },
  ] });
  let single = registry.observe({ targetId: 'panel.inspector' });
  assert.equal(single.observation.state.open, false);
  assert.deepEqual(calls, [['panels', 'panel.inspector']]);
  let all = registry.observe();
  assert.equal(all.observations.length, 2);
  assert.equal(all.schemaVersion, LIVE_OBSERVATION_SCHEMA_VERSION);
});

test('registry reports unknown for an unobserved target id', () => {
  let registry = createLiveObservationRegistry();
  let result = registry.observe({ targetId: 'missing.target' });
  assert.equal(result.observation.presence, 'unknown');
  assert.equal(result.observation.targetId, 'missing.target');
});

test('freshness generation is readable through the state token', () => {
  let registry = createLiveObservationRegistry();
  let first = registry.observe().freshness;
  assert.equal(first.generation, 0);
  assert.ok(Number.isFinite(first.observedAt));
  let token = registry.stateToken();
  assert.equal(token.generation, 0);
});

test('live inspect tool descriptor is read-only and returns observations', () => {
  let registry = createLiveObservationRegistry({ providers: [{
    observe: () => [{ targetId: 'panel.a', state: { open: false } }],
  }] });
  let tool = createLiveInspectToolDescriptor(registry, { name: 'live_inspect' });
  assert.equal(tool.annotations.readOnlyHint, true);
  assert.equal(tool.annotations.domain, 'live-application-state');
  assert.deepEqual(Object.keys(tool.inputSchema.properties), ['targetId']);
  assert.equal(tool.inputSchema.additionalProperties, false);
  let result = tool.execute({ targetId: 'panel.a' });
  assert.equal(result.observation.presence, 'present');
});
