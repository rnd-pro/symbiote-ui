/**
 * PaletteBrowser styles
 * @module symbiote-ui/palette/PaletteBrowser.css
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
    font-size: var(--sn-text-md);
    color: var(--sn-text);
    overflow: hidden;
    user-select: none;
  }

  .pal-header {
    padding: var(--sn-step-5) var(--sn-step-7);
    font-weight: 600;
    font-size: var(--sn-text-sm);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sn-text-dim);
    border-bottom: 1px solid var(--sn-node-border);
    display: flex;
    align-items: center;
    gap: var(--sn-step-3);

    & .material-symbols-outlined {
      font-size: var(--sn-text-xl);
    }
  }

  .pal-search {
    padding: var(--sn-step-4) var(--sn-step-6);
    border-bottom: 1px solid var(--sn-node-border);

    & input {
      width: 100%;
      padding: var(--sn-step-3) var(--sn-step-5);
      background: var(--sn-field-control-bg);
      border: 1px solid var(--sn-node-border);
      border-radius: var(--sn-radius-sm);
      color: var(--sn-text);
      font-family: inherit;
      font-size: var(--sn-text-sm);
      outline: none;
      transition: border-color var(--sn-transition-normal, 0.2s) ease-out;

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
    padding: var(--sn-step-2) 0;
  }

  pal-category {
    & .pal-cat-header {
      padding: var(--sn-step-3) var(--sn-step-7);
      font-size: var(--sn-text-xs);
      font-weight: 600;
      color: var(--sn-text-dim);
      text-transform: uppercase;
      letter-spacing: 0.03em;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--sn-step-2);

      & .material-symbols-outlined {
        font-size: var(--sn-text-lg);
        transition: transform var(--sn-transition-normal, 0.2s) ease-out;
      }

      &:hover {
        color: var(--sn-text);
      }

      &:focus-visible {
        outline: 2px solid var(--sn-node-selected);
        outline-offset: -2px;
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
    padding: var(--sn-step-3) var(--sn-step-7) var(--sn-step-3) var(--sn-step-11);
    display: flex;
    align-items: center;
    gap: var(--sn-step-4);
    cursor: grab;
    border-radius: var(--sn-radius-sm);
    margin: var(--sn-step-0, 1px) var(--sn-step-3);
    transition: background var(--sn-transition-fast, 0.15s) ease-out;

    &:hover {
      background: var(--sn-ctx-hover);
    }

    &:active {
      cursor: grabbing;
      background: var(--sn-ctx-hover);
    }

    &[aria-selected='true'] {
      background: var(--sn-ctx-hover);
      outline: 2px solid var(--sn-node-selected);
      outline-offset: -2px;
    }

    & .pal-item-icon {
      font-size: var(--sn-text-xl);
      width: 20px;
      text-align: center;
      color: var(--item-color, var(--sn-text-dim));
    }

    & .pal-item-label {
      flex: 1;
      font-size: var(--sn-text-sm);
    }

    & .pal-item-desc {
      font-size: var(--sn-text-2xs);
      color: var(--sn-text-dim);
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
`;
