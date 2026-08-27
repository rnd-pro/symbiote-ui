export default /*css*/ `
agent-show-chat {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  block-size: 100%;
  min-block-size: 0;
  overflow: hidden;
  color: var(--sn-text, var(--sn-sys-on-surface));
  background: var(--sn-panel-bg, var(--sn-sys-surface));

  > chat-workspace {
    block-size: auto !important;
    height: auto !important;
    min-block-size: 0;
    overflow: hidden;
  }

  > .agent-show-player-region {
    position: relative;
    z-index: var(--sn-agent-show-player-z, 2);
    box-sizing: border-box;
    min-inline-size: 0;
    max-block-size: var(--sn-agent-show-player-max-block-size, min(360px, 44dvh));
    overflow: hidden;
    overscroll-behavior: contain;
    padding: var(--sn-agent-show-player-inset, var(--sn-space-sm, 8px));
    background: var(--sn-panel-bg, var(--sn-sys-surface-sunken));
    border-block-start: var(--sn-node-border-width, 1px) solid var(--sn-node-border, var(--sn-sys-outline));

    > chat-show-player {
      inline-size: 100%;
    }
  }

  [hidden] { display: none !important; }
}
`;
