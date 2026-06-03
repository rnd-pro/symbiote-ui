export default `
:host,
quick-open {
  display: block;
}

  :host { position: fixed; inset: 0; z-index: 9999; pointer-events: none; },
  quick-open { position: fixed; inset: 0; z-index: 9999; pointer-events: none; }
  .qo-overlay {
    position: fixed; inset: 0; z-index: 9999;
    background: var(--sn-bg-overlay);
    display: flex; justify-content: center; padding-top: 15vh;
    pointer-events: all;
    animation: qo-fadein 100ms ease;
  }
  .qo-overlay[hidden] { display: none !important; }
  .qo-hidden { display: none !important; pointer-events: none; }
  .qo-dialog {
    width: 520px;
    max-height: 420px;
    background: var(--sn-panel-bg);
    border: 1px solid var(--sn-node-border);
    border-radius: 10px;
    box-shadow: 0 20px 60px var(--sn-bg-overlay);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .qo-input-wrap {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    gap: 8px;
    border-bottom: 1px solid var(--sn-node-border);
  }
  .qo-icon { color: var(--sn-text-dim); font-size: 20px; }
  .qo-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--sn-text);
    font-size: 15px;
    font-family: inherit;
    outline: none;
    padding: 6px 0;
  }
  .qo-input::placeholder { color: var(--sn-text-dim); }
  .qo-kbd {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    background: var(--sn-node-bg);
    border: 1px solid var(--sn-node-border);
    color: var(--sn-text-dim);
    font-family: monospace;
  }
  .qo-results {
    overflow-y: auto;
    padding: 4px 0;
    max-height: 350px;
  }
  .qo-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    cursor: pointer;
    transition: background 80ms ease;
  }
  .qo-item:hover { background: var(--sn-node-hover); }
  .qo-item.qo-selected {
    background: var(--sn-accent-bg);
  }
  .qo-name {
    font-size: 13px;
    color: var(--sn-text);
    font-weight: 500;
  }
  .qo-path {
    font-size: 11px;
    color: var(--sn-text-dim);
    margin-left: auto;
    font-family: var(--sn-font-mono);
  }
  .qo-empty {
    padding: 20px;
    text-align: center;
    color: var(--sn-text-dim);
    font-style: italic;
  }
  @keyframes qo-fadein { from { opacity: 0; } to { opacity: 1; } }
`;
