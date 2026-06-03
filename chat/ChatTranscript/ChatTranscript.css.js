export default `
:host,
chat-transcript {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
  background: var(--sn-chat-bg);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--sn-chat-transcript-padding);
  display: flex;
  flex-direction: column;
  gap: var(--sn-chat-gap);
  position: relative;
  z-index: 1;
}

chat-message-item {
  display: contents;
}

.scroll-bottom-btn {
  position: absolute;
  left: 50%;
  bottom: var(--sn-chat-scroll-bottom);
  z-index: 30;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: var(--sn-node-bg);
  color: var(--sn-text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(4px);
  box-shadow: var(--sn-shadow-lg);
  transition: opacity 0.15s ease, transform 0.15s ease, background 0.12s ease, color 0.12s ease;
}

.scroll-bottom-btn.visible {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.scroll-bottom-btn:hover {
  background: var(--sn-node-hover);
  color: var(--sn-text);
}

.scroll-bottom-btn .material-symbols-outlined {
  font-size: 18px;
}

.live-status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: 12px;
  color: var(--sn-text-dim);
  animation: status-fade-in 0.2s ease;
}

.live-status-indicator .material-symbols-outlined {
  font-size: var(--sn-chat-live-icon-size);
  color: var(--sn-cat-server);
}

.status-card-header .material-symbols-outlined[data-status="done"] {
  color: var(--sn-success-color);
}

.status-card-header .material-symbols-outlined[data-status="error"] {
  color: var(--sn-danger-color);
}

@keyframes status-fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;
