/**
 * Motion — motion and animation design tokens
 *
 * Contains properties related to transition scales, durations, and easings.
 * Separated from color (Palette) and geometry (Skin) for independent composition.
 *
 * @module symbiote-ui/themes/Motion
 */

/**
 * @typedef {Object} MotionDefinition
 * @property {string} name - Preset name
 * @property {Object<string, string>} motion - Transition CSS variables
 */

/** @type {MotionDefinition} */
export let DEFAULT_MOTION = {
  name: 'default',
  motion: {
    '--sn-theme-motion-scale': '1.00',
    '--sn-transition-fast': '120ms',
    '--sn-transition-normal': '240ms',
    '--sn-transition-slow': '400ms',
  },
};

/** @type {MotionDefinition} */
export let SMOOTH_MOTION = {
  name: 'smooth',
  motion: {
    '--sn-theme-motion-scale': '1.20',
    '--sn-transition-fast': '150ms',
    '--sn-transition-normal': '300ms',
    '--sn-transition-slow': '500ms',
    '--sn-transition-easing': 'cubic-bezier(0.25, 1, 0.5, 1)',
  },
};

/** @type {MotionDefinition} */
export let FAST_MOTION = {
  name: 'fast',
  motion: {
    '--sn-theme-motion-scale': '0.60',
    '--sn-transition-fast': '70ms',
    '--sn-transition-normal': '140ms',
    '--sn-transition-slow': '240ms',
  },
};

/** @type {MotionDefinition} */
export let DISABLED_MOTION = {
  name: 'disabled',
  motion: {
    '--sn-theme-motion-scale': '0.00',
    '--sn-transition-fast': '0ms',
    '--sn-transition-normal': '0ms',
    '--sn-transition-slow': '0ms',
  },
};

/**
 * Apply motion preset to element
 * @param {HTMLElement} element
 * @param {MotionDefinition} motionDef
 */
export function applyMotion(element, motionDef) {
  for (const [key, value] of Object.entries(motionDef.motion)) {
    element.style.setProperty(key, value);
  }
}
