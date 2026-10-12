/**
 * RND — brand theme: light paper surface, ink text, binary ink↔paper accent flip.
 *
 * Brand grammar (design-system/iso/tokens/primitives.js):
 *  - square geometry: controls, cards, surfaces and windows render at 0 radius;
 *  - 2px ink borders on brand surfaces/controls, 1px hairlines only for in-card dividers;
 *  - hard offset shadows only (5px card, 3px focus), colored currentColor/ink, never blur;
 *  - button hover paints 8 corner marks (see themes/hover-marks-styles.js);
 *  - body Roboto 16px (line-height 1.5); headings 300/400/600 at lh 1.2.
 *
 * Type mapping onto the shared --sn-text-* ladder (rungs are the contract):
 *  badge 10 → --sn-text-2xs, micro 11 → --sn-text-xs, caption 12 → --sn-text-sm,
 *  small 13 → --sn-text-md, ui 14 → --sn-text-lg, body 16 → --sn-text-xl,
 *  subtitle 18 → --sn-text-2xl. h1 36 / display 30 / h2 24 are host heading
 *  sizes and stay outside the component ladder.
 *
 * @module symbiote-ui/themes/rnd
 */

import { hoverMarksBackgroundImage } from './hover-marks-styles.js';

/** @type {import('./Theme.js').ThemeDefinition} */
export let RND = {
  name: 'rnd',
  tokens: {


    '--sn-hue-base': '0',
    '--sn-hue-accent': '0',
    '--sn-hue-success': '122',
    '--sn-hue-warning': '30',
    '--sn-hue-danger': '6',
    '--sn-hue-data': '0',


    '--sn-sat': '0%',
    '--sn-sat-vivid': '0%',
    '--sn-sat-muted': '0%',


    '--sn-lit-bg': '86.7%',
    '--sn-lit-surface': '86.7%',
    '--sn-lit-hover': '78%',
    '--sn-lit-text': '16.9%',
    '--sn-lit-text-dim': '53%',
    '--sn-lit-accent': '16.9%',


    '--sn-alpha-overlay': '0.95',
    '--sn-alpha-subtle': '0.15',
    '--sn-alpha-faint': '0.06',


    '--sn-sys-danger': '#c5221f',
    '--sn-sys-success': '#388e3c',
    '--sn-sys-warning': '#b06000',


    '--sn-sys-surface': '#dddddd',
    '--sn-sys-surface-raised': '#dddddd',
    '--sn-sys-surface-panel': '#dddddd',
    '--sn-sys-surface-overlay': '#dddddd',
    '--sn-node-header-bg': '#dddddd',
    '--sn-sys-outline': '#2b2b2b',
    '--sn-sys-outline-subtle': 'rgba(43, 43, 43, 0.15)',
    '--sn-grid-dot': 'rgba(43, 43, 43, 0.12)',
    '--sn-grid-size': '20px',


    '--sn-sys-accent': '#2b2b2b',
    '--sn-sys-on-accent': '#dddddd',
    '--sn-sys-on-surface': '#2b2b2b',
    '--sn-sys-on-surface-dim': '#888888',


    '--sn-node-radius': '0',
    '--sn-card-radius': '0',
    '--sn-comment-radius': '0',
    '--sn-dialog-radius': '0',
    '--sn-button-radius': '0',
    '--sn-field-control-radius': '0',
    '--sn-node-border-width': '2px',
    '--sn-card-border-width': '2px',
    '--sn-dialog-border-width': '2px',
    '--sn-button-border-width': '2px',
    '--sn-field-control-border-width': '2px',
    '--sn-field-control-min-height': '40px',
    '--sn-field-control-focus-border': 'var(--sn-sys-on-surface)',
    '--sn-field-control-focus-shadow': '3px 3px 0 0 var(--sn-sys-on-surface)',
    '--sn-socket-size': '12px',
    '--sn-socket-border-width': '2px',


    '--sn-shadow-color': 'currentColor',
    '--sn-shadow-sm': '2px 2px 0 0 var(--sn-shadow-color)',
    '--sn-shadow-md': '3px 3px 0 0 var(--sn-shadow-color)',
    '--sn-shadow-lg': '5px 5px 0 0 var(--sn-shadow-color)',
    '--sn-shadow-xl': '5px 5px 0 0 var(--sn-shadow-color)',
    '--sn-node-shadow': '5px 5px 0 0 var(--sn-shadow-color)',
    '--sn-card-shadow': '5px 5px 0 0 var(--sn-shadow-color)',
    '--sn-card-shadow-hover': '5px 5px 0 0 var(--sn-shadow-color)',
    '--sn-effect-focus-ring': '3px 3px 0 0 var(--sn-shadow-color)',


    '--sn-font': "'Roboto', system-ui, sans-serif",
    '--sn-font-size': 'var(--sn-text-xl)',


    '--sn-button-bg': '#dddddd',
    '--sn-button-color': '#2b2b2b',
    '--sn-button-border': '#2b2b2b',
    '--sn-button-min-height': '40px',
    '--sn-button-font-size': 'var(--sn-text-sm)',
    '--sn-button-hover-bg': '#dddddd',
    '--sn-button-hover-border': '#2b2b2b',
    '--sn-button-hover-marks': hoverMarksBackgroundImage,
    '--sn-button-primary-bg': '#2b2b2b',
    '--sn-button-primary-border': '#2b2b2b',
    '--sn-button-primary-color': '#dddddd',
    '--sn-button-primary-hover-filter': 'none',


    '--sn-card-bg': '#dddddd',
    '--sn-card-border': '#2b2b2b',
    '--sn-card-hover-bg': '#dddddd',
    '--sn-card-hover-border': '#2b2b2b',


    '--sn-conn-color': '#2b2b2b',
    '--sn-conn-width': '2',
    '--sn-conn-selected': '#c5221f',


    '--sn-cat-server': '#2b2b2b',
    '--sn-cat-instance': '#388e3c',
    '--sn-cat-control': '#b06000',
    '--sn-cat-data': '#888888',
    '--sn-cat-default': '#888888',
    '--sn-subgraph-accent': 'var(--sn-cat-data)',


    '--sn-ctx-border': 'rgba(43, 43, 43, 0.15)',
    '--sn-ctx-color': '#2b2b2b',
    '--sn-ctx-hover': 'rgba(43, 43, 43, 0.1)',


    '--sn-comment-bg': 'rgba(43, 43, 43, 0.04)',
    '--sn-comment-border': 'rgba(43, 43, 43, 0.15)',


    '--sn-toolbar-bg': 'rgba(221, 221, 221, 0.95)',
    '--sn-toolbar-border': 'rgba(43, 43, 43, 0.15)',
    '--sn-toolbar-color': '#2b2b2b',
    '--sn-toolbar-hover': 'rgba(43, 43, 43, 0.1)',
    '--sn-toolbar-active': '#2b2b2b',
    '--sn-toolbar-danger': 'rgba(197, 34, 31, 0.15)',
    '--sn-toolbar-danger-color': '#c5221f',


    '--sn-shape-fill': 'var(--sn-sys-surface-raised)',
    '--sn-shape-stroke': 'var(--sn-sys-outline)',
    '--sn-shape-stroke-width': '0.4',
  },
};

/** @type {import('./Palette.js').PaletteDefinition} */
export let RND_PALETTE = {
  name: 'rnd',
  colors: {
    '--sn-hue-base': '0',
    '--sn-hue-accent': '0',
    '--sn-hue-success': '122',
    '--sn-hue-warning': '30',
    '--sn-hue-danger': '6',
    '--sn-hue-data': '0',
    '--sn-sat': '0%',
    '--sn-sat-vivid': '0%',
    '--sn-sat-muted': '0%',
    '--sn-lit-bg': '86.7%',
    '--sn-lit-surface': '86.7%',
    '--sn-lit-hover': '78%',
    '--sn-lit-text': '16.9%',
    '--sn-lit-text-dim': '53%',
    '--sn-lit-accent': '16.9%',
    '--sn-alpha-overlay': '0.95',
    '--sn-alpha-subtle': '0.15',
    '--sn-alpha-faint': '0.06',
  },
};
