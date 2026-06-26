import { css } from '@symbiotejs/symbiote';

export default css`
  cascade-theme-editor {
    display: block;
    min-width: 0;
    height: 100%;
    container: cascade-theme-editor / inline-size;
    color: var(--sn-text);
    font-family: var(--sn-font);

    &[hidden] {
      display: none !important;
    }

    .cte-shell {
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      gap: var(--sn-theme-editor-gap, var(--sn-lab-panel-gap, 12px));
      height: 100%;
      min-height: 0;
      padding: var(--sn-theme-editor-padding, var(--sn-lab-panel-padding, 12px));
      border: 0;
      background: var(--sn-panel-bg);
      color: var(--sn-text);
      overflow: hidden;
    }

    .cte-header,
    .cte-title,
    .cte-actions,
    .cte-mode,
    .cte-control,
    .cte-control-head,
    .cte-details summary {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .cte-header {
      justify-content: space-between;
      gap: var(--sn-theme-editor-header-gap, var(--sn-lab-row-gap, 8px));
    }

    .cte-title {
      flex: 1 1 auto;
      flex-wrap: nowrap;
      gap: var(--sn-theme-editor-title-gap, var(--sn-lab-control-gap, 8px));
      min-width: 0;
      font-size: var(--sn-theme-editor-title-size, var(--sn-lab-title-size, 14px));
      line-height: 1.2;
    }

    .cte-title strong {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cte-title .material-symbols-outlined {
      color: var(--sn-node-selected);
      font-size: var(--sn-theme-editor-title-icon-size, var(--sn-layout-header-icon-size, 16px));
    }

    .cte-status {
      flex: 0 0 auto;
      padding: var(--sn-theme-editor-status-padding, var(--sn-badge-padding, 2px 8px));
      border: 1px solid var(--sn-badge-border, var(--sn-node-border));
      border-radius: var(--sn-badge-radius, 999px);
      background: var(--sn-badge-bg, var(--sn-node-bg));
      color: var(--sn-badge-color, var(--sn-text-dim));
      font-size: var(--sn-theme-editor-status-size, var(--sn-badge-font-size, 11px));
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .cte-actions {
      gap: var(--sn-theme-editor-action-gap, var(--sn-button-gap, 6px));
      flex: 0 0 auto;
    }

    .cte-icon-button,
    .cte-mode button {
      box-sizing: border-box;
      border: 1px solid var(--sn-button-border, var(--sn-node-border));
      border-radius: var(--sn-button-radius, 6px);
      background: var(--sn-button-bg, var(--sn-node-bg));
      color: var(--sn-button-color, var(--sn-text));
      font: inherit;
      cursor: pointer;
      transition: var(--sn-effect-hover-transition);
    }

    .cte-icon-button:hover,
    .cte-mode button:hover {
      background: var(--sn-button-hover-bg, var(--sn-node-hover));
    }

    .cte-icon-button:focus-visible,
    .cte-mode button:focus-visible,
    .cte-control input:focus-visible,
    .cte-details summary:focus-visible {
      outline: var(--sn-effect-focus-ring, 2px solid var(--sn-node-selected));
      outline-offset: var(--sn-focus-outline-offset, 2px);
    }

    .cte-icon-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--sn-theme-editor-icon-button-size, var(--sn-button-icon-size, 28px));
      min-width: var(--sn-theme-editor-icon-button-size, var(--sn-button-icon-size, 28px));
      height: var(--sn-theme-editor-icon-button-size, var(--sn-button-icon-size, 28px));
      padding: 0;
    }

    .cte-icon-button .material-symbols-outlined {
      font-size: var(--sn-button-icon-font-size, 16px);
    }

    .cte-mode {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--sn-theme-editor-mode-gap, var(--sn-lab-segment-gap, 6px));
      padding: var(--sn-theme-editor-mode-padding, var(--sn-lab-segment-padding, 3px));
      border: 1px solid var(--sn-node-border);
      border-radius: var(--sn-node-radius, 8px);
      background: var(--sn-bg);
    }

    .cte-mode button {
      justify-content: center;
      min-width: 0;
      min-height: var(--sn-theme-editor-mode-height, var(--sn-button-min-height, 30px));
      padding: var(--sn-theme-editor-mode-button-padding, var(--sn-button-padding, 6px 14px));
      color: var(--sn-text-dim);
      font-size: var(--sn-theme-editor-control-size, var(--sn-button-font-size, 12px));
    }

    .cte-mode button[aria-pressed="true"] {
      border-color: var(--sn-button-primary-border, var(--sn-node-selected));
      background: var(--sn-button-primary-bg, var(--sn-node-selected));
      color: var(--sn-button-primary-color, var(--sn-bg));
    }

    .cte-controls {
      display: grid;
      align-content: start;
      gap: var(--sn-theme-editor-control-gap, var(--sn-lab-control-gap, 8px));
      min-height: 0;
      overflow: auto;
      padding-inline-end: var(--sn-theme-editor-scroll-padding, var(--sn-lab-scroll-padding, 8px));
      scrollbar-color: var(--sn-scrollbar-thumb) var(--sn-scrollbar-track);
      scrollbar-width: var(--sn-scrollbar-width, thin);
    }

    .cte-control {
      display: grid;
      grid-template-columns: minmax(92px, 0.65fr) minmax(96px, 1fr) minmax(38px, auto);
      gap: var(--sn-theme-editor-control-gap, var(--sn-lab-control-gap, 8px));
      min-width: 0;
      color: var(--sn-text-dim);
      font-size: var(--sn-theme-editor-control-size, var(--sn-lab-control-font-size, 12px));
    }

    .cte-control-head {
      gap: var(--sn-theme-editor-control-gap, var(--sn-lab-control-gap, 8px));
      min-width: 0;
    }

    .cte-control-icon {
      flex: 0 0 auto;
      width: var(--sn-theme-editor-control-icon-box, calc(18px * var(--sn-theme-density, 1)));
      color: var(--sn-node-selected);
      font-size: var(--sn-theme-editor-control-icon-size, var(--sn-layout-header-icon-size, 16px));
      line-height: 1;
      text-align: center;
    }

    .cte-control label {
      min-width: 0;
      overflow: hidden;
      color: var(--sn-field-label-color, var(--sn-text-dim));
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .cte-control input {
      width: 100%;
      min-width: 0;
      height: var(--sn-theme-editor-range-hit-size, var(--sn-socket-hit-size, 44px));
      accent-color: var(--sn-node-selected);
    }

    .cte-control input[type="range"] {
      --cte-range-progress: 0%;
      --cte-range-track-height: var(--sn-theme-editor-range-track-height, calc(4px * var(--sn-theme-density, 1)));
      --cte-range-thumb-size: var(--sn-theme-editor-range-thumb-size, calc(14px * var(--sn-theme-density, 1)));
      --cte-range-border-width: calc(1px * var(--sn-theme-outline-strength, 0));
      appearance: none;
      background: transparent;
      cursor: pointer;
    }

    .cte-control input[type="range"]::-webkit-slider-runnable-track {
      height: var(--cte-range-track-height);
      border: var(--cte-range-border-width) solid var(--sn-node-border);
      border-radius: var(--sn-scrollbar-radius, 999px);
      background:
        linear-gradient(
          to right,
          var(--sn-node-selected) 0 var(--cte-range-progress),
          color-mix(in oklab, var(--sn-text) 22%, transparent) var(--cte-range-progress) 100%
        );
    }

    .cte-control input[type="range"]::-webkit-slider-thumb {
      appearance: none;
      width: var(--cte-range-thumb-size);
      height: var(--cte-range-thumb-size);
      margin-top: calc((var(--cte-range-track-height) - var(--cte-range-thumb-size)) / 2 - var(--cte-range-border-width));
      border: var(--cte-range-border-width) solid var(--sn-node-border);
      border-radius: 50%;
      background: var(--sn-node-selected);
      box-shadow: none;
    }

    .cte-control input[type="range"]:disabled {
      cursor: not-allowed;
      opacity: var(--sn-button-disabled-opacity, 0.6);
    }

    .cte-control output {
      color: var(--sn-text);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .cte-details {
      min-width: 0;
      border: 1px solid var(--sn-card-border, var(--sn-node-border));
      border-radius: var(--sn-card-radius, var(--sn-node-radius, 8px));
      background: var(--sn-card-bg, var(--sn-node-bg));
      overflow: hidden;
    }

    .cte-details summary {
      gap: var(--sn-theme-editor-control-gap, var(--sn-lab-control-gap, 8px));
      padding: var(--sn-theme-editor-summary-padding, var(--sn-button-padding, 6px 14px));
      color: var(--sn-text-dim);
      cursor: pointer;
      font-size: var(--sn-theme-editor-control-size, var(--sn-button-font-size, 12px));
      user-select: none;
    }

    .cte-details summary .material-symbols-outlined {
      font-size: var(--sn-theme-editor-summary-icon-size, var(--sn-button-icon-font-size, 16px));
    }

    .cte-params {
      max-height: var(--sn-theme-editor-params-max-height, 180px);
      margin: 0;
      padding: var(--sn-theme-editor-params-padding, var(--sn-lab-token-padding, 10px));
      border-top: 1px solid var(--sn-card-border, var(--sn-node-border));
      background: var(--sn-source-bg, var(--sn-bg));
      color: var(--sn-source-editor-color, var(--sn-text));
      font-family: var(--sn-mono-font, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
      font-size: var(--sn-theme-editor-params-size, var(--sn-lab-token-value-size, 11px));
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .cte-controls::-webkit-scrollbar,
    .cte-params::-webkit-scrollbar {
      width: var(--sn-scrollbar-size, 10px);
      height: var(--sn-scrollbar-size, 10px);
    }

    .cte-controls::-webkit-scrollbar-track,
    .cte-params::-webkit-scrollbar-track {
      background: var(--sn-scrollbar-track, transparent);
    }

    .cte-controls::-webkit-scrollbar-thumb,
    .cte-params::-webkit-scrollbar-thumb {
      min-height: var(--sn-scrollbar-thumb-min-size, 36px);
      border: var(--sn-scrollbar-thumb-border, 3px solid transparent);
      border-radius: var(--sn-scrollbar-radius, 999px);
      background: var(--sn-scrollbar-thumb);
      background-clip: content-box;
    }

    .cte-controls::-webkit-scrollbar-thumb:hover,
    .cte-params::-webkit-scrollbar-thumb:hover {
      background: var(--sn-scrollbar-thumb-hover);
      background-clip: content-box;
    }

    @container cascade-theme-editor (max-width: 360px) {
      .cte-header {
        gap: var(--sn-theme-editor-header-compact-gap, 6px);
      }

      .cte-status {
        display: none;
      }

      .cte-control {
        grid-template-columns: minmax(0, 1fr) minmax(92px, 1fr) minmax(28px, auto);
      }
    }
  }
`;
