/**
 * LayoutRouter — universal hash-based router for layout system
 *
 * Uses Symbiote PubSub named data context (ROUTER) to provide
 * reactive routing across the application.
 *
 * URL format: #panel/subpath?param1=value&param2=value
 *
 * Two levels of query params:
 * - **Global** (registered via registerGlobalParam): persist across section switches
 * - **Section** (everything else): reset when navigating to a new section
 *
 * Usage in templates: {{ROUTER/panel}}, {{ROUTER/subpath}}, {{ROUTER/query}}
 * Usage in code: this.$['ROUTER/panel'], this.sub('ROUTER/panel', cb)
 * Global params: this.sub('ROUTER/globalParams', cb)
 *
 * @module symbiote-node/layout/LayoutRouter
 */
import { PubSub } from '@symbiotejs/symbiote/core/PubSub.js';

const CTX = 'ROUTER';

/** @type {Set<string>} Keys that persist across section switches */
const _globalKeys = new Set();

const routerCtx = PubSub.registerCtx(
  {
    panel: 'default',
    subpath: '',
    query: '',
    globalParams: {},
  },
  CTX
);

/**
 * Parse query string into object
 * @param {string} str - Query string (without leading ?)
 * @returns {Object<string, string>}
 */
export function parseQuery(str) {
  if (!str) return {};
  const result = {};
  for (const pair of str.split('&')) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx >= 0) {
      result[decodeURIComponent(pair.substring(0, eqIdx))] = decodeURIComponent(
        pair.substring(eqIdx + 1)
      );
    }
  }
  return result;
}

/**
 * Build query string from key-value object
 * @param {Object<string, string>} params
 * @returns {string}
 */
export function buildQuery(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== '' && v != null);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}

/**
 * Build full hash string from parts
 * @param {string} panel
 * @param {string} [subpath]
 * @param {Object} [params]
 * @returns {string}
 */
export function buildHash(panel, subpath, params) {
  let hash = panel;
  if (subpath) hash += '/' + subpath;
  const q = params ? buildQuery(params) : '';
  if (q) hash += '?' + q;
  return hash;
}

/**
 * Navigate to a new route — updates URL and PubSub context.
 * Global params (registered via registerGlobalParam) are automatically
 * carried over unless explicitly overridden or set to null.
 * @param {string} panel - Master panel section ID
 * @param {string} [subpath] - Sub-path (entity ID, etc.)
 * @param {Object} [params] - Query parameters (overrides globals if specified)
 */
export function navigate(panel, subpath = '', params = {}) {
  if (typeof location === 'undefined') return;

  const currentQuery = parseQuery(routerCtx.read('query'));
  const merged = {};
  for (const key of _globalKeys) {
    if (currentQuery[key] && params[key] === undefined) {
      merged[key] = currentQuery[key];
    }
  }

  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') {
      merged[k] = v;
    } else {
      delete merged[k];
    }
  }
  const hash = buildHash(panel, subpath, merged);

  history.pushState(null, '', location.pathname + '#' + hash);
  syncFromHash();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('hashchange'));
  }
}

/**
 * Update only query params of current route (keeps panel/subpath)
 * Uses replaceState to avoid cluttering browser history
 * @param {Object} params - Params to merge
 */
export function updateParams(params) {
  if (typeof location === 'undefined') return;
  const currentQuery = parseQuery(routerCtx.read('query'));
  const merged = { ...currentQuery };
  for (const [k, v] of Object.entries(params)) {
    if (v === '' || v == null) {
      delete merged[k];
    } else {
      merged[k] = v;
    }
  }
  const query = buildQuery(merged);
  const hash = buildHash(routerCtx.read('panel'), routerCtx.read('subpath'), merged);
  history.replaceState(null, '', '#' + hash);
  routerCtx.pub('query', query);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('hashchange'));
  }
}

/**
 * Sync PubSub context from current URL hash
 */
