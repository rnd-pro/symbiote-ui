/**
 * State Sync — generic versioned state synchronization engine.
 *
 * Connects to a WebSocket endpoint, receives snapshots + delta patches,
 * maintains a local mirror and emits fine-grained path-based events.
 *
 * Usage:
 *   const sync = createStateSync()
 *   sync.connect('wss://host/ws/state', { onMessage: (msg) => ... })
 *   sync.on('tasks', (tasks) => { ... })
 */

/**
 * Create an independent state sync instance.
 *
 * @param {object} [config]
 * @param {number} [config.reconnectMs=2000] - Reconnect delay in ms. Set 0 to disable.
 * @returns {{ on, get, commit, connect, disconnect, __test }}
 */
export function createStateSync(config = {}) {
  /** @type {WebSocket|null} */
  let _ws = null
  /** @type {number|null} */
  let _reconnectTimer = null
  /** @type {number} last known version */
  let _version = 0
  /** @type {object} local state mirror */
  let _state = {}
  /** @type {Map<string, Set<Function>>} */
  const _listeners = new Map()

  let _wsUrl = null
  let _onMessage = null
  let _reconnectMs = config.reconnectMs !== undefined ? config.reconnectMs : 2000

  /**
   * Subscribe to changes on a specific path prefix.
   * Callback fires with the value at that path.
   *
   * @param {string} key - top-level key (e.g. 'tasks', 'chats', 'ui')
   * @param {(value: any, key: string) => void} cb
   * @returns {() => void} unsubscribe
   */
  function on(key, cb) {
    if (!_listeners.has(key)) _listeners.set(key, new Set())
    _listeners.get(key).add(cb)
    // Deliver current value immediately if available
    if (_state[key] !== undefined) {
      try { cb(_state[key], key) } catch (e) { console.error('[stateSync] initial delivery error:', e) }
    }
    return () => _listeners.get(key)?.delete(cb)
  }

  /**
   * Get current value at path.
   * @param {string} path - slash-separated path
   * @returns {any}
   */
  function get(path) {
    let parts = path.split('/')
    let obj = _state
    for (let p of parts) {
      if (obj == null) return undefined
      obj = obj[p]
    }
    return obj
  }

  /**
   * Send a commit to the server.
   * @param {Array<{op: string, path: string, value?: any}>} ops
   * @param {string} [source='browser']
   */
  function commit(ops, source = 'browser') {
    if (!_ws || _ws.readyState !== WebSocket.OPEN) return
    _ws.send(JSON.stringify({
      method: 'commit',
      params: { ops, source },
    }))
  }

  /** Fire listeners for affected paths. */
  function _notify(affectedPaths) {
    let notified = new Set()
    for (let path of affectedPaths) {
      // Notify the top-level key
      let topKey = path.split('/')[0]
      if (!notified.has(topKey) && _listeners.has(topKey)) {
        notified.add(topKey)
        let val = _state[topKey]
        for (let cb of _listeners.get(topKey)) {
          try { cb(val, topKey) } catch (e) { console.error('[stateSync] listener error:', e) }
        }
      }
    }
    // Always notify '*' wildcard
    if (_listeners.has('*')) {
      for (let cb of _listeners.get('*')) {
        try { cb(_state, '*') } catch (e) { console.error('[stateSync] wildcard listener error:', e) }
      }
    }
  }

  /** Apply a snapshot (full state replace). */
  function _applySnapshot(params) {
    _state = params.state || {}
    _version = params.v || 0
    // Notify all known keys
    let keys = new Set([...Object.keys(_state), ..._listeners.keys()])
    _notify([...keys])
    return 'applied'
  }

  /**
   * Apply one protocol message from a transport this object does not own.
   *
   * `connect` handles a WebSocket it opens itself, which is the right answer
   * when the page holds the socket. It is the wrong answer when the data arrives
   * from somewhere else — a service worker, a message channel, a socket held by
   * somebody upstream — and those consumers were left reaching into `__test` to
   * apply a message, because there was no other way in.
   *
   * @param {{method?: string, params?: object}} msg
   * @returns {'applied'|'ignored'|'gap'} `gap` means the stream skipped a version
   *   and the caller should ask for a fresh snapshot rather than patch onwards.
   */
  function ingest(msg) {
    if (!msg || typeof msg !== 'object') return 'ignored'
    if (msg.method === 'snapshot') return _applySnapshot(msg.params || {})
    if (msg.method === 'patch') return _applyPatch(msg.params || {})
    return 'ignored'
  }

  /**
   * Apply a delta patch — the whole batch, or none of it.
   *
   * A batch is the unit. Either every op in it lands and one notification goes
   * out, or the state is left exactly as it was: a half-applied batch is a UI
   * showing two facts from different moments, which is the thing a versioned
   * store exists to prevent.
   *
   * @returns {'applied'|'ignored'|'gap'} what the batch did
   */
  function _applyPatch(params) {
    let { base, v, ops } = params
    if (!Array.isArray(ops) || ops.length === 0) return 'ignored'
    // A malformed op must not be discovered halfway through, after the earlier
    // ones have already moved the state.
    for (let op of ops) {
      if (!op || typeof op.path !== 'string' || op.path === '') return 'ignored'
    }
    // Versions only ever move forward. A batch at or below what we hold is a
    // duplicate or a straggler from a reconnect — applying it would undo newer
    // state, and idempotence here is cheaper than a resync.
    if (typeof v === 'number' && v <= _version) return 'ignored'
    // A batch claiming to follow a version we never got is a hole in the
    // stream. The caller must resync; guessing is what this prevents.
    if (typeof base === 'number' && base !== _version) return 'gap'

    let nextVersion = typeof v === 'number' ? v : _version + 1
    let affected = []
    for (let op of ops) {
      let path = op.path
      affected.push(path)
      let parts = path.split('/')
      if (op.op === 'delete' || op.op === 'del') {
        // Delete
        let obj = _state
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj == null) break
          obj = obj[parts[i]]
        }
        if (obj) delete obj[parts[parts.length - 1]]
      } else if (op.op === 'merge') {
        let obj = _state
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]] == null) obj[parts[i]] = {}
          obj = obj[parts[i]]
        }
        let key = parts[parts.length - 1]
        let current = obj[key]
        if (current && typeof current === 'object' && !Array.isArray(current)) {
          obj[key] = { ...current, ...(op.value || {}) }
        } else {
          obj[key] = op.value
        }
      } else {
        // Set
        let obj = _state
        for (let i = 0; i < parts.length - 1; i++) {
          if (obj[parts[i]] == null) obj[parts[i]] = {}
          obj = obj[parts[i]]
        }
        obj[parts[parts.length - 1]] = op.value
      }
    }
    _version = nextVersion
    _notify(affected)
    return 'applied'
  }

  /**
   * Connect to a WebSocket endpoint.
   *
   * @param {string} [wsUrl] - WebSocket URL. Required on first call, stored for reconnects.
   * @param {object} [options]
   * @param {(msg: object) => void} [options.onMessage] - Hook called with every parsed message before internal processing.
   * @param {number} [options.reconnectMs] - Override reconnect delay.
   */
  function connect(wsUrl, options = {}) {
    if (_ws) return
    if (wsUrl) _wsUrl = wsUrl
    if (options.onMessage) _onMessage = options.onMessage
    if (options.reconnectMs !== undefined) _reconnectMs = options.reconnectMs

    let url = _wsUrl
    if (_version > 0) url += `${url.includes('?') ? '&' : '?'}since=${_version}`

    _ws = new WebSocket(url)

    _ws.onopen = () => {
      if (_reconnectTimer) {
        clearTimeout(_reconnectTimer)
        _reconnectTimer = null
      }
    }

    _ws.onmessage = ({ data }) => {
      try {
        let msg = JSON.parse(data)
        if (_onMessage) _onMessage(msg)
        ingest(msg)
      } catch (e) {
        console.error('[stateSync] parse error:', e)
      }
    }

    _ws.onclose = () => {
      _ws = null
      if (_reconnectMs > 0) {
        _reconnectTimer = setTimeout(() => connect(), _reconnectMs)
      }
    }

    _ws.onerror = () => {}
  }

  function disconnect() {
    if (_reconnectTimer) {
      clearTimeout(_reconnectTimer)
      _reconnectTimer = null
    }
    if (_ws) {
      _ws.close()
      _ws = null
    }
  }

  return {
    on,
    get,
    commit,
    ingest,
    connect,
    disconnect,
    /** The version currently held. */
    get version() { return _version },
    __test: {
      applySnapshot: _applySnapshot,
      applyPatch: _applyPatch,
      getState: () => _state,
    },
  }
}
