function hasDomGlobals() {
  return typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof HTMLElement !== 'undefined' &&
    typeof customElements !== 'undefined';
}

/**
 * @param {() => Promise<Record<string, unknown>>} load
 * @param {string} exportName
 * @param {string} [tagName]
 * @returns {Promise<Function | undefined>}
 */
export async function loadBrowserComponent(load, exportName, tagName) {
  if (!hasDomGlobals()) return undefined;
  if (tagName) {
    let registered = customElements.get(tagName);
    if (registered) return registered;
  }
  let module = await load();
  return /** @type {Function | undefined} */ (module[exportName]);
}
