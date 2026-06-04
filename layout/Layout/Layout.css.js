import { css } from '@symbiotejs/symbiote';

export let styles = css`
  panel-layout {
    display: block;
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
    font-family: var(--sn-font);

    &[hidden] {
      display: none;
    }

    .layout-root {
      display: flex;
      width: 100%;
      height: 100%;
      background: var(--sn-layout-gap-bg);
    }

    /* Fullscreen tab bar */
    .fullscreen-tab-bar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: var(--sn-fullscreen-tab-bar-height, 28px);
      background: var(--sn-bg);
      display: flex;
      align-items: stretch;
      gap: 0;
      z-index: 10002;
      padding: 0;

      &[hidden] {
        display: none;
      }
    }

    .tab-list {
      display: contents;
    }

    .fullscreen-tab {
      display: flex;
      align-items: center;
      gap: var(--sn-fullscreen-tab-gap, 6px);
      padding: var(--sn-fullscreen-tab-padding, 0 12px);
      height: var(--sn-fullscreen-tab-height, 28px);
      border: none;
      border-left: none;
      border-right: none;
      background: var(--sn-bg);
      color: var(--sn-text-dim);
      cursor: pointer;
      font-size: var(--sn-fullscreen-tab-size, 12px);
      font-family: inherit;
      transition:
        background 0.15s,
        color 0.15s;

      .material-symbols-outlined {
        font-size: var(--sn-fullscreen-tab-icon-size, 16px);
      }

      &:hover {
        background: var(--sn-node-header-bg);
        color: var(--sn-text);
      }

      &[active] {
        height: var(--sn-fullscreen-tab-active-height, 29px);
        margin-bottom: -1px;
        position: relative;
        z-index: 1;
        background: var(--sn-node-header-bg);
        color: var(--sn-text);
        border-left: 1px solid var(--sn-layout-border);
        border-right: 1px solid var(--sn-layout-border);
      }
    }

    .tab-filler {
      flex: 1;
      height: var(--sn-fullscreen-tab-bar-height, 28px);
      background: var(--sn-bg);
    }
  }
`;
