let css = /*css*/`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 120px;
    height: 100%;
    background: var(--sn-bg, #1a1a2e);
    color: var(--sn-text, #e0e0e0);
    font-family: var(--sn-font, 'Inter', system-ui, sans-serif);
    font-size: var(--sn-font-size-sm, 11px);
    overflow: hidden;
    user-select: none;
    --te-track-height: 36px;
    --te-ruler-height: 28px;
    --te-header-width: 140px;
    --te-playhead-color: hsl(var(--sn-hue-danger, 0) 70% 55%);
    --te-clip-radius: 3px;
    --te-border: var(--sn-outline-color, rgba(255,255,255,0.08));
    --te-track-bg: var(--sn-panel-bg, rgba(255,255,255,0.03));
    --te-track-bg-alt: rgba(255,255,255,0.015);
    --te-clip-video: hsl(210 55% 42%);
    --te-clip-audio: hsl(45 65% 42%);
    --te-clip-text: hsl(150 45% 38%);
    --te-clip-effect: hsl(280 50% 45%);
    --te-marker-color: hsl(var(--sn-hue-warning, 40) 70% 55%);
    --te-selection: hsl(var(--sn-hue-accent, 220) 60% 50% / 0.25);
  }

  /* ── Transport bar ── */
  .te-transport {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 28px;
    padding: 0 8px;
    background: var(--sn-bg, #1a1a2e);
    border-bottom: 1px solid var(--te-border);
    flex-shrink: 0;
  }

  .te-transport button {
    background: none;
    border: 1px solid var(--te-border);
    color: var(--sn-text-dim, #aaa);
    padding: 2px 6px;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    font-size: 11px;
    line-height: 1;
    transition: background 0.15s, color 0.15s;
  }

  .te-transport button:hover {
    background: rgba(255,255,255,0.06);
    color: var(--sn-text, #e0e0e0);
  }

  .te-transport button[data-active] {
    background: var(--te-playhead-color);
    border-color: var(--te-playhead-color);
    color: #fff;
  }

  .te-transport .te-time {
    font-family: var(--sn-font-mono, 'JetBrains Mono', monospace);
    font-size: 11px;
    color: var(--sn-text, #e0e0e0);
    min-width: 80px;
    text-align: center;
  }

  .te-transport .te-spacer {
    flex: 1;
  }

  .te-transport .te-zoom-label {
    font-size: 10px;
    color: var(--sn-text-dim, #aaa);
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
    padding: 0 8px;
    font-size: 10px;
    color: var(--sn-text-dim, #aaa);
  }

  .te-header-track {
    height: var(--te-track-height);
    display: flex;
    align-items: center;
    padding: 0 8px;
    gap: 6px;
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
    border-radius: 2px;
    flex-shrink: 0;
  }

  .te-header-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }

  .te-header-mute {
    width: 16px;
    height: 16px;
    border: none;
    background: none;
    color: var(--sn-text-dim, #aaa);
    cursor: pointer;
    font-size: 12px;
    padding: 0;
    opacity: 0.5;
    transition: opacity 0.15s;
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

  /* ── Markers ── */
  .te-marker {
    position: absolute;
    top: 0;
    width: 1px;
    height: 100%;
    background: var(--te-marker-color);
    opacity: 0.6;
    pointer-events: none;
    z-index: 5;
  }

  .te-marker::before {
    content: attr(data-label);
    position: absolute;
    top: -16px;
    left: 2px;
    font-size: 9px;
    color: var(--te-marker-color);
    white-space: nowrap;
  }

  /* ── Empty state ── */
  .te-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--sn-text-dim, #aaa);
    font-size: 12px;
    opacity: 0.5;
  }
`;

export default css;
