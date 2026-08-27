export default /*css*/ `
chat-show-player {
  box-sizing: border-box;
  display: grid;
  grid-template-rows: auto minmax(0, auto) auto auto auto auto;
  gap: var(--sn-chat-show-player-gap, var(--sn-space-sm));
  max-inline-size: 100%;
  overflow: clip;
  color: var(--sn-text);
  background: var(--sn-panel-bg, var(--sn-sys-surface-raised));
  border: var(--sn-node-border-width, 1px) solid var(--sn-node-border, var(--sn-sys-outline));
  border-radius: var(--sn-node-radius);
  padding: var(--sn-chat-show-player-padding, var(--sn-space-sm));

  .chat-show-header,
  .chat-show-caption,
  .chat-show-tts,
  .chat-show-video-controls,
  .chat-show-controls {
    display: flex;
    align-items: center;
    gap: var(--sn-space-sm);
  }

  .chat-show-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto auto auto;
    min-block-size: var(--sn-chat-show-header-block-size, calc(var(--sn-space-xl) + var(--sn-space-sm)));
  }

  .chat-show-title {
    font-weight: var(--sn-button-font-weight);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-show-icon { color: var(--sn-node-selected); }

  .chat-show-position,
  .chat-show-row-speaker,
  .chat-show-caption-speaker {
    color: var(--sn-text-dim);
  }

  .chat-show-timeline {
    display: grid;
    gap: var(--sn-space-xs);
    grid-template-rows: repeat(2, minmax(0, 1fr));
    block-size: var(--sn-chat-show-timeline-block-size, calc(var(--sn-space-xl) * 4));
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  chat-show-row-item {
    display: contents;
  }

  chat-show-video-control-item { display: contents; }

  .chat-show-row {
    display: grid;
    grid-template-columns: minmax(max-content, 0.25fr) 1fr;
    gap: var(--sn-space-sm);
    inline-size: 100%;
    min-block-size: 0;
    padding: var(--sn-space-xs) var(--sn-space-sm);
    color: inherit;
    text-align: start;
    background: transparent;
    border: 0;
    border-radius: var(--sn-node-radius);

    &[current] {
      background: var(--sn-node-hover);
      outline: var(--sn-node-border-width) solid var(--sn-node-selected);
    }

    .chat-show-row-text {
      display: -webkit-box;
      overflow: hidden;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
  }

  .chat-show-caption {
    min-block-size: calc(var(--sn-space-xl) + var(--sn-space-md));
    padding: var(--sn-space-sm) var(--sn-space-md);
    background: var(--sn-node-bg);
    border-radius: var(--sn-node-radius);
  }

  .chat-show-tts {
    align-items: baseline;
    min-block-size: calc(var(--sn-space-xl) + var(--sn-space-sm));
    padding: var(--sn-space-sm) var(--sn-space-md);
    background: var(--sn-sys-surface-sunken, var(--sn-node-bg));
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border, var(--sn-sys-outline));
    border-radius: var(--sn-node-radius);
  }

  .chat-show-tts-label {
    color: var(--sn-text-dim);
    font-weight: var(--sn-button-font-weight);
  }

  .chat-show-video-controls {
    flex-wrap: wrap;
    min-inline-size: 0;
  }

  .chat-show-video-control {
    display: inline-flex;
    align-items: center;
    gap: var(--sn-space-xs);
    min-block-size: calc(var(--sn-space-xl) + var(--sn-space-sm));
    padding-inline: var(--sn-space-sm);
    color: inherit;
    background: var(--sn-node-bg);
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
  }

  .chat-show-video-control[data-semantics='pointer-only'] {
    border-style: dashed;
  }

  .chat-show-caption-words { display: inline; }
  chat-show-caption-word-item { display: inline; }
  .chat-show-caption-word {
    margin-inline-end: var(--sn-chat-show-caption-word-gap, var(--sn-space-xs));
    &[spoken] { color: var(--sn-text-dim); }
    &[active] {
      color: var(--sn-node-selected);
      font-weight: var(--sn-button-font-weight);
    }
  }

  .chat-show-controls {
    justify-content: center;

    button {
      min-inline-size: calc(var(--sn-space-xl) + var(--sn-space-sm));
      min-block-size: calc(var(--sn-space-xl) + var(--sn-space-sm));
      color: inherit;
      background: var(--sn-node-bg);
      border: var(--sn-node-border-width) solid var(--sn-node-border);
      border-radius: var(--sn-node-radius);
    }

    .chat-show-primary-control {
      color: var(--sn-node-selected);
      background: var(--sn-node-hover);
    }
  }

  .chat-show-header-action {
    inline-size: calc(var(--sn-space-xl) + var(--sn-space-xs));
    block-size: calc(var(--sn-space-xl) + var(--sn-space-xs));
    padding: 0;
    color: var(--sn-text-dim);
    background: transparent;
    border: 0;
    border-radius: var(--sn-node-radius);
  }

  [hidden] { display: none !important; }
}
`;
