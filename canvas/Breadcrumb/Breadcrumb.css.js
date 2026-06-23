/**
 * Breadcrumb styles
 * @module symbiote-ui/canvas/Breadcrumb.css
 */
import { css } from '@symbiotejs/symbiote';

export let styles = css`
  graph-breadcrumb {
    display: flex;
    align-items: center;
    gap: var(--sn-step-1);
    padding: var(--sn-step-3) var(--sn-step-6);
    font-family: var(--sn-font);
    font-size: var(--sn-text-sm);
    color: var(--sn-text-dim);
    background: var(--sn-ctx-bg);
    border-radius: var(--sn-radius-md);
    backdrop-filter: blur(8px);
    pointer-events: auto;
    user-select: none;
    position: absolute;
    top: var(--sn-step-5);
    left: var(--sn-step-5);
    z-index: 50;
    box-shadow: 0 2px 8px var(--sn-shadow-color);
    border: 1px solid var(--sn-node-border);
    transition: opacity var(--sn-transition-normal) var(--sn-transition-easing);

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
    padding: 3px var(--sn-step-4);
    border-radius: var(--sn-radius-sm);
    cursor: pointer;
    transition:
      background 0.15s ease-out,
      color 0.15s ease-out;
    display: flex;
    align-items: center;
    gap: var(--sn-step-2);

    &:hover {
      background: var(--sn-ctx-hover);
      color: var(--sn-text);
    }

    & .material-symbols-outlined {
      font-size: var(--sn-text-lg);
    }
  }

  .bc-sep {
    color: var(--sn-text-dim);
    opacity: 0.5;
    font-size: var(--sn-text-xs);
    padding: 0 var(--sn-step-1);
  }
`;
