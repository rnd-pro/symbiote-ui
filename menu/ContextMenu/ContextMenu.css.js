import { css } from '@symbiotejs/symbiote';

export let styles = css`
  context-menu {
    position: absolute;
    inset: 0;
    z-index: var(--sn-ctx-z, var(--sn-overlay-z-base, 20000));
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
      border-radius: 8px;
      box-shadow: 0 8px 24px var(--sn-shadow-color, rgba(0,0,0,0.5));
      padding: 4px;
      overflow: hidden;
    }
  }

  .sn-ctx-divider {
    height: 1px;
    background: var(--sn-ctx-divider-color, var(--sn-tabs-divider, #333));
    margin: 4px 6px;
  }

  .sn-ctx-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 12px;
    border: none;
    background: transparent;
    color: var(--sn-ctx-color, #e0e0e0);
    font-family: var(--sn-font);
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.1s, color 0.1s;
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
    font-size: 18px;
    opacity: 0.7;
  }

  .sn-ctx-check-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    font-size: 12px;
    color: var(--tab-accent, var(--sn-tabs-accent, #007acc));
  }

  .sn-ctx-label {
    flex: 1;
    text-align: start;
  }

  .sn-ctx-detail {
    margin-left: auto;
    font-size: 11px;
    color: var(--sn-text-dim, #888);
    padding-left: 12px;
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
