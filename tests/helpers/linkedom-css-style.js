/** Add the CSSStyleDeclaration.item() method missing from LinkeDOM's style shim. */
export function installLinkedomCSSStyleDeclaration(window) {
  let prototype = Object.getPrototypeOf(window.document.createElement('div').style);
  if (typeof prototype.item !== 'function') {
    Object.defineProperty(prototype, 'item', {
      configurable: true,
      value(index) {
        return this[index] ?? null;
      },
    });
  }
}
