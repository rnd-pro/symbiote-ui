/**
 * E-Book — warm paper reading theme
 *
 * Inspired by e-reader displays: warm cream background,
 * high-contrast dark text, minimal UI chrome, serif-influenced typography.
 * Optimized for long reading sessions and code exploration.
 *
 * @module symbiote-node/themes/ebook
 */

/** @type {import('./Theme.js').ThemeDefinition} */
export let EBOOK = {
  name: 'ebook',
  tokens: {


    '--sn-hue-base': '35',
    '--sn-hue-accent': '210',
    '--sn-hue-success': '150',
    '--sn-hue-warning': '38',
    '--sn-hue-danger': '4',
    '--sn-hue-data': '250',


    '--sn-sat': '20%',
    '--sn-sat-vivid': '55%',
    '--sn-sat-muted': '12%',


    '--sn-lit-bg': '93%',
    '--sn-lit-surface': '97%',
    '--sn-lit-border': '82%',
    '--sn-lit-hover': '89%',
    '--sn-lit-text': '15%',
    '--sn-lit-text-dim': '42%',
    '--sn-lit-accent': '42%',


    '--sn-alpha-overlay': '0.96',
    '--sn-alpha-subtle': '0.08',
    '--sn-alpha-faint': '0.06',


    '--sn-danger-color': 'hsl(var(--sn-hue-danger), var(--sn-sat-vivid), 48%)',
    '--sn-success-color': 'hsl(var(--sn-hue-success), var(--sn-sat-vivid), 38%)',
    '--sn-warning-color': 'hsl(var(--sn-hue-warning), var(--sn-sat-vivid), 42%)',


    '--sn-bg': 'hsl(37, 30%, 91%)',
    '--sn-grid-dot': 'hsla(35, 15%, 50%, 0.12)',
    '--sn-grid-size': '20px',


    '--sn-node-bg': 'hsl(40, 33%, 96%)',
    '--sn-node-border': 'hsl(35, 18%, 80%)',
    '--sn-node-radius': '8px',
    '--sn-node-shadow': '0 1px 4px rgba(100, 80, 40, 0.08)',
    '--sn-shadow-color': 'rgba(100, 80, 40, 0.1)',
    '--sn-node-selected': 'hsl(var(--sn-hue-accent), var(--sn-sat-vivid), var(--sn-lit-accent))',
    '--sn-node-hover': 'hsl(36, 22%, 88%)',
    '--sn-node-header-bg': 'hsl(37, 25%, 93%)',


    '--sn-font': "'Georgia', 'Palatino', 'Times New Roman', serif",
    '--sn-text': 'hsl(30, 15%, 18%)',
    '--sn-text-dim': 'hsl(30, 10%, 45%)',


    '--sn-socket-size': '12px',
    '--sn-socket-border-width': '2px',


    '--sn-conn-color': 'hsl(210, 40%, 50%)',
    '--sn-conn-width': '1.5',
    '--sn-conn-selected': 'hsl(4, 55%, 50%)',


    '--sn-cat-server': 'hsl(210, 45%, 45%)',
    '--sn-cat-instance': 'hsl(150, 40%, 38%)',
    '--sn-cat-control': 'hsl(35, 50%, 45%)',
    '--sn-cat-data': 'hsl(250, 35%, 50%)',
    '--sn-cat-default': 'hsl(30, 8%, 48%)',
    '--sn-subgraph-accent': 'var(--sn-cat-data)',


    '--sn-ctx-bg': 'hsl(40, 30%, 96%)',
    '--sn-ctx-border': 'hsl(35, 15%, 82%)',
    '--sn-ctx-color': 'hsl(30, 12%, 20%)',
    '--sn-ctx-hover': 'hsla(210, 40%, 50%, 0.08)',


    '--sn-comment-bg': 'hsla(38, 25%, 85%, 0.3)',
    '--sn-comment-border': 'hsla(35, 20%, 70%, 0.2)',
    '--sn-comment-radius': '4px',


    '--sn-toolbar-bg': 'hsla(40, 30%, 95%, var(--sn-alpha-overlay))',
    '--sn-toolbar-border': 'hsla(35, 15%, 70%, 0.25)',
    '--sn-toolbar-color': 'hsl(30, 10%, 35%)',
    '--sn-toolbar-hover': 'hsla(210, 40%, 50%, 0.1)',
    '--sn-toolbar-active': 'hsl(30, 12%, 20%)',
    '--sn-toolbar-danger': 'hsla(4, 55%, 50%, 0.1)',
    '--sn-toolbar-danger-color': 'hsl(4, 55%, 50%)',


    '--sn-shape-fill': 'var(--sn-node-bg)',
    '--sn-shape-stroke': 'var(--sn-node-border)',
    '--sn-shape-stroke-width': '1.0',
  },
};

/** @type {import('./Palette.js').PaletteDefinition} */
export let EBOOK_PALETTE = {
  name: 'ebook',
  colors: {
    '--sn-hue-base': '35',
    '--sn-hue-accent': '210',
    '--sn-hue-success': '150',
    '--sn-hue-warning': '38',
    '--sn-hue-danger': '4',
    '--sn-hue-data': '250',
    '--sn-sat': '20%',
    '--sn-sat-vivid': '55%',
    '--sn-sat-muted': '12%',
    '--sn-lit-bg': '93%',
    '--sn-lit-surface': '97%',
    '--sn-lit-border': '82%',
    '--sn-lit-hover': '89%',
    '--sn-lit-text': '15%',
    '--sn-lit-text-dim': '42%',
    '--sn-lit-accent': '42%',
    '--sn-alpha-overlay': '0.96',
    '--sn-alpha-subtle': '0.08',
    '--sn-alpha-faint': '0.06',
  },
};
