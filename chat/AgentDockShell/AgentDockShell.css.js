export default /*css*/ `
agent-dock-shell {
  position: relative;
  isolation: isolate;
  box-sizing: border-box;
  display: block;
  inline-size: 100%;
  block-size: 100%;
  min-inline-size: 0;
  min-block-size: 0;
  overflow: hidden;
  color: var(--sn-text, var(--sn-sys-on-surface));
  background: var(--sn-panel-bg, var(--sn-sys-surface-sunken));

  > panel-layout {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
  }

  .agent-dock-main-node[node-type='panel'] {
    background: transparent;
    border: 0;
    border-radius: 0;

    > .panel-view {
      border: 0;
    }

    > .panel-view > .panel-header {
      display: none !important;
    }

    > .panel-view > .panel-content {
      min-inline-size: 0;
      min-block-size: 0;
      padding: 0;
      overflow: hidden;
    }
  }

  .agent-show-panel-node > .panel-view > .panel-content {
    min-inline-size: 0;
    min-block-size: 0;
    padding: 0;
    overflow: hidden;
  }

  /* In mobile Show mode the outer END rail belongs to the workspace
     above. Keep it out of the lower transport panel so both rails share the
     same native upper region and the Show uses the full lower inline size. */
  &[show-panel-mobile-active] > panel-layout[drawer-mode-active] {
    --sn-agent-dock-mobile-show-main-ratio: 76%;

    > .layout-root > layout-node > .split-view[direction='horizontal'] {
      > .split-first > layout-node[mobile-dock='primary']:has(.agent-show-panel-node) {
        inset-inline-end: 0;
        width: 100% !important;

        > .split-view[direction='vertical'] {
          > .split-first {
            width: calc(100% - var(--sn-layout-collapsed-horizontal-size, 32px)) !important;
            align-self: flex-start;
          }

          > .split-resizer {
            width: calc(100% - var(--sn-layout-collapsed-horizontal-size, 32px)) !important;
            align-self: flex-start;
          }

          > .split-second {
            width: 100% !important;
            align-self: stretch;
          }
        }
      }

      > .split-second > layout-node[drawer-rail][drawer-rail-collapsed][mobile-dock='end'] {
        inset-block-end: auto;
        block-size: var(--sn-agent-dock-mobile-show-main-ratio) !important;
        height: var(--sn-agent-dock-mobile-show-main-ratio) !important;
        min-block-size: 0 !important;
      }
    }
  }

  .agent-show-panel-host {
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;

    > chat-show-player {
      inline-size: 100%;
      block-size: 100%;
      max-block-size: none;
      border: 0;
      border-radius: 0;
    }
  }

  .agent-dock-main-host,
  .agent-dock-main-host > [slot='main'] {
    box-sizing: border-box;
    display: block;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
  }

  agent-show-chat {
    box-sizing: border-box;
    position: absolute;
    inset: 0;
    inline-size: auto;
    block-size: auto;
  }

  .agent-dock-main-host {
    overflow: hidden;
    contain: layout paint;
  }

  .agent-dock-source[hidden] { display: none !important; }

  > panel-layout[drawer-mode-active] {
    z-index: var(--sn-agent-dock-z, var(--sn-layer-overlay, 16000));
  }
}
`;
