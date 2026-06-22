/**
 * NodeSearch styles
 * @module symbiote-ui/canvas/NodeSearch.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  node-search {
    position: absolute;
    top: var(--sn-space-lg);
    left: 50%;
    transform: translateX(-50%);
    width: 360px;
    z-index: 200;
    font-family: var(--sn-font);

    &[hidden] {
      display: none;
    }

    & .search-bar {
      display: flex;
      align-items: center;
      gap: var(--sn-space-sm);
      padding: 8px 14px;
      background: var(--sn-node-bg);
      border: 1px solid var(--sn-node-border);
      border-radius: 10px;
      box-shadow: 0 8px 32px var(--sn-shadow-color);
    }

    & .search-icon {
      font-size: var(--sn-text-2xl);
      color: var(--sn-text-dim);
    }

    & .search-input {
      flex: 1;
      background: none;
      border: none;
      outline: none;
      color: var(--sn-text);
      font-size: var(--sn-text-lg);
      font-family: inherit;
    }

    & .search-input::placeholder {
      color: var(--sn-text-dim);
    }

    & .search-hint {
      font-size: var(--sn-text-xs);
      color: var(--sn-text-dim);
      padding: 2px 6px;
      border: 1px solid var(--sn-node-border);
      border-radius: var(--sn-radius-sm);
    }

    & .search-results {
      margin-top: var(--sn-space-xs);
      background: var(--sn-node-bg);
      border-radius: var(--sn-radius-lg);
      border: 1px solid var(--sn-node-border);
      box-shadow: 0 4px 16px var(--sn-shadow-color);
      overflow: hidden;
      max-height: 300px;
      overflow-y: auto;
    }

    & .search-results:empty {
      display: none;
    }
  }

  .search-result {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 14px;
    cursor: pointer;
    color: var(--sn-text);
    font-size: var(--sn-text-md);
    transition: background var(--sn-transition-fast) var(--sn-transition-easing);

    &:hover {
      background: color-mix(in oklab, currentColor 6%, transparent);
    }
  }

  .search-result-type {
    font-size: var(--sn-text-xs);
    color: var(--sn-text-dim);
    padding: 1px 6px;
    border-radius: var(--sn-radius-sm);
    background: color-mix(in oklab, currentColor 5%, transparent);
  }
`;
