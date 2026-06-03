/**
 * Breadcrumb styles
 * @module symbiote-node/canvas/Breadcrumb.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  graph-breadcrumb {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 12px;
    font-family: var(--sn-font);
    font-size: 12px;
    color: var(--sn-text-dim);
    background: var(--sn-ctx-bg);
    border-radius: 6px;
    backdrop-filter: blur(8px);
    pointer-events: auto;
    user-select: none;
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 50;
    box-shadow: 0 2px 8px var(--sn-shadow-color);
    border: 1px solid var(--sn-node-border);
    transition: opacity 0.2s ease-out;

    &[hidden] {
      display: none;
    }
  }

  breadcrumb-item {
    display: contents;

    &[data-active] .bc-label {
      color: var(--sn-text);
      font-weight: 500;
      cursor: default;

      &:hover {
        background: transparent;
      }
    }
  }

  .bc-label {
    padding: 3px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition:
      background 0.15s ease-out,
      color 0.15s ease-out;
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
      background: var(--sn-ctx-hover);
      color: var(--sn-text);
    }

    & .material-symbols-outlined {
      font-size: 14px;
    }
  }

  .bc-sep {
    color: var(--sn-text-dim);
    opacity: 0.5;
    font-size: 11px;
    padding: 0 2px;
  }
`;
