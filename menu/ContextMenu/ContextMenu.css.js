/**
 * ContextMenu styles
 * @module symbiote-node/menu/ContextMenu.css
 */
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
      min-width: 160px;
      background: var(--sn-ctx-bg);
      border: 1px solid var(--sn-ctx-border);
      border-radius: 8px;
      box-shadow: 0 8px 24px var(--sn-shadow-color);
      padding: 4px;
      overflow: hidden;
    }
  }

  .sn-ctx-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: transparent;
    color: var(--sn-ctx-color);
    font-family: var(--sn-font);
    font-size: 13px;
    cursor: pointer;
    border-radius: 4px;
    transition: background 0.1s;

    &:hover {
      background: var(--sn-ctx-hover);
    }
  }

  .sn-ctx-icon {
    font-size: 18px;
    opacity: 0.7;
  }
`;
