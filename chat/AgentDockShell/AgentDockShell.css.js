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

  .agent-dock-main-node > .panel-view > .panel-header {
    display: none !important;
  }

  .agent-dock-main-node > .panel-view > .panel-content {
    min-inline-size: 0;
    min-block-size: 0;
    padding: 0;
    overflow: hidden;
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
