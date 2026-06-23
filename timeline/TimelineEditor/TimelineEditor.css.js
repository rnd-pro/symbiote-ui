let css = /*css*/`
  sn-timeline-editor {
    display: flex;
    flex-direction: column;
    min-height: 120px;
    height: 100%;
    background: var(--sn-panel-bg);
    color: var(--sn-text);
    font-family: var(--sn-font);
    font-size: var(--sn-text-xs);
    overflow: hidden;
    user-select: none;
    --te-track-height: 36px;
    --te-ruler-height: 28px;
    --te-header-width: 140px;
    --te-playhead-color: var(--sn-danger-color);
    --te-clip-radius: calc(3px * var(--sn-theme-radius-scale, 1));
    --te-border: var(--sn-node-border);
    --te-track-bg: var(--sn-bg);
    --te-track-bg-alt: color-mix(in srgb, var(--sn-bg) 85%, var(--sn-panel-bg));
    --te-clip-video: hsl(var(--sn-hue-accent) var(--sn-sat-vivid) 42%);
    --te-clip-audio: hsl(var(--sn-hue-warning) var(--sn-sat-vivid) 42%);
    --te-clip-text: hsl(var(--sn-hue-success) var(--sn-sat-vivid) 38%);
    --te-clip-effect: hsl(280 50% 45%);
    --te-marker-color: var(--sn-warning-color);
    --te-selection: hsl(var(--sn-hue-accent) var(--sn-sat-vivid) 50% / 0.25);
  }

  /* ── Transport bar ── */
  .te-transport {
    display: flex;
    align-items: center;
    gap: var(--sn-step-4);
    height: 28px;
    padding: 0 var(--sn-step-4);
    background: var(--sn-panel-bg);
    border-bottom: 1px solid var(--te-border);
    flex-shrink: 0;
  }

  .te-transport button {
    background: var(--sn-node-bg);
    border: 1px solid var(--te-border);
    color: var(--sn-text-dim);
    padding: var(--sn-step-1) var(--sn-step-3);
    border-radius: calc(3px * var(--sn-theme-radius-scale, 1));
    cursor: pointer;
    font-family: inherit;
    font-size: var(--sn-text-xs);
    line-height: 1;
    transition: var(--sn-effect-hover-transition);
  }

  .te-transport button:hover {
    background: var(--sn-node-hover);
    color: var(--sn-text);
  }

  .te-transport button[data-active] {
    background: var(--te-playhead-color);
    border-color: var(--te-playhead-color);
    color: hsl(0 0% 8%);
  }

  .te-transport .te-time {
    font-family: var(--sn-font-mono);
    font-size: var(--sn-text-xs);
    color: var(--sn-text);
    min-width: 80px;
    text-align: center;
  }

  .te-transport .te-spacer {
    flex: 1;
  }

  .te-transport .te-zoom-label {
    font-size: var(--sn-text-2xs);
    color: var(--sn-text-dim);
  }

  /* ── Main area ── */
  .te-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  /* ── Track headers (left) ── */
  .te-headers {
    width: var(--te-header-width);
    flex-shrink: 0;
    border-right: 1px solid var(--te-border);
    display: flex;
    flex-direction: column;
  }

  .te-headers-ruler-pad {
    height: var(--te-ruler-height);
    border-bottom: 1px solid var(--te-border);
    display: flex;
    align-items: center;
    padding: 0 var(--sn-step-4);
    font-size: var(--sn-text-2xs);
    color: var(--sn-text-dim);
  }

  .te-header-track {
    height: var(--te-track-height);
    display: flex;
    align-items: center;
    padding: 0 var(--sn-step-4);
    gap: var(--sn-step-3);
    border-bottom: 1px solid var(--te-border);
    cursor: default;
  }

  .te-header-track:nth-child(odd) {
    background: var(--te-track-bg);
  }

  .te-header-track:nth-child(even) {
    background: var(--te-track-bg-alt);
  }

  .te-header-icon {
    width: 14px;
    height: 14px;
    border-radius: var(--sn-radius-xs);
    flex-shrink: 0;
  }

  .te-header-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--sn-text-xs);
  }

  .te-header-mute {
    width: 16px;
    height: 16px;
    border: none;
    background: none;
    color: var(--sn-text-dim);
    cursor: pointer;
    font-size: var(--sn-text-sm);
    padding: 0;
    opacity: 0.5;
    transition: opacity var(--sn-transition-fast);
  }

  .te-header-mute:hover {
    opacity: 1;
  }

  /* ── Canvas area (right) ── */
  .te-canvas-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .te-ruler {
    height: var(--te-ruler-height);
    position: relative;
    border-bottom: 1px solid var(--te-border);
    cursor: pointer;
    overflow: hidden;
    flex-shrink: 0;
  }

  .te-ruler canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .te-tracks-scroll {
    flex: 1;
    overflow-x: auto;
    overflow-y: auto;
    position: relative;
    scrollbar-color: var(--sn-scrollbar-thumb) var(--sn-scrollbar-track);
    scrollbar-width: var(--sn-scrollbar-width, thin);
  }

  .te-tracks-canvas {
    position: relative;
    min-height: 100%;
  }

  .te-tracks-canvas canvas {
    display: block;
    width: 100%;
  }

  /* ── Playhead ── */
  .te-playhead {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: var(--te-playhead-color);
    pointer-events: none;
    z-index: 10;
    transition: left 0.03s linear;
  }

  .te-playhead::before {
    content: '';
    position: absolute;
    top: 0;
    left: -5px;
    width: 11px;
    height: 8px;
    background: var(--te-playhead-color);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
  }

  /* ── Empty state ── */
  .te-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--sn-text-dim);
    font-size: var(--sn-text-sm);
    font-style: italic;
    opacity: 0.5;
  }

  .te-empty[hidden],
  .te-headers[hidden],
  .te-canvas-area[hidden] {
    display: none;
  }
`;

export default css;
