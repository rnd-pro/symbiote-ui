import { css } from '@symbiotejs/symbiote';

export default css`
  cascade-theme-widget {
    position: relative;
    display: inline-flex;
    align-items: center;
    color: var(--sn-text);
    font-family: var(--sn-font);

    &[hidden] {
      display: none !important;
    }

    .ctw-trigger {
      flex: 0 0 auto;
    }

    .ctw-trigger .material-symbols-outlined,
    .ctw-header-actions .material-symbols-outlined {
      font-size: var(--sn-shell-menu-action-icon-size, var(--sn-layout-header-icon-size, 16px));
    }

    .ctw-popover {
      position: absolute;
      top: calc(100% + var(--sn-theme-widget-offset, 8px));
      right: 0;
      z-index: var(--sn-theme-widget-z, 80);
      display: grid;
      grid-template-rows: auto auto auto;
      gap: var(--sn-theme-widget-gap, calc(8px * var(--sn-theme-density, 1)));
      width: min(92vw, var(--sn-theme-widget-width, 320px));
      padding: var(--sn-theme-widget-padding, calc(10px * var(--sn-theme-density, 1)));
      border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
      border-radius: var(--sn-node-radius, 8px);
      background: var(--sn-panel-bg);
      box-shadow: var(--sn-panel-shadow, 0 16px 48px hsl(0 0% 0% / 0.28));
      color: var(--sn-text);
    }

    .ctw-popover[hidden] {
      display: none;
    }

    .ctw-header,
    .ctw-header-actions,
    .ctw-control,
    .ctw-control-head,
    .ctw-mode {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .ctw-header {
      justify-content: space-between;
      gap: var(--sn-theme-widget-gap, 8px);
    }

    .ctw-header strong {
      min-width: 0;
      overflow: hidden;
      font-size: var(--sn-theme-widget-title-size, var(--sn-app-title-size, 13px));
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ctw-header-actions {
      gap: var(--sn-theme-widget-action-gap, 4px);
    }

    .ctw-header-actions button,
    .ctw-mode button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--sn-button-border, var(--sn-node-border));
      border-radius: var(--sn-button-radius, 6px);
      background: var(--sn-button-bg, var(--sn-node-bg));
      color: var(--sn-button-color, var(--sn-text));
      font: inherit;
      cursor: pointer;
    }

    .ctw-header-actions button {
      width: var(--sn-theme-widget-icon-button-size, var(--sn-theme-editor-icon-button-size, 28px));
      min-width: var(--sn-theme-widget-icon-button-size, var(--sn-theme-editor-icon-button-size, 28px));
      height: var(--sn-theme-widget-icon-button-size, var(--sn-theme-editor-icon-button-size, 28px));
      padding: 0;
    }

    .ctw-mode {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sn-theme-widget-mode-gap, 4px);
      padding: var(--sn-theme-widget-mode-padding, 3px);
      border: 1px solid var(--sn-node-border);
      border-radius: var(--sn-node-radius, 8px);
      background: var(--sn-bg);
    }

    .ctw-mode button {
      min-width: 0;
      min-height: var(--sn-theme-widget-mode-height, var(--sn-button-min-height, 28px));
      padding: var(--sn-theme-widget-mode-button-padding, 5px 10px);
      color: var(--sn-text-dim);
      font-size: var(--sn-theme-widget-control-size, var(--sn-button-font-size, 12px));
    }

    .ctw-mode button[aria-pressed="true"] {
      border-color: var(--sn-button-primary-border, var(--sn-node-selected));
      background: var(--sn-button-primary-bg, var(--sn-node-selected));
      color: var(--sn-button-primary-color, var(--sn-bg));
    }

    .ctw-controls {
      display: grid;
      gap: var(--sn-theme-widget-control-gap, 7px);
      min-width: 0;
    }

    .ctw-control {
      display: grid;
      grid-template-columns: minmax(82px, 0.52fr) minmax(96px, 1fr) minmax(34px, auto);
      gap: var(--sn-theme-widget-control-gap, 7px);
      color: var(--sn-text-dim);
      font-size: var(--sn-theme-widget-control-size, var(--sn-theme-editor-control-size, 12px));
    }

    .ctw-control-head {
      gap: var(--sn-theme-widget-control-gap, 7px);
    }

    .ctw-control-icon {
      width: var(--sn-theme-widget-control-icon-box, calc(18px * var(--sn-theme-density, 1)));
      color: var(--sn-node-selected);
      font-size: var(--sn-theme-widget-control-icon-size, var(--sn-layout-header-icon-size, 16px));
      line-height: 1;
      text-align: center;
    }

    .ctw-control label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .ctw-control input {
      width: 100%;
      min-width: 0;
      height: var(--sn-theme-widget-range-hit-size, 34px);
      accent-color: var(--sn-node-selected);
    }

    .ctw-control output {
      color: var(--sn-text);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .ctw-header-actions button:hover,
    .ctw-mode button:hover {
      background: var(--sn-button-hover-bg, var(--sn-node-hover));
    }

    .ctw-header-actions button:focus-visible,
    .ctw-mode button:focus-visible,
    .ctw-control input:focus-visible,
    .ctw-trigger:focus-visible {
      outline: var(--sn-effect-focus-ring, 2px solid var(--sn-node-selected));
      outline-offset: 2px;
    }

    @media (max-width: 560px) {
      .ctw-trigger-label {
        display: none;
      }

      .ctw-popover {
        right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
    }
  }
`;
