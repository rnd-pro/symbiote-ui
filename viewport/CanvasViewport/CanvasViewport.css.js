let css = /*css*/`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 100px;
    height: 100%;
    background: var(--sn-panel-bg);
    color: var(--sn-text);
    font-family: var(--sn-font);
    font-size: 11px;
    overflow: hidden;
    --vp-border: var(--sn-node-border);
    --vp-safe-zone: hsl(var(--sn-hue-base) var(--sn-sat-muted) var(--sn-lit-text) / 0.12);
    --vp-checker-light: hsl(var(--sn-hue-base) var(--sn-sat-muted) var(--sn-lit-text) / 0.04);
    --vp-checker-dark: hsl(var(--sn-hue-base) var(--sn-sat-muted) 0% / 0.1);
  }

  /* ── Header bar ── */
  .vp-header {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    background: var(--sn-panel-bg);
    border-bottom: 1px solid var(--vp-border);
    flex-shrink: 0;
  }

  .vp-header select {
    background: var(--sn-node-bg);
    border: 1px solid var(--vp-border);
    color: var(--sn-text-dim);
    padding: 1px 4px;
    border-radius: calc(3px * var(--sn-theme-radius-scale, 1));
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
    transition: var(--sn-effect-hover-transition);
  }

  .vp-header select:hover {
    border-color: var(--sn-node-selected);
  }

  .vp-header button {
    background: var(--sn-node-bg);
    border: 1px solid var(--vp-border);
    color: var(--sn-text-dim);
    padding: 2px 6px;
    border-radius: calc(3px * var(--sn-theme-radius-scale, 1));
    cursor: pointer;
    font-family: inherit;
    font-size: 10px;
    transition: var(--sn-effect-hover-transition);
  }

  .vp-header button:hover {
    background: var(--sn-node-hover);
    color: var(--sn-text);
  }

  .vp-spacer { flex: 1; }

  .vp-zoom-label {
    font-size: 10px;
    color: var(--sn-text-dim);
    font-family: var(--sn-font-mono);
  }

  .vp-frame-label {
    font-size: 10px;
    color: var(--sn-text-dim);
    font-family: var(--sn-font-mono);
  }

  /* ── Canvas area ── */
  .vp-canvas-wrap {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    background:
      repeating-conic-gradient(
        var(--vp-checker-light) 0% 25%,
        var(--vp-checker-dark) 0% 50%)
      50% / 16px 16px;
  }

  .vp-canvas-frame {
    position: relative;
    box-shadow: var(--sn-shadow-lg);
    overflow: hidden;
    transition: width 0.3s ease, height 0.3s ease;
  }

  .vp-canvas-frame canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* ── Safe zone overlay ── */
  .vp-safe-zone {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border: 1px dashed var(--vp-safe-zone);
    margin: 10%;
    opacity: 0;
    transition: opacity var(--sn-transition-fast);
  }

  :host([show-safe-zone]) .vp-safe-zone {
    opacity: 1;
  }

  /* ── Empty state ── */
  .vp-empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sn-text-dim);
    font-size: 12px;
    font-style: italic;
    opacity: 0.5;
  }
`;

export default css;
