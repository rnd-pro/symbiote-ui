/**
 * Skin — geometry-only design tokens
 *
 * Built on a T-shirt spacing scale: change the scale values and all
 * semantic tokens (radius, sockets, grid) update harmoniously.
 * Shadow is split into geometry (here) and color (from Palette).
 *
 * @module symbiote-node/themes/Skin
 */

/**
 * @typedef {Object} SkinDefinition
 * @property {string} name
 * @property {Object<string, string>} geometry
 */

/** @type {SkinDefinition} */
export let MODERN_SKIN = {
  name: 'modern',
  geometry: {

    '--sn-space-xs': '4px',
    '--sn-space-sm': '8px',
    '--sn-space-md': '12px',
    '--sn-space-lg': '16px',
    '--sn-space-xl': '24px',


    '--sn-node-radius': 'var(--sn-space-md)',
    '--sn-comment-radius': 'var(--sn-space-sm)',
    '--sn-socket-size': 'var(--sn-space-md)',
    '--sn-socket-border-width': '2px',
    '--sn-grid-size': 'var(--sn-space-xl)',
    '--sn-conn-width': '2',


    '--sn-font': "'Inter', sans-serif",
    '--sn-font-size': '13px',


    '--sn-shadow-geometry': '0 4px 16px',
    '--sn-node-shadow': 'var(--sn-shadow-geometry) var(--sn-shadow-color, rgba(0, 0, 0, 0.3))',
  },
};

/** @type {SkinDefinition} */
export let COMPACT_SKIN = {
  name: 'compact',
  geometry: {

    '--sn-space-xs': '3px',
    '--sn-space-sm': '5px',
    '--sn-space-md': '8px',
    '--sn-space-lg': '12px',
    '--sn-space-xl': '16px',


    '--sn-node-radius': 'var(--sn-space-md)',
    '--sn-comment-radius': 'var(--sn-space-sm)',
    '--sn-socket-size': 'var(--sn-space-md)',
    '--sn-socket-border-width': '1.5px',
    '--sn-grid-size': 'var(--sn-space-xl)',
    '--sn-conn-width': '1.5',


    '--sn-font': "'Inter', sans-serif",
    '--sn-font-size': '12px',


    '--sn-shadow-geometry': '0 2px 8px',
    '--sn-node-shadow': 'var(--sn-shadow-geometry) var(--sn-shadow-color, rgba(0, 0, 0, 0.2))',
  },
};

/** @type {SkinDefinition} */
export let ROUNDED_SKIN = {
  name: 'rounded',
  geometry: {

    '--sn-space-xs': '5px',
    '--sn-space-sm': '10px',
    '--sn-space-md': '14px',
    '--sn-space-lg': '20px',
    '--sn-space-xl': '28px',


    '--sn-node-radius': 'var(--sn-space-lg)',
    '--sn-comment-radius': 'var(--sn-space-md)',
    '--sn-socket-size': 'var(--sn-space-md)',
    '--sn-socket-border-width': '2.5px',
    '--sn-grid-size': 'var(--sn-space-xl)',
    '--sn-conn-width': '2.5',


    '--sn-font': "'Space Grotesk', sans-serif",
    '--sn-font-size': '14px',


    '--sn-shadow-geometry': '0 6px 24px',
    '--sn-node-shadow': 'var(--sn-shadow-geometry) var(--sn-shadow-color, rgba(0, 0, 0, 0.25))',
  },
};

/**
 * Apply skin to element
 * @param {HTMLElement} element
 * @param {SkinDefinition} skin
 */
export function applySkin(element, skin) {
  for (const [key, value] of Object.entries(skin.geometry)) {
    element.style.setProperty(key, value);
  }
}
