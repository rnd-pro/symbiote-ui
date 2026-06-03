/**
 * PaletteBrowser styles
 * @module symbiote-node/palette/PaletteBrowser.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  palette-browser {
    display: flex;
    flex-direction: column;
    width: 260px;
    height: 100%;
    background: var(--sn-ctx-bg);
    border-left: 1px solid var(--sn-node-border);
    font-family: var(--sn-font);
    font-size: 13px;
    color: var(--sn-text);
    overflow: hidden;
    user-select: none;
  }

  .pal-header {
    padding: 10px 14px;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sn-text-dim);
    border-bottom: 1px solid var(--sn-node-border);
    display: flex;
    align-items: center;
    gap: 6px;

    & .material-symbols-outlined {
      font-size: 16px;
    }
  }

  .pal-search {
    padding: 8px 12px;
    border-bottom: 1px solid var(--sn-node-border);

    & input {
      width: 100%;
      padding: 6px 10px;
      background: var(--sn-field-control-bg);
      border: 1px solid var(--sn-node-border);
      border-radius: 4px;
      color: var(--sn-text);
      font-family: inherit;
      font-size: 12px;
      outline: none;
      transition: border-color 0.2s ease-out;

      &:focus {
        border-color: var(--sn-node-selected);
      }

      &::placeholder {
        color: var(--sn-text-dim);
      }
    }
  }

  .pal-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 0;
  }

  pal-category {
    & .pal-cat-header {
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 600;
      color: var(--sn-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;

      & .material-symbols-outlined {
        font-size: 14px;
        transition: transform 0.2s ease-out;
      }

      &:hover {
        color: var(--sn-text);
      }
    }

    &[data-collapsed] .pal-cat-items {
      display: none;
    }

    &[data-collapsed] .pal-cat-header .material-symbols-outlined {
      transform: rotate(-90deg);
    }
  }

  pal-item {
    padding: 6px 14px 6px 28px;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: grab;
    border-radius: 4px;
    margin: 1px 6px;
    transition: background 0.15s ease-out;

    &:hover {
      background: var(--sn-ctx-hover);
    }

    &:active {
      cursor: grabbing;
      background: var(--sn-ctx-hover);
    }

    & .pal-item-icon {
      font-size: 16px;
      width: 20px;
      text-align: center;
      color: var(--item-color, var(--sn-text-dim));
    }

    & .pal-item-label {
      flex: 1;
      font-size: 12px;
    }

    & .pal-item-desc {
      font-size: 10px;
      color: var(--sn-text-dim);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`;
