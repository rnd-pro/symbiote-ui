import { css } from '@symbiotejs/symbiote';

export default css`
  cascade-theme-widget {
    position: relative;
    display: inline-flex;
    align-items: center;
    color: var(--sn-text);
    font-family: var(--sn-font);
  }

  cascade-theme-widget[hidden] {
    display: none !important;
  }

  cascade-theme-widget .ctw-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sn-shell-menu-action-inner-gap, 6px);
    flex: 0 0 auto;
    min-height: var(--sn-shell-menu-action-height, 26px);
    padding: var(--sn-shell-menu-action-padding, 4px 10px);
    border: 1px solid transparent;
    border-radius: var(--sn-layout-header-button-radius, 4px);
    background: transparent;
    color: var(--sn-text-dim);
    font: inherit;
    font-size: var(--sn-shell-menu-action-size, 11px);
    font-weight: 600;
    letter-spacing: var(--sn-shell-menu-action-letter-spacing, 0.5px);
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--sn-transition-fast) var(--sn-transition-easing),
      border-color var(--sn-transition-fast) var(--sn-transition-easing),
      color var(--sn-transition-fast) var(--sn-transition-easing);
  }

  cascade-theme-widget .ctw-trigger:hover,
  cascade-theme-widget .ctw-trigger[active] {
    border-color: var(--sn-node-border);
    background: var(--sn-node-hover);
    color: var(--sn-text);
  }

  cascade-theme-widget .ctw-trigger .material-symbols-outlined,
  cascade-theme-widget .ctw-header-actions .material-symbols-outlined,
  .ctw-popover[data-overlay-portal] .ctw-header-actions .material-symbols-outlined {
    font-size: var(--sn-shell-menu-action-icon-size, var(--sn-layout-header-icon-size, 16px));
  }

  cascade-theme-widget .ctw-popover,
  .ctw-popover[data-overlay-portal] {
    --sn-overlay-z-tier: global;
    --sn-overlay-z-base: var(--sn-theme-widget-z, 20000);
    z-index: var(--sn-theme-widget-z, var(--sn-overlay-z-base, 20000));
    display: grid;
    grid-template-rows: auto auto auto;
    gap: var(--sn-theme-widget-gap, calc(var(--sn-step-4, 8px) * var(--sn-theme-density, 1)));
    width: min(92vw, var(--sn-theme-widget-width, 320px));
    max-width: calc(100vw - 16px);
    padding: var(--sn-theme-widget-padding, calc(var(--sn-step-5, 10px) * var(--sn-theme-density, 1)));
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius, 8px);
    background: var(--sn-panel-bg);
    box-shadow: var(--sn-panel-shadow, 0 16px 48px var(--sn-shadow-color, hsl(0 0% 0% / 0.28)));
    color: var(--sn-text);
    font-family: var(--sn-font);
  }

  cascade-theme-widget .ctw-popover {
    position: absolute;
    top: calc(100% + var(--sn-theme-widget-offset, 8px));
    right: 0;
  }

  .ctw-popover[data-overlay-portal] {
    position: fixed;
    top: 0;
    left: 0;
    right: auto;
  }

  cascade-theme-widget .ctw-popover[hidden],
  .ctw-popover[data-overlay-portal][hidden] {
    display: none;
  }

  cascade-theme-widget .ctw-header,
  cascade-theme-widget .ctw-header-actions,
  cascade-theme-widget .ctw-control,
  cascade-theme-widget .ctw-control-head,
  cascade-theme-widget .ctw-mode,
  .ctw-popover[data-overlay-portal] .ctw-header,
  .ctw-popover[data-overlay-portal] .ctw-header-actions,
  .ctw-popover[data-overlay-portal] .ctw-control,
  .ctw-popover[data-overlay-portal] .ctw-control-head,
  .ctw-popover[data-overlay-portal] .ctw-mode {
    display: flex;
    align-items: center;
    min-width: 0;
  }

  cascade-theme-widget .ctw-header,
  .ctw-popover[data-overlay-portal] .ctw-header {
    justify-content: space-between;
    gap: var(--sn-theme-widget-gap, 8px);
  }

  cascade-theme-widget .ctw-header strong,
  .ctw-popover[data-overlay-portal] .ctw-header strong {
    min-width: 0;
    overflow: hidden;
    font-size: var(--sn-theme-widget-title-size, var(--sn-app-title-size, 13px));
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  cascade-theme-widget .ctw-header-actions,
  .ctw-popover[data-overlay-portal] .ctw-header-actions {
    gap: var(--sn-theme-widget-action-gap, 4px);
  }

  cascade-theme-widget .ctw-header-actions button,
  cascade-theme-widget .ctw-mode button,
  .ctw-popover[data-overlay-portal] .ctw-header-actions button,
  .ctw-popover[data-overlay-portal] .ctw-mode button {
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

  cascade-theme-widget .ctw-header-actions button,
  .ctw-popover[data-overlay-portal] .ctw-header-actions button {
    width: var(--sn-theme-widget-icon-button-size, var(--sn-theme-editor-icon-button-size, 28px));
    min-width: var(--sn-theme-widget-icon-button-size, var(--sn-theme-editor-icon-button-size, 28px));
    height: var(--sn-theme-widget-icon-button-size, var(--sn-theme-editor-icon-button-size, 28px));
    padding: 0;
  }

  cascade-theme-widget .ctw-mode,
  .ctw-popover[data-overlay-portal] .ctw-mode {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--sn-theme-widget-mode-gap, 4px);
    padding: var(--sn-theme-widget-mode-padding, 3px);
    border: 1px solid var(--sn-node-border);
    border-radius: var(--sn-node-radius, 8px);
    background: var(--sn-bg);
  }

  cascade-theme-widget .ctw-mode button,
  .ctw-popover[data-overlay-portal] .ctw-mode button {
    min-width: 0;
    min-height: var(--sn-theme-widget-mode-height, var(--sn-button-min-height, 28px));
    padding: var(--sn-theme-widget-mode-button-padding, 5px 10px);
    color: var(--sn-text-dim);
    font-size: var(--sn-theme-widget-control-size, var(--sn-button-font-size, 12px));
  }

  cascade-theme-widget .ctw-mode button[aria-pressed="true"],
  .ctw-popover[data-overlay-portal] .ctw-mode button[aria-pressed="true"] {
    border-color: var(--sn-button-primary-border, var(--sn-node-selected));
    background: var(--sn-button-primary-bg, var(--sn-node-selected));
    color: var(--sn-button-primary-color, var(--sn-bg));
  }

  cascade-theme-widget .ctw-controls,
  .ctw-popover[data-overlay-portal] .ctw-controls {
    display: grid;
    gap: var(--sn-theme-widget-control-gap, 7px);
    min-width: 0;
  }

  cascade-theme-widget .ctw-control,
  .ctw-popover[data-overlay-portal] .ctw-control {
    display: grid;
    grid-template-columns: minmax(82px, 0.52fr) minmax(96px, 1fr) minmax(34px, auto);
    gap: var(--sn-theme-widget-control-gap, 7px);
    color: var(--sn-text-dim);
    font-size: var(--sn-theme-widget-control-size, var(--sn-theme-editor-control-size, 12px));
  }

  cascade-theme-widget .ctw-control-head,
  .ctw-popover[data-overlay-portal] .ctw-control-head {
    gap: var(--sn-theme-widget-control-gap, 7px);
  }

  cascade-theme-widget .ctw-control-icon,
  .ctw-popover[data-overlay-portal] .ctw-control-icon {
    width: var(--sn-theme-widget-control-icon-box, calc(18px * var(--sn-theme-density, 1)));
    color: var(--sn-node-selected);
    font-size: var(--sn-theme-widget-control-icon-size, var(--sn-layout-header-icon-size, 16px));
    line-height: 1;
    text-align: center;
  }

  cascade-theme-widget .ctw-control label,
  .ctw-popover[data-overlay-portal] .ctw-control label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  cascade-theme-widget .ctw-control input,
  .ctw-popover[data-overlay-portal] .ctw-control input {
    width: 100%;
    min-width: 0;
    height: var(--sn-theme-widget-range-hit-size, 34px);
    accent-color: var(--sn-node-selected);
  }

  cascade-theme-widget .ctw-control output,
  .ctw-popover[data-overlay-portal] .ctw-control output {
    color: var(--sn-text);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  cascade-theme-widget .ctw-header-actions button:hover,
  cascade-theme-widget .ctw-mode button:hover,
  .ctw-popover[data-overlay-portal] .ctw-header-actions button:hover,
  .ctw-popover[data-overlay-portal] .ctw-mode button:hover {
    background: var(--sn-button-hover-bg, var(--sn-node-hover));
  }

  cascade-theme-widget .ctw-header-actions button:focus-visible,
  cascade-theme-widget .ctw-mode button:focus-visible,
  cascade-theme-widget .ctw-control input:focus-visible,
  cascade-theme-widget .ctw-trigger:focus-visible,
  .ctw-popover[data-overlay-portal] .ctw-header-actions button:focus-visible,
  .ctw-popover[data-overlay-portal] .ctw-mode button:focus-visible,
  .ctw-popover[data-overlay-portal] .ctw-control input:focus-visible {
    outline: var(--sn-effect-focus-ring, 2px solid var(--sn-node-selected));
    outline-offset: 2px;
  }

  @media (max-width: 820px) {
    cascade-theme-widget .ctw-trigger-label {
      display: none;
    }

    cascade-theme-widget .ctw-popover,
    .ctw-popover[data-overlay-portal] {
      position: fixed;
      top: var(--sn-theme-widget-mobile-top, calc(env(safe-area-inset-top) + var(--sn-step-12, 88px)));
      right: max(var(--sn-theme-widget-mobile-inset, 8px), env(safe-area-inset-right));
      left: max(var(--sn-theme-widget-mobile-inset, 8px), env(safe-area-inset-left));
      width: auto;
      max-width: none;
      max-height: calc(
        100dvh - var(--sn-theme-widget-mobile-top, calc(env(safe-area-inset-top) + 88px)) -
          max(var(--sn-theme-widget-mobile-inset, 8px), env(safe-area-inset-bottom))
      );
      overflow: auto;
      transform: none;
    }
  }
`;
