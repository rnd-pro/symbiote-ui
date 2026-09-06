export default /*css*/ `
chat-show-player {
  box-sizing: border-box;
  position: relative;
  display: grid;
  grid-template-rows: auto minmax(0, auto) auto auto auto auto;
  gap: var(--sn-chat-show-player-gap, var(--sn-space-sm));
  max-inline-size: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--sn-text);
  font-family: var(--sn-chat-show-font-family, var(--sn-font-ui));
  font-size: var(--sn-chat-show-font-size, var(--sn-frame-font-size));
  line-height: var(--sn-chat-show-line-height, 1.4);
  background: var(--sn-panel-bg, var(--sn-sys-surface-raised));
  border: var(--sn-node-border-width, 1px) solid var(--sn-node-border, var(--sn-sys-outline));
  border-radius: var(--sn-node-radius);
  padding: var(--sn-chat-show-player-padding, var(--sn-space-sm));

  .chat-show-header,
  .chat-show-caption,
  .chat-show-video-controls,
  .chat-show-controls {
    display: flex;
    align-items: center;
    gap: var(--sn-space-sm);
  }

  .chat-show-header {
    min-block-size: var(--sn-chat-show-header-block-size, var(--sn-button-icon-size));
  }

  .chat-show-menu {
    position: absolute;
    z-index: var(--sn-chat-show-menu-z, var(--sn-layer-popover, 12));
    inset-block-start: calc(var(--sn-chat-show-player-padding, var(--sn-space-sm)) + var(--sn-chat-show-header-block-size, var(--sn-button-icon-size)));
    inset-inline-end: var(--sn-chat-show-player-padding, var(--sn-space-sm));
    display: grid;
    min-inline-size: var(--sn-chat-show-menu-min-inline-size, 168px);
    padding: var(--sn-space-xs);
    background: var(--sn-panel-bg, var(--sn-sys-surface-raised));
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border, var(--sn-sys-outline));
    border-radius: var(--sn-node-radius);
    box-shadow: var(--sn-panel-shadow);

    .chat-show-menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sn-space-md);
    }

    .chat-show-menu-actions {
      display: flex;
      align-items: center;
      gap: var(--sn-space-xs);
    }

    .chat-show-menu-action {
      inline-size: var(--sn-button-icon-size);
      block-size: var(--sn-button-icon-size);
      padding: 0;
      color: inherit;
      background: transparent;
      border: 0;
      border-radius: var(--sn-node-radius);
    }

    .chat-show-menu-action:hover,
    .chat-show-menu-action:focus-visible {
      background: var(--sn-node-hover);
    }
  }

  .chat-show-title {
    flex: 1 1 auto;
    min-inline-size: 0;
    font-weight: var(--sn-button-font-weight);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chat-show-icon {
    color: var(--sn-node-selected);
    font-size: var(--sn-chat-show-header-icon-size, var(--sn-button-icon-font-size));
  }

  .chat-show-position,
  .chat-show-row-speaker {
    color: var(--sn-text-dim);
  }

  .chat-show-timeline {
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    block-size: var(--sn-chat-show-timeline-block-size, calc(2lh + var(--sn-space-sm)));
    overflow: hidden;
  }

  chat-show-row-item {
    display: contents;
  }

  chat-show-video-control-item { display: contents; }
  chat-show-progress-segment-item { display: contents; }

  .chat-show-row {
    display: grid;
    grid-template-columns: max-content minmax(0, 1fr);
    gap: var(--sn-space-sm);
    inline-size: 100%;
    min-block-size: 0;
    padding: var(--sn-space-xs) calc(var(--sn-space-md) + var(--sn-node-border-width, 1px));
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
    display: block;
    padding: var(--sn-space-sm) var(--sn-space-md);
    background: var(--sn-node-bg);
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border, var(--sn-sys-outline));
    border-radius: var(--sn-node-radius);
  }

  /* Explicit compact host mode (attribute kept by the mobile footer host). */
  &[compact-caption] .chat-show-caption {
    display: none !important;
  }

  .chat-show-caption-viewport {
    display: block;
    min-inline-size: 0;
    block-size: calc(3lh + var(--sn-space-xs));
    overflow-x: hidden;
    overflow-y: auto;
    scroll-behavior: smooth;
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

  .chat-show-caption-words,
  .chat-show-caption-text { display: inline; }
  chat-show-caption-word-item {
    display: inline-block;
    margin-inline-end: var(--sn-chat-show-caption-word-gap, var(--sn-space-xs));
  }
  .chat-show-caption-word {
    &[spoken] { color: var(--sn-text-dim); }
    &[active] {
      color: var(--sn-node-selected);
      font-weight: var(--sn-button-font-weight);
    }
  }

  .chat-show-progress {
    display: grid;
    gap: var(--sn-step-1);
    inline-size: 100%;
    min-inline-size: 0;
  }

  .chat-show-progress-track {
    position: relative;
    display: flex;
    align-items: center;
    inline-size: 100%;
    block-size: calc(var(--sn-step-2) + var(--sn-space-sm));
    cursor: pointer;
    touch-action: none;

    &:focus-visible {
      outline: none;

      .chat-show-progress-thumb {
        box-shadow: 0 0 0 var(--sn-step-1) var(--sn-accent-border);
      }
    }
  }

  .chat-show-progress-segments {
    display: flex;
    gap: var(--sn-step-1);
    inline-size: 100%;
    block-size: var(--sn-step-2);
    pointer-events: none;
  }

  .chat-show-progress-segment {
    flex-grow: var(--chat-show-progress-weight);
    flex-basis: 0;
    min-inline-size: 0;
    overflow: hidden;
    background: var(--sn-node-border, var(--sn-accent-border, var(--sn-sys-outline)));
    border-radius: var(--sn-radius-full);
  }

  .chat-show-progress-fill {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    background: var(--sn-node-selected, var(--sn-sys-accent));
    border-radius: inherit;
    transform: scaleX(var(--chat-show-progress-fill));
    transform-origin: 0 50%;
    transition: transform var(--sn-transition-normal) linear;
  }

  .chat-show-progress-thumb {
    position: absolute;
    inset-inline-start: calc(
      var(--sn-step-3)
      + var(--chat-show-progress-position) * (100% - var(--sn-step-3) - var(--sn-step-3))
    );
    inline-size: calc(var(--sn-step-3) + var(--sn-step-3));
    block-size: calc(var(--sn-step-3) + var(--sn-step-3));
    background: var(--sn-node-selected, var(--sn-sys-accent));
    border-radius: var(--sn-radius-full);
    transform: translateX(-50%);
    transition: inset-inline-start var(--sn-transition-normal) linear;
    pointer-events: none;
  }

  .chat-show-progress-time {
    display: flex;
    justify-content: space-between;
    gap: var(--sn-space-sm);
    color: var(--sn-text-dim, var(--sn-sys-on-surface-dim));
    font-variant-numeric: tabular-nums;
  }

  .chat-show-progress-clock {
    display: flex;
    gap: var(--sn-space-xs);
  }

  .chat-show-controls {
    justify-content: center;

    button {
      min-inline-size: var(--sn-chat-show-control-size, var(--sn-button-icon-size));
      min-block-size: var(--sn-chat-show-control-size, var(--sn-button-icon-size));
      font-size: var(--sn-chat-show-control-icon-size, var(--sn-button-icon-font-size));
      font-variation-settings: 'FILL' 1;
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
    inline-size: var(--sn-chat-show-header-control-size, var(--sn-button-icon-size));
    block-size: var(--sn-chat-show-header-control-size, var(--sn-button-icon-size));
    font-size: var(--sn-chat-show-header-icon-size, var(--sn-button-icon-font-size));
    padding: 0;
    color: var(--sn-text-dim);
    background: transparent;
    border: 0;
    border-radius: var(--sn-node-radius);
  }

  &[panel-layout] {
    grid-template-columns: minmax(168px, 0.28fr) minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    gap: var(--sn-space-xs) var(--sn-space-sm);
    padding: var(--sn-space-xs) var(--sn-space-sm);
    overflow: hidden;

    .chat-show-header {
      display: none;
    }

    .chat-show-video-controls,
    .chat-show-progress,
    .chat-show-controls {
      grid-column: 1 / -1;
    }

    .chat-show-timeline {
      grid-column: 1;
      grid-row: 2;
      block-size: calc(2lh + var(--sn-space-xs));
    }

    .chat-show-caption {
      grid-column: 2;
      grid-row: 2;
      min-block-size: 0;
      padding: var(--sn-space-xs) var(--sn-space-sm);
    }

    .chat-show-caption-viewport {
      block-size: calc(2lh + var(--sn-space-xs));
    }

    .chat-show-progress {
      gap: 0;
    }
  }

  [hidden] { display: none !important; }
}
`;
