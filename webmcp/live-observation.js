/**
 * WebMCP Live Semantic Observation (Slice A — read-only live UI state).
 *
 * Gives agents a machine-readable view of the LIVE APPLICATION state —
 * what a semantic target is right now and which semantic transitions it
 * supports — without exposing DOM selectors, node identities, or pixel
 * coordinates. This domain is deliberately separate from authoring state
 * (project/cells/hashes) and presentation playback state (playhead,
 * execution, receipts): an observation answers "what is true in the UI
 * now", not "what is authored" or "where is the playhead".
 *
 * Threading model: hosts register semantic target *providers* — pure
 * read functions that project application state into observations. An
 * observation is a point-in-time snapshot; `freshness.observedAt` (and,
 * when the host bumps it, `generation`) tells the caller how current it
 * is. Providers MUST NOT mutate application state: observation is
 * strictly read-only, so ensure/reconciliation can later trust that an
 * inspect never has side effects.
 */

export const LIVE_OBSERVATION_SCHEMA_VERSION = 'symbiote-webmcp-live-observation-v1';
export const LIVE_OBSERVATION_CHANGE_EVENT = 'webmcp-live-observation-changed';

/**
 * Presence answers "does this semantic target exist for observation":
 * - 'present'   — mounted and available for interaction semantics;
 * - 'hidden'    — exists but not currently rendered/visible;
 * - 'unready'   — mounted but not ready (async resource still loading);
 * - 'unmounted' — the logical object is known but currently has no view;
 * - 'unknown'   — the targetId is not part of the semantic model at all.
 */
