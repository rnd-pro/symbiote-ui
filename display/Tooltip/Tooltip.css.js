export default /*css*/ `
sn-tooltip {
  display: inline-block;
  position: relative;
}

.sn-tooltip-popup {
  position: absolute;
  z-index: 1000;
  display: none;
  box-sizing: border-box;
  max-width: var(--sn-tooltip-max-width, 200px);
  padding: var(--sn-tooltip-padding, 4px 8px);
  border-radius: var(--sn-tooltip-radius, 4px);
  background: var(--sn-tooltip-bg, #1e1e1e);
  color: var(--sn-tooltip-color, #fff);
  font-family: var(--sn-font);
  font-size: var(--sn-tooltip-font-size, 11px);
  line-height: var(--sn-tooltip-line-height, 1.35);
  box-shadow: var(--sn-tooltip-shadow, 0 2px 8px rgba(0, 0, 0, 0.15));
  pointer-events: none;
  white-space: nowrap;
}

.sn-tooltip-popup[data-visible] {
  display: block;
}

.sn-tooltip-popup[data-overlay-portal] {
  position: fixed;
  inset-block-start: 0;
  inset-inline-start: 0;
  transform: translate(var(--sn-tooltip-x, 0), var(--sn-tooltip-y, 0));
}
`;
