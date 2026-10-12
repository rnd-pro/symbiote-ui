/**
 * RND Dark — the same brand pair inverted: ink surface, paper text.
 *
 * Keeps every RND brand rule (0 radius, 2px borders, hard offset shadows,
 * corner-mark hover, binary accent flip); only the surface/text polarity and
 * derived alpha layers switch.
 *
 * @module symbiote-ui/themes/rnd-dark
 */

import { hoverMarksBackgroundImage } from './hover-marks-styles.js';

/** @type {import('./Theme.js').ThemeDefinition} */
export let RND_DARK = {
  name: 'rnd-dark',
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


    '--sn-lit-bg': '16.9%',
    '--sn-lit-surface': '16.9%',
    '--sn-lit-hover': '27%',
    '--sn-lit-text': '86.7%',
    '--sn-lit-text-dim': '60%',
    '--sn-lit-accent': '86.7%',


    '--sn-alpha-overlay': '0.95',
    '--sn-alpha-subtle': '0.15',
    '--sn-alpha-faint': '0.06',


    '--sn-sys-danger': '#c5221f',
    '--sn-sys-success': '#388e3c',
    '--sn-sys-warning': '#b06000',


    '--sn-sys-surface': '#2b2b2b',
    '--sn-sys-surface-raised': '#2b2b2b',
    '--sn-sys-surface-panel': '#2b2b2b',
    '--sn-sys-surface-overlay': '#2b2b2b',
    '--sn-node-header-bg': '#2b2b2b',
    '--sn-sys-outline': '#dddddd',
    '--sn-sys-outline-subtle': 'rgba(221, 221, 221, 0.15)',
    '--sn-grid-dot': 'rgba(221, 221, 221, 0.12)',
    '--sn-grid-size': '20px',


    '--sn-sys-accent': '#dddddd',
    '--sn-sys-on-accent': '#2b2b2b',
    '--sn-sys-on-surface': '#dddddd',
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


    '--sn-button-bg': '#2b2b2b',
    '--sn-button-color': '#dddddd',
    '--sn-button-border': '#dddddd',
    '--sn-button-min-height': '40px',
    '--sn-button-font-size': 'var(--sn-text-sm)',
    '--sn-button-hover-bg': '#2b2b2b',
    '--sn-button-hover-border': '#dddddd',
    '--sn-button-hover-marks': hoverMarksBackgroundImage,
    '--sn-button-primary-bg': '#dddddd',
    '--sn-button-primary-border': '#dddddd',
    '--sn-button-primary-color': '#2b2b2b',
    '--sn-button-primary-hover-filter': 'none',


    '--sn-card-bg': '#2b2b2b',
    '--sn-card-border': '#dddddd',
    '--sn-card-hover-bg': '#2b2b2b',
    '--sn-card-hover-border': '#dddddd',


    '--sn-conn-color': '#dddddd',
    '--sn-conn-width': '2',
    '--sn-conn-selected': '#c5221f',


    '--sn-cat-server': '#dddddd',
    '--sn-cat-instance': '#388e3c',
    '--sn-cat-control': '#b06000',
    '--sn-cat-data': '#888888',
    '--sn-cat-default': '#888888',
    '--sn-subgraph-accent': 'var(--sn-cat-data)',


    '--sn-ctx-border': 'rgba(221, 221, 221, 0.15)',
    '--sn-ctx-color': '#dddddd',
    '--sn-ctx-hover': 'rgba(221, 221, 221, 0.1)',


    '--sn-comment-bg': 'rgba(221, 221, 221, 0.04)',
    '--sn-comment-border': 'rgba(221, 221, 221, 0.15)',


    '--sn-toolbar-bg': 'rgba(43, 43, 43, 0.95)',
    '--sn-toolbar-border': 'rgba(221, 221, 221, 0.15)',
    '--sn-toolbar-color': '#dddddd',
    '--sn-toolbar-hover': 'rgba(221, 221, 221, 0.1)',
    '--sn-toolbar-active': '#dddddd',
    '--sn-toolbar-danger': 'rgba(197, 34, 31, 0.22)',
    '--sn-toolbar-danger-color': '#c5221f',


    '--sn-shape-fill': 'var(--sn-sys-surface-raised)',
    '--sn-shape-stroke': 'var(--sn-sys-outline)',
    '--sn-shape-stroke-width': '0.4',
  },
};

/** @type {import('./Palette.js').PaletteDefinition} */
export let RND_DARK_PALETTE = {
  name: 'rnd-dark',
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
    '--sn-lit-bg': '16.9%',
    '--sn-lit-surface': '16.9%',
    '--sn-lit-hover': '27%',
    '--sn-lit-text': '86.7%',
    '--sn-lit-text-dim': '60%',
    '--sn-lit-accent': '86.7%',
    '--sn-alpha-overlay': '0.95',
    '--sn-alpha-subtle': '0.15',
    '--sn-alpha-faint': '0.06',
  },
};
