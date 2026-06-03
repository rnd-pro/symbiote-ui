import { css } from '@symbiotejs/symbiote';

export let styles = css`
  panel-menu {
    position: fixed;
    z-index: var(--sn-panel-menu-z, var(--sn-overlay-z-base, 20000));
    pointer-events: none;

    .menu-container {
      pointer-events: auto;
      background: var(--sn-ctx-bg);
      border: 1px solid var(--sn-ctx-border);
      border-radius: 6px;
      box-shadow: 0 4px 12px var(--sn-shadow-color);
      min-width: 160px;
      padding: 4px 0;
    }

    .menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      color: var(--sn-text);
      font-size: 0.85rem;
      transition: background 0.1s;

      &:hover {
        background: var(--sn-node-hover);
      }

      &[active] {
        color: var(--sn-node-selected);
      }

      .material-symbols-outlined {
        font-size: 18px;
        opacity: 0.8;
      }
    }
  }
`;
