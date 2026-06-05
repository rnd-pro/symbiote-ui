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
    '--sn-motion-enabled': '1',
    '--sn-animation-play-state': 'running',
    '--sn-animation-duration-scale': '1.00',
    '--sn-animation-duration-fast': '600ms',
    '--sn-animation-duration-normal': '1000ms',
    '--sn-animation-duration-slow': '1500ms',
    '--sn-animation-duration-slower': '2000ms',
    '--sn-transition-fast': '120ms',
    '--sn-transition-normal': '240ms',
    '--sn-transition-slow': '400ms',
    '--sn-transition-easing': 'ease',
  },
};

/** @type {MotionDefinition} */
export let SMOOTH_MOTION = {
  name: 'smooth',
  motion: {
    '--sn-theme-motion-scale': '1.20',
    '--sn-motion-enabled': '1',
    '--sn-animation-play-state': 'running',
    '--sn-animation-duration-scale': '1.20',
    '--sn-animation-duration-fast': '720ms',
    '--sn-animation-duration-normal': '1200ms',
    '--sn-animation-duration-slow': '1800ms',
    '--sn-animation-duration-slower': '2400ms',
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
    '--sn-motion-enabled': '1',
    '--sn-animation-play-state': 'running',
    '--sn-animation-duration-scale': '0.60',
    '--sn-animation-duration-fast': '360ms',
    '--sn-animation-duration-normal': '600ms',
    '--sn-animation-duration-slow': '900ms',
    '--sn-animation-duration-slower': '1200ms',
    '--sn-transition-fast': '70ms',
    '--sn-transition-normal': '140ms',
    '--sn-transition-slow': '240ms',
    '--sn-transition-easing': 'ease',
  },
};

/** @type {MotionDefinition} */
export let DISABLED_MOTION = {
  name: 'disabled',
  motion: {
    '--sn-theme-motion-scale': '0.00',
    '--sn-motion-enabled': '0',
    '--sn-animation-play-state': 'paused',
    '--sn-animation-duration-scale': '0.00',
    '--sn-animation-duration-fast': '0ms',
    '--sn-animation-duration-normal': '0ms',
    '--sn-animation-duration-slow': '0ms',
    '--sn-animation-duration-slower': '0ms',
    '--sn-transition-fast': '0ms',
    '--sn-transition-normal': '0ms',
    '--sn-transition-slow': '0ms',
    '--sn-transition-easing': 'linear',
  },
};

export const MOTION_PRESET_DEFINITIONS = Object.freeze({
  default: DEFAULT_MOTION,
  smooth: SMOOTH_MOTION,
  fast: FAST_MOTION,
  disabled: DISABLED_MOTION,
});

export function getMotionPresetOptions(name = 'default') {
  let definition = MOTION_PRESET_DEFINITIONS[name] || MOTION_PRESET_DEFINITIONS.default;
  let scale = Number.parseFloat(definition.motion['--sn-theme-motion-scale']);
  return { motion: Number.isFinite(scale) ? Math.round(scale * 100) : 100 };
}

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
