let css = /*css*/`
  :host {
    display: flex;
    flex-direction: column;
    min-height: 100px;
    height: 100%;
    background: var(--sn-bg, #1a1a2e);
    color: var(--sn-text, #e0e0e0);
    font-family: var(--sn-font, 'Inter', system-ui, sans-serif);
    font-size: var(--sn-font-size-sm, 11px);
    overflow: hidden;
    --vp-checker-light: rgba(255,255,255,0.04);
    --vp-checker-dark: rgba(0,0,0,0.1);
    --vp-border: var(--sn-outline-color, rgba(255,255,255,0.08));
    --vp-safe-zone: rgba(255,255,255,0.12);
  }

  /* ── Header bar ── */
  .vp-header {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 8px;
    background: var(--sn-bg, #1a1a2e);
    border-bottom: 1px solid var(--vp-border);
    flex-shrink: 0;
  }

  .vp-header select {
    background: rgba(255,255,255,0.06);
    border: 1px solid var(--vp-border);
    color: var(--sn-text-dim, #aaa);
    padding: 1px 4px;
    border-radius: 3px;
    font-family: inherit;
    font-size: 10px;
    cursor: pointer;
  }

  .vp-header button {
    background: none;
    border: 1px solid var(--vp-border);
    color: var(--sn-text-dim, #aaa);
    padding: 2px 6px;
    border-radius: 3px;
    cursor: pointer;
    font-family: inherit;
    font-size: 10px;
    transition: background 0.15s, color 0.15s;
  }

  .vp-header button:hover {
    background: rgba(255,255,255,0.06);
    color: var(--sn-text, #e0e0e0);
  }

  .vp-spacer { flex: 1; }

  .vp-zoom-label {
    font-size: 10px;
    color: var(--sn-text-dim, #aaa);
    font-family: var(--sn-font-mono, monospace);
  }

  .vp-frame-label {
    font-size: 10px;
    color: var(--sn-text-dim, #aaa);
    font-family: var(--sn-font-mono, monospace);
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
    box-shadow: 0 2px 16px rgba(0,0,0,0.5);
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
    transition: opacity 0.2s;
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
    color: var(--sn-text-dim, #aaa);
    font-size: 12px;
    opacity: 0.5;
  }
`;

export default css;
