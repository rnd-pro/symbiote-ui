export default `
:host,
chat-workspace {
  container: chat-workspace / inline-size;
  display: flex;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--sn-chat-bg);
  color: var(--sn-text);
  font-family: var(--sn-font);
}

:host([sidebar="hidden"]),
chat-workspace[sidebar="hidden"] {
  --chat-workspace-sidebar-display: none;
}

.chat-workspace-sidebar {
  display: var(--chat-workspace-sidebar-display, flex);
  min-height: 0;
}

.chat-workspace-main {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.chat-workspace-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}

.chat-workspace-transcript {
  flex: 1 1 auto;
  min-height: 0;
  position: relative;
  z-index: 1;
  --sn-chat-bg: transparent;
}

.chat-workspace-composer {
  flex: 0 0 auto;
  position: relative;
  z-index: 1;
}

:host([empty]) .chat-workspace-main,
chat-workspace[empty] .chat-workspace-main {
  justify-content: center;
  align-items: center;
}

:host([empty]) .chat-workspace-transcript,
chat-workspace[empty] .chat-workspace-transcript {
  display: none;
}

:host([empty]) .chat-workspace-composer,
chat-workspace[empty] .chat-workspace-composer {
  position: relative;
  width: min(90%, var(--sn-chat-empty-composer-max-width, 640px));
}

@container chat-workspace (width <= 520px) {
  :host,
  chat-workspace {
    --sn-chat-sidebar-width: min(44cqi, 180px);
  }
}
`;
