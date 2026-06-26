import { css } from '@symbiotejs/symbiote';

export let styles = css`
  context-menu {
    --sn-overlay-z-tier: local;
    --sn-overlay-z-base: var(--sn-ctx-z, var(--sn-canvas-overlay-z-base, 12000));
    position: absolute;
    inset: 0;
    z-index: var(--sn-ctx-z, var(--sn-canvas-overlay-z-base, 12000));
    pointer-events: none;

    &[hidden] {
      display: none;
    }

    & .sn-ctx-backdrop {
      position: absolute;
      inset: 0;
      pointer-events: all;
    }

    & .sn-ctx-menu {
      position: absolute;
      pointer-events: all;
      min-width: 180px;
      background: var(--sn-ctx-bg, #1e1e1e);
      border: 1px solid var(--sn-ctx-border, #333);
      border-radius: var(--sn-radius-lg);
      box-shadow: 0 8px 24px var(--sn-shadow-color, rgba(0,0,0,0.5));
      padding: var(--sn-step-2);
      overflow: hidden;
    }
  }

  .sn-ctx-divider {
    height: 1px;
    background: var(--sn-ctx-divider-color, var(--sn-tabs-divider, #333));
    margin: var(--sn-step-2) var(--sn-step-3);
  }

  .sn-ctx-divider[hidden],
  .sn-ctx-btn[hidden],
  .sn-ctx-icon[hidden],
  .sn-ctx-check-mark[hidden],
  .sn-ctx-detail[hidden] {
    display: none !important;
  }

  .sn-ctx-btn {
    display: flex;
    align-items: center;
    gap: var(--sn-step-4);
    width: 100%;
    padding: var(--sn-step-3) var(--sn-step-6);
    border: none;
    background: transparent;
    color: var(--sn-ctx-color, #e0e0e0);
    font-family: var(--sn-font);
    font-size: var(--sn-text-md);
    cursor: pointer;
    border-radius: var(--sn-radius-sm);
    transition: background var(--sn-transition-fast, 0.1s), color var(--sn-transition-fast, 0.1s);
    outline: none;

    &:hover {
      background: var(--sn-ctx-hover, #2d2d2d);
    }

    &:focus-visible {
      background: var(--sn-ctx-hover, #2d2d2d);
      box-shadow: 0 0 0 2px var(--sn-focus-ring-color, currentColor);
    }
  }

  .sn-ctx-icon {
    font-size: var(--sn-text-2xl);
    opacity: 0.7;
  }

  .sn-ctx-check-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    font-size: var(--sn-text-sm);
    color: var(--tab-accent, var(--sn-tabs-accent, #007acc));
  }

  .sn-ctx-label {
    flex: 1;
    text-align: start;
  }

  .sn-ctx-detail {
    margin-left: auto;
    font-size: var(--sn-text-xs);
    color: var(--sn-text-dim, #888);
    padding-left: var(--sn-step-6);
  }

  .sn-ctx-btn[destructive] {
    color: var(--sn-status-error, #f85149);
  }

  .sn-ctx-btn[destructive]:hover {
    background: var(--sn-ctx-destructive-hover-bg, rgba(248, 81, 73, 0.15));
  }

  .sn-ctx-btn[destructive]:focus-visible {
    background: var(--sn-ctx-destructive-hover-bg, rgba(248, 81, 73, 0.15));
  }

  .sn-ctx-btn[disabled] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .sn-ctx-btn[disabled]:hover {
    background: transparent;
  }

  .sn-ctx-btn[disabled]:focus-visible {
    background: transparent;
    box-shadow: none;
  }
`;
