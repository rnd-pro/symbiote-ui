export default /*css*/ `
sn-popover {
  display: inline-block;
  position: relative;
}

.sn-popover-trigger-wrapper {
  display: inline-flex;
}

.sn-popover-panel-wrapper {
  display: none;
  position: fixed;
  z-index: var(--sn-overlay-z-base, 20000);
  background-color: var(--sn-popover-bg, var(--sn-panel-bg, #1e1e24));
  border: 1px solid var(--sn-popover-border, var(--sn-outline-color-soft, rgba(255,255,255,0.08)));
  border-radius: var(--sn-popover-radius, var(--sn-panel-radius, 8px));
  padding: calc(var(--sn-step-6, 12px) * var(--sn-theme-density, 1));
  box-shadow: var(--sn-popover-shadow, 0 8px 24px var(--sn-shadow-color, rgba(0, 0, 0, 0.3)));
  color: var(--sn-text);
  font-family: var(--sn-font, sans-serif);
  font-size: calc(var(--sn-text-md, 13px) * var(--sn-theme-type-scale, 1));
  box-sizing: border-box;
  opacity: 0;
  transform: scale(0.96);
  transition: opacity var(--sn-transition-fast, 120ms) ease, transform var(--sn-transition-fast, 120ms) ease;
}

.sn-popover-panel-wrapper[data-visible] {
  display: block;
  opacity: 1;
  transform: scale(1);
}
`;
