import {
  createShowEvent,
  normalizeShowPlaybackSnapshot,
} from './show-contracts.js';

export const SHOW_SESSION_STATE_VERSION = 'symbiote-show-session-state-v1';

function clone(value) {
  if (value === undefined) return undefined;
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function normalizeMessage(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('show message must be an object');
  let role = value.role === 'assistant' ? 'agent' : String(value.role || 'agent');
  if (!['agent', 'user', 'system'].includes(role)) throw new TypeError(`unsupported show message role "${role}"`);
  return Object.freeze({
    id: String(value.id || ''),
    role,
    text: String(value.text || ''),
    parts: Object.freeze(Array.isArray(value.parts) ? clone(value.parts) : []),
    ...(value.context !== undefined ? { context: clone(value.context) } : {}),
  });
}

export class ShowSessionState {
  constructor({ onEvent, clock } = {}) {
    this._onEvent = typeof onEvent === 'function' ? onEvent : null;
    this._clock = typeof clock === 'function' ? clock : () => Date.now();
    this._sequence = 0;
    this._events = [];
    this._messages = [];
    this._branches = [];
    this._playback = normalizeShowPlaybackSnapshot({});
    this._resumeRequired = false;
  }

  get snapshot() {
    return Object.freeze({
      version: SHOW_SESSION_STATE_VERSION,
      playback: this._playback,
      resumeRequired: this._resumeRequired,
      activeBranchId: this._branches.at(-1)?.branchId || '',
      branchDepth: this._branches.length,
      messages: Object.freeze([...this._messages]),
      events: Object.freeze([...this._events]),
    });
  }

  appendMessage(message) {
    let normalized = normalizeMessage(message);
    this._messages.push(normalized);
    return normalized;
  }

  emit(directive) {
    let event = createShowEvent(directive, {
      sequence: ++this._sequence,
      timestampMs: this._clock(),
    });
    this._events.push(event);
    this._onEvent?.(event);
    return event;
  }

  setPlayback(snapshot) {
    this._playback = normalizeShowPlaybackSnapshot(snapshot);
    return this._playback;
  }

  pause(reason = 'explicit') {
    this._playback = normalizeShowPlaybackSnapshot({ ...this._playback, playbackState: 'paused' });
    this._resumeRequired = true;
    return this.emit({ type: 'status', status: 'paused', text: String(reason) });
  }

  resume() {
    if (!this._resumeRequired) return null;
    this._playback = normalizeShowPlaybackSnapshot({ ...this._playback, playbackState: 'playing' });
    this._resumeRequired = false;
    return this.emit({ type: 'resume' });
  }

  enterBranch(branchId, snapshot = this._playback) {
    let id = String(branchId || '').trim();
    if (!id) throw new TypeError('branchId must be a non-empty string');
    let saved = normalizeShowPlaybackSnapshot(snapshot);
    this._branches.push(Object.freeze({ branchId: id, snapshot: saved }));
    this._playback = normalizeShowPlaybackSnapshot({ ...saved, playbackState: 'paused' });
    this._resumeRequired = false;
    this.emit({ type: 'branch-enter', branchId: id, snapshot: saved });
    return this.snapshot;
  }

  returnFromBranch(branchId = '') {
    let branch = this._branches.at(-1);
    if (!branch) throw new RangeError('no active show branch to return from');
    if (branchId && branch.branchId !== branchId) throw new RangeError(`active show branch is "${branch.branchId}"`);
    this._branches.pop();
    this._playback = normalizeShowPlaybackSnapshot({ ...branch.snapshot, playbackState: 'paused' });
    this._resumeRequired = true;
    this.emit({ type: 'branch-return', branchId: branch.branchId });
    return this.snapshot;
  }

  footnote(value) {
    return this.emit({ type: 'footnote', ...(typeof value === 'string' ? { text: value } : value) });
  }

  status(value) {
    return this.emit({ type: 'status', ...(typeof value === 'string' ? { text: value } : value) });
  }

  actions(actions, context) {
    return this.emit({ type: 'actions', actions, ...(context === undefined ? {} : { context }) });
  }
}