function syncFromHash() {
  const raw = location.hash.replace(/^#/, '') || 'default';

  const qIdx = raw.indexOf('?');
  const pathPart = qIdx >= 0 ? raw.substring(0, qIdx) : raw;
  const queryPart = qIdx >= 0 ? raw.substring(qIdx + 1) : '';

  const slashIdx = pathPart.indexOf('/');
  const panel = slashIdx >= 0 ? pathPart.substring(0, slashIdx) : pathPart;
  const subpath = slashIdx >= 0 ? pathPart.substring(slashIdx + 1) : '';

  routerCtx.pub('panel', panel);
  routerCtx.pub('subpath', subpath);
  routerCtx.pub('query', queryPart);


  if (_globalKeys.size > 0) {
    const allParams = parseQuery(queryPart);
    const globals = {};
    for (const key of _globalKeys) {
      if (allParams[key]) globals[key] = allParams[key];
    }
    routerCtx.pub('globalParams', globals);
  }
}

/**
 * Get current route state
 * @returns {{ panel: string, subpath: string, query: string }}
 */
export function getRoute() {
  return {
    panel: routerCtx.read('panel'),
    subpath: routerCtx.read('subpath'),
    query: routerCtx.read('query'),
  };
}

/**
 * Set default panel (first section to show if hash is empty)
 * @param {string} panel
 */
export function setDefaultPanel(panel) {
  if (typeof location === 'undefined') return;
  if (!location.hash || location.hash === '#') {
    navigate(panel);
  }
}

/**
 * Register one or more param keys as global (persistent across section switches).
 * Global params are automatically carried in navigate() and published
 * via ROUTER/globalParams PubSub context.
 * @param {...string} keys - Param names to register as global
 */
export function registerGlobalParam(...keys) {
  keys.forEach((k) => _globalKeys.add(k));

  if (typeof location !== 'undefined') {
    const allParams = parseQuery(routerCtx.read('query'));
    const globals = {};
    for (const key of _globalKeys) {
      if (allParams[key]) globals[key] = allParams[key];
    }
    routerCtx.pub('globalParams', globals);
  }
}

/**
 * Set a single global param value.
 * Shorthand for registerGlobalParam + updateParams.
 * @param {string} key
 * @param {string|null} value - null removes the param
 */
export function setGlobalParam(key, value) {
  _globalKeys.add(key);
  updateParams({ [key]: value });
}


if (typeof location !== 'undefined' && typeof window !== 'undefined') {
  syncFromHash();
  window.addEventListener('hashchange', syncFromHash);
}

/**
 * Generic search parameters builder
 */
export function getGraphSearchString(locationObj = typeof window !== 'undefined' ? window.location : {}) {
  if (!locationObj || !locationObj.hash) return ''
  const params = new URLSearchParams(locationObj.search || '')
  const hashQuery = locationObj.hash.includes('?') ? locationObj.hash.split('?')[1] : ''
  const hashParams = new URLSearchParams(hashQuery)
  for (let [key, value] of hashParams) {
    params.set(key, value)
  }
  return params.toString()
}

export function getGraphUrlParams(locationObj = typeof window !== 'undefined' ? window.location : {}) {
  return new URLSearchParams(getGraphSearchString(locationObj))
}

export function parseGraphHash(hash = typeof window !== 'undefined' ? window.location.hash : '') {
  if (!hash) return { path: '', params: new URLSearchParams() }
  const [hashBase, queryStr] = hash.replace('#', '').split('?')
  const hashParams = hashBase.split('/')
  if (hashParams[0] === 'graph') hashParams.shift()
  return {
    path: hashParams.join('/'),
    params: new URLSearchParams(queryStr || ''),
  }
}

export function updateHashParam(key, value, locationObj = typeof window !== 'undefined' ? window.location : {}, historyObj = typeof history !== 'undefined' ? history : {}) {
  if (!locationObj || !locationObj.hash) return
  const [basePath, queryStr] = locationObj.hash.split('?')
  const params = new URLSearchParams(queryStr || '')
  if (value === null || value === undefined) {
    params.delete(key)
  } else {
    params.set(key, value)
  }
  const newQuery = params.toString()
  const newHash = newQuery ? `${basePath}?${newQuery}` : basePath
  if (locationObj.hash === newHash) return
  if (historyObj && typeof historyObj.replaceState === 'function') {
    historyObj.replaceState(null, '', newHash)
  }
}