export const LIVE_OBSERVATION_PRESENCE = Object.freeze([
  'present',
  'hidden',
  'unready',
  'unmounted',
  'unknown',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value, fallback = '') {
  let text = String(value ?? fallback).trim();
  return text;
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  let result = [];
  let seen = new Set();
  for (let item of value) {
    let text = normalizeText(item);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function normalizeUnavailable(value) {
  if (!Array.isArray(value)) return [];
  let result = [];
  for (let entry of value) {
    let id = normalizeText(entry?.id ?? entry?.name);
    if (!id) continue;
    result.push({ id, reason: normalizeText(entry?.reason) || 'unavailable' });
  }
  return result;
}

function normalizePresence(value) {
  let presence = normalizeText(value, 'present') || 'present';
  return LIVE_OBSERVATION_PRESENCE.includes(presence) ? presence : 'unknown';
}

function normalizeStateRecord(value) {
  if (!isRecord(value)) return {};
  let result = {};
  for (let [key, entry] of Object.entries(value)) {
    if (['boolean', 'string', 'number'].includes(typeof entry) || entry === null) {
      result[key] = entry;
    }
  }
  return result;
}

function normalizeEffects(value, supportedIds) {
  if (!isRecord(value)) return {};
  let result = {};
  for (let [transitionId, effects] of Object.entries(value)) {
    let id = normalizeText(transitionId);
    if (!id || !supportedIds.has(id) || !isRecord(effects)) continue;
    let state = normalizeStateRecord(effects);
    if (Object.keys(state).length === 0) continue;
    result[id] = Object.freeze(state);
  }
  return result;
}

/**
 * Normalizes one live observation into the schema. Input shape:
 * { targetId, role, component?, presence?, state?, visibility?,
 *   capabilities: { supported, available, unavailable?, effects? },
 *   freshness? }
 * `capabilities.supported` lists what the target semantically can do;
 * `capabilities.available` is the state-dependent subset executable right
 * now; anything supported but not available lands in `unavailable` with a
 * machine-readable reason. `capabilities.effects` (optional, additive)
 * maps a supported transition id to the state keys it is expected to
 * produce — the machine-readable postcondition that lets `live_ensure`
 * pick a transition without guessing.
 * @param {object} input
 */
export function normalizeLiveObservation(input = {}) {
  let source = isRecord(input) ? input : {};
  let capabilities = isRecord(source.capabilities) ? source.capabilities : {};
  let supported = normalizeStringList(capabilities.supported);
  let available = normalizeStringList(capabilities.available);
  let unavailable = normalizeUnavailable(capabilities.unavailable);
  let availableSet = new Set(available);
  let unavailableIds = new Set(unavailable.map((entry) => entry.id));
  // Anything supported that is neither advertised available nor explained
  // as unavailable is conservatively reported as unavailable.
  for (let id of supported) {
    if (!availableSet.has(id) && !unavailableIds.has(id)) {
      unavailable.push({ id, reason: 'not-available-in-current-state' });
    }
  }
  return Object.freeze({
    targetId: normalizeText(source.targetId || source.id),
    role: normalizeText(source.role),
    component: normalizeText(source.component),
    presence: normalizePresence(source.presence),
    state: Object.freeze(normalizeStateRecord(source.state)),
    visibility: normalizeText(source.visibility),
    capabilities: Object.freeze({
      supported: Object.freeze(supported),
      available: Object.freeze(available),
      unavailable: Object.freeze(unavailable),
      effects: Object.freeze(normalizeEffects(capabilities.effects, new Set(supported))),
    }),
  });
}

/**
 * Creates a live-observation registry over host-registered providers.
 *
 * provider: ({ targetId?, context }) => array of observation inputs.
 * A provider is only called with a `targetId` when it declares support
 * for that id via `supportsTargetId(targetId)` (prefix matching on
 * `targetIdPrefix` is the default). Providers must be pure readers.
 *
 * Freshness: every snapshot carries `observedAt` (Date.now()). Hosts may
 * also dispatch a `webmcp-live-observation-changed` custom event on the
 * document to bump the registry `generation`; generation lets an agent
 * detect that a previously obtained snapshot is stale without diffing.
 *
 * @param {object} options
 * @param {Array<object>} [options.providers]
 * @param {Document} [options.document]
 */
export function createLiveObservationRegistry(options = {}) {
  let doc = options.document || (typeof document !== 'undefined' ? document : null);
  let providers = new Map();
  let generation = 0;
  let lastObservedAt = 0;
  const bump = () => { generation += 1; };
  if (doc && typeof doc.addEventListener === 'function') {
    doc.addEventListener(LIVE_OBSERVATION_CHANGE_EVENT, bump);
  }
  const api = Object.freeze({
    schemaVersion: LIVE_OBSERVATION_SCHEMA_VERSION,
    /**
     * Registers a semantic target provider.
     * @param {object} provider
     * @param {(context: { targetId?: string }) => unknown[] | Record<string, unknown>} provider.observe
     * @param {string} [provider.targetIdPrefix] — provider only sees ids starting with this prefix
     * @param {string} [provider.id]
     */
    registerProvider(provider = {}) {
      let id = normalizeText(provider.id) || `provider-${providers.size + 1}`;
      let prefix = normalizeText(provider.targetIdPrefix);
      if (typeof provider.observe !== 'function') {
        throw new TypeError('Live observation provider requires an observe() function');
      }
      if (providers.has(id)) throw new Error(`Duplicate live observation provider id: ${id}`);
      providers.set(id, Object.freeze({ id, prefix, observe: provider.observe }));
      return () => {
        providers.delete(id);
      };
    },
    /**
     * Reads a point-in-time snapshot. With `targetId`, returns the single
     * normalized observation or a presence:'unknown' record; without it,
     * returns every provider's observations merged.
     * @param {{ targetId?: string }} [request]
     */
    observe(request = {}) {
      let targetId = normalizeText(request?.targetId);
      let observations = [];
      for (let provider of providers.values()) {
        if (targetId && provider.prefix && !targetId.startsWith(provider.prefix)) continue;
        let produced = null;
        try {
          produced = provider.observe({ targetId: targetId || undefined });
        } catch (error) {
          observations.push(normalizeLiveObservation({
            targetId: targetId || '',
            role: '',
            presence: 'unknown',
            state: {},
            capabilities: { supported: [], available: [], unavailable: [] },
            component: '',
          }));
          continue;
        }
        for (let item of Array.isArray(produced) ? produced : [produced]) {
          if (!isRecord(item)) continue;
          let normalized = normalizeLiveObservation(item);
          if (!normalized.targetId) continue;
          observations.push(normalized);
        }
      }
      lastObservedAt = Date.now();
      if (targetId) {
        let match = observations.find((entry) => entry.targetId === targetId);
        if (!match) {
          match = normalizeLiveObservation({
            targetId,
            presence: 'unknown',
            state: {},
            capabilities: { supported: [], available: [], unavailable: [] },
          });
        }
        return Object.freeze({
          schemaVersion: LIVE_OBSERVATION_SCHEMA_VERSION,
          freshness: Object.freeze({ observedAt: lastObservedAt, generation }),
          observation: match,
        });
      }
      return Object.freeze({
        schemaVersion: LIVE_OBSERVATION_SCHEMA_VERSION,
        freshness: Object.freeze({ observedAt: lastObservedAt, generation }),
        observations: Object.freeze(observations),
      });
    },
    /** Current staleness token for previously returned snapshots. */
    stateToken() {
      return Object.freeze({ observedAt: lastObservedAt, generation });
    },
    dispose() {
      if (doc && typeof doc.removeEventListener === 'function') {
        doc.removeEventListener(LIVE_OBSERVATION_CHANGE_EVENT, bump);
      }
      providers.clear();
    },
  });
  for (let provider of Array.isArray(options.providers) ? options.providers : []) {
    api.registerProvider(provider);
  }
  return api;
}

/**
 * Builds the semantic ensure WebMCP tool descriptor. Unlike `live_inspect`
 * this tool MUTATES the live application state through a host-provided
 * controller: observe → compare desired state keys → pick one available
 * transition whose declared effects cover the missing keys → invoke →
 * verify by re-observation. The controller (see
 * `createEnsureController` in symbiote-workspace) owns retry/staleness
 * policy; this descriptor only wires input shape and annotations.
 *
 * @param {(input: { targetId: string, state: Record<string, unknown>, sync?: string }) => Promise<object> | object} ensure
 * @param {object} [options]
 * @param {string} [options.name]
 * @param {string} [options.description]
 */
export function createLiveEnsureToolDescriptor(ensure, options = {}) {
  if (typeof ensure !== 'function') {
    throw new TypeError('createLiveEnsureToolDescriptor requires an ensure() function');
  }
  return {
    name: normalizeText(options.name) || 'live_ensure',
    description: normalizeText(options.description) || [
      'Semantic reconciliation of LIVE APPLICATION state: bring a target to',
      'the requested state by invoking an available semantic transition and',
      'verifying the result by re-observation. Fails explicitly instead of',
      'guessing when no available transition declares matching effects.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['targetId', 'state'],
      properties: {
        targetId: {
          type: 'string',
          description: 'Stable semantic target id (e.g. panel.graph).',
        },
        state: {
          type: 'object',
          description: 'Desired semantic state keys, e.g. { "open": true }. Only listed keys are reconciled.',
        },
        sync: {
          type: 'string',
          description: 'Optional sync mode hint (e.g. "gate"); currently advisory.',
        },
      },
    },
    annotations: {
      readOnlyHint: false,
      schemaVersion: LIVE_OBSERVATION_SCHEMA_VERSION,
      domain: 'live-application-state',
    },
    execute(input = {}) {
      return ensure({
        targetId: normalizeText(input?.targetId),
        state: normalizeStateRecord(input?.state),
        sync: normalizeText(input?.sync) || undefined,
      });
    },
  };
}
 * The descriptor contains no mutation input; `annotations.readOnlyHint`
 * marks the contract so agents and policy engines treat it safely.
 *
 * @param {ReturnType<typeof createLiveObservationRegistry>} registry
 * @param {object} [options]
 * @param {string} [options.name]
 * @param {string} [options.description]
 */
export function createLiveInspectToolDescriptor(registry, options = {}) {
  if (!registry || typeof registry.observe !== 'function') {
    throw new TypeError('createLiveInspectToolDescriptor requires a live observation registry');
  }
  return {
    name: normalizeText(options.name) || 'live_inspect',
    description: normalizeText(options.description) || [
      'Read-only observation of LIVE APPLICATION semantic state: for a semantic',
      'target id returns its current state, visibility/readiness presence,',
      'supported capabilities, and the transitions available in the current',
      'state. Never mutates the UI; freshness is expressed via observedAt',
      'and a monotonically increasing generation.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        targetId: {
          type: 'string',
          description: 'Stable semantic target id (e.g. project-link.<slug>). Omit to list all observable targets.',
        },
      },
    },
    annotations: {
      readOnlyHint: true,
      schemaVersion: LIVE_OBSERVATION_SCHEMA_VERSION,
      domain: 'live-application-state',
    },
    execute(input = {}) {
      return registry.observe({ targetId: normalizeText(input?.targetId) || undefined });
    },
  };
}
