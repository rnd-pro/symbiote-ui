/**
 * GraphTabs styles
 * @module symbiote-node/canvas/GraphTabs.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  graph-tabs {
    display: flex;
    align-items: stretch;
    height: 32px;
    background: var(--sn-ctx-bg);
    border-bottom: 1px solid var(--sn-node-border);
    font-family: var(--sn-font);
    font-size: 12px;
    color: var(--sn-text-dim);
    overflow-x: auto;
    overflow-y: hidden;
    user-select: none;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }

  tab-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 14px;
    cursor: pointer;
    white-space: nowrap;
    border-right: 1px solid var(--sn-node-border);
    transition:
      background 0.15s ease-out,
      color 0.15s ease-out;
    position: relative;

    &:hover {
      background: color-mix(in srgb, currentColor 4%, transparent);
      color: var(--sn-text);
    }

    &[data-active] {
      background: var(--sn-node-bg);
      color: var(--sn-text);

      &::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: var(--sn-node-selected);
      }
    }

    & .material-symbols-outlined {
      font-size: 14px;
    }

    & .tab-close {
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.15s;
      padding: 2px;
      border-radius: 3px;

      &:hover {
        background: color-mix(in srgb, currentColor 10%, transparent);
      }
    }

    &:hover .tab-close {
      opacity: 0.7;
    }
  }

  .tab-add {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    cursor: pointer;
    color: var(--sn-text-dim);
    transition:
      background 0.15s ease-out,
      color 0.15s ease-out;

    &:hover {
      background: color-mix(in srgb, currentColor 4%, transparent);
      color: var(--sn-text);
    }

    & .material-symbols-outlined {
      font-size: 16px;
    }
  }
`;
