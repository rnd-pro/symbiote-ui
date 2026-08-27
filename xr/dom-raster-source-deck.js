/**
 * @file xr/dom-raster-source-deck.js
 * @description Accessibility state for one live DOM raster source deck.
 * @module symbiote-ui/xr/dom-raster-source-deck
 */

export const DOM_RASTER_INACTIVE_ATTRIBUTE = 'data-sn-raster-inactive';

const inactiveState = new WeakMap();

function requireRasterLayoutElement(element) {
  if (!element || typeof element.hasAttribute !== 'function' || typeof element.setAttribute !== 'function') {
    throw new TypeError('setDomRasterLayoutActivity requires a DOM element.');
  }
  return element;
}

function captureAttribute(element, name) {
  return {
    present: element.hasAttribute(name),
    value: element.getAttribute(name),
  };
}

function restoreAttribute(element, name, snapshot) {
  if (snapshot.present) {
    element.setAttribute(name, snapshot.value ?? '');
  } else {
    element.removeAttribute(name);
  }
}

/**
 * Marks a live raster layout active or inactive without removing it from layout.
 * Product CSS may position inactive layouts off-screen through the exported
 * attribute while the provider preserves their pre-existing accessibility state.
 *
 * @param {Element} element
 * @param {boolean} active
 * @returns {boolean}
 */
export function setDomRasterLayoutActivity(element, active) {
  let target = requireRasterLayoutElement(element);
  if (typeof active !== 'boolean') {
    throw new TypeError('setDomRasterLayoutActivity active must be a boolean.');
  }

  if (!active) {
    if (!inactiveState.has(target)) {
      inactiveState.set(target, {
        inert: captureAttribute(target, 'inert'),
        ariaHidden: captureAttribute(target, 'aria-hidden'),
      });
    }
    target.setAttribute(DOM_RASTER_INACTIVE_ATTRIBUTE, '');
    target.setAttribute('inert', '');
    target.setAttribute('aria-hidden', 'true');
    return false;
  }

  let snapshot = inactiveState.get(target);
  target.removeAttribute(DOM_RASTER_INACTIVE_ATTRIBUTE);
  if (snapshot) {
    restoreAttribute(target, 'inert', snapshot.inert);
    restoreAttribute(target, 'aria-hidden', snapshot.ariaHidden);
    inactiveState.delete(target);
  }
  return true;
}
