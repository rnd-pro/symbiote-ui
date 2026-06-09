export default `
:host {
  display: block;
}

  source-viewer {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    min-block-size: 0;
    overflow: hidden;
    container-type: inline-size;
  }
  source-viewer:not([has-file]) code-block {
    display: none;
  }
  .sv-shell {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    inline-size: 100%;
    block-size: 100%;
    min-inline-size: 0;
    min-block-size: 0;
    overflow: hidden;
  }
  .sv-header {
    box-sizing: border-box;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, max-content);
    align-items: center;
    column-gap: var(--sn-source-toolbar-gap);
    block-size: var(--sn-source-header-block-size, var(--sn-layout-header-block-size, calc(var(--sn-layout-header-min-height, 28px) + 3px)));
    min-block-size: var(--sn-source-header-block-size, var(--sn-layout-header-block-size, calc(var(--sn-layout-header-min-height, 28px) + 3px)));
    padding: var(--sn-source-header-padding, 4px 12px);
    font-family: var(--sn-font-mono, 'SF Mono', 'Fira Code', monospace);
    font-size: var(--sn-source-header-size, 11px);
    color: var(--sn-text-dim);
    border-bottom: 1px solid var(--sn-source-border);
    background: var(--sn-source-header-bg);
    overflow: hidden;
  }
  .sv-filename {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-inline-size: 0;
  }
  .sv-controls {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--sn-source-toolbar-gap);
    flex-wrap: nowrap;
    min-inline-size: 0;
    max-inline-size: var(--sn-source-controls-max-inline-size, 46cqw);
    overflow: hidden;
  }
  .sv-stats {
    font-size: var(--sn-source-stats-size, 10px);
    color: var(--sn-cat-server);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-inline-size: 0;
  }
  .sv-stats::before {
    content: attr(data-source-text);
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
    flex: 0 1 auto;
    min-inline-size: 0;
    white-space: nowrap;
    transition: background var(--sn-transition-fast) var(--sn-transition-easing), border-color var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing), opacity var(--sn-transition-fast) var(--sn-transition-easing);
  }
  .sv-action-label {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sv-action-label::before {
    content: attr(data-label);
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
    flex: 1 1 auto;
    min-height: 0;
    min-block-size: 0;
  }

  @container (max-width: 520px) {
    .sv-action {
      padding-inline: var(--sn-source-action-compact-padding-inline, 6px);
    }
    .sv-action-label {
      display: none;
    }
  }

  @container (max-width: 460px) {
    .sv-stats {
      display: none;
    }
  }

  @container (max-width: 380px) {
    .sv-graph-action {
      display: none;
    }
  }

  @container (max-width: 320px) {
    .sv-save-action {
      display: none;
    }
  }
`;
