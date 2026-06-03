/**
 * Theme — JSON-driven CSS token system for node graph styling
 *
 * Applies design tokens as CSS custom properties on a target element.
 * Themes are plain objects — AI can generate them on the fly.
 *
 * @module symbiote-node/themes/Theme
 */

/**
 * @typedef {Object} ThemeDefinition
 * @property {string} name - Theme identifier
 * @property {Object<string, string>} tokens - CSS custom property key-value pairs
 */


export { DEFAULT_PROVIDER_THEME } from './default-provider.js';
export { DEFAULT_PROVIDER_THEME as DEFAULT_THEME } from './default-provider.js';

/**
 * Mapping from layout global tokens to symbiote-node tokens.
 * Layout module uses --bg-*, --text-* format; this bridges them.
 * @type {Object<string, string>}
 */
const LAYOUT_TOKEN_MAP = {
  '--bg-panel': '--sn-node-bg',
  '--bg-deeper': '--sn-bg',
  '--layout-gap-bg': '--sn-layout-gap-bg',
  '--bg-header': '--sn-node-header-bg',
  '--bg-hover': '--sn-node-hover',
  '--bg-popup': '--sn-ctx-bg',
  '--text-main': '--sn-text',
  '--text-dim': '--sn-text-dim',
  '--text-muted': '--sn-text-dim',
  '--layout-border': '--sn-layout-border',
  '--layout-highlight': '--sn-node-selected',
  '--border-popup': '--sn-ctx-border',
  '--accent': '--sn-node-selected',
  '--font-main': '--sn-font',
};

/**
 * Apply a theme to a DOM element
 * @param {HTMLElement} element
 * @param {ThemeDefinition} theme
 */
export function applyTheme(element, theme) {
  for (const [key, value] of Object.entries(theme.tokens)) {
    element.style.setProperty(key, value);
  }

  for (const [layoutToken, snToken] of Object.entries(LAYOUT_TOKEN_MAP)) {
    let value = theme.tokens[snToken];
    if (value) {
      element.style.setProperty(layoutToken, value);
    }
  }

  if (theme.extraCSS) {
    let existing = element.querySelector('style[data-theme]');
    if (existing) existing.remove();
    let style = document.createElement('style');
    style.setAttribute('data-theme', theme.name || 'custom');
    style.textContent = theme.extraCSS;
    element.prepend(style);
  }
}

/**
 * Extract current theme tokens from an element
 * @param {HTMLElement} element
 * @param {ThemeDefinition} reference - reference theme for token keys
 * @returns {ThemeDefinition}
 */
export function extractTheme(element, reference) {
  let tokens = {};
  let computed = getComputedStyle(element);
  for (const key of Object.keys(reference.tokens)) {
    tokens[key] = computed.getPropertyValue(key).trim() || reference.tokens[key];
  }
  return { name: 'extracted', tokens };
}
