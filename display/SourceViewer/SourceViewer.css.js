export default `
:host {
  display: block;
}

  source-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  }
  source-viewer:not([has-file]) code-block {
    display: none;
  }
  .sv-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--sn-source-header-padding, 6px 12px);
    font-family: var(--sn-font-mono, 'SF Mono', 'Fira Code', monospace);
    font-size: var(--sn-source-header-size, 11px);
    color: var(--sn-text-dim);
    border-bottom: 1px solid var(--sn-source-border);
    background: var(--sn-source-header-bg);
    gap: var(--sn-source-toolbar-gap);
  }
  .sv-filename {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .sv-controls {
    display: flex;
    align-items: center;
    gap: var(--sn-source-toolbar-gap);
    flex-shrink: 0;
  }
  .sv-stats {
    font-size: var(--sn-source-stats-size, 10px);
    color: var(--sn-cat-server);
    white-space: nowrap;
  }
  .sv-action {
    display: flex;
    align-items: center;
    gap: var(--sn-source-action-gap, 3px);
    padding: var(--sn-source-action-padding, 2px 8px);
    border: 1px solid var(--sn-source-border);
    border-radius: var(--sn-source-action-radius);
    background: var(--sn-source-action-bg);
    color: var(--sn-text-dim);
    font-family: inherit;
    font-size: var(--sn-source-action-size, 10px);
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: background var(--sn-transition-fast) var(--sn-transition-easing), border-color var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing), opacity var(--sn-transition-fast) var(--sn-transition-easing);
  }
  .sv-action .material-symbols-outlined {
    font-size: var(--sn-source-action-icon-size);
    line-height: 1;
  }
  .sv-action:hover {
    background: var(--sn-source-action-hover-bg);
    color: var(--sn-text);
  }
  source-viewer[mode-raw] .sv-action {
    background: var(--sn-accent-bg-subtle);
    border-color: var(--sn-cat-server);
    color: var(--sn-cat-server);
  }
  .sv-action[hidden] {
    display: none;
  }
  code-block {
    flex: 1;
    min-height: 0;
  }
`;
