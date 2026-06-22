export default /*css*/ `
sn-qr-code {
  display: inline-block;
  font-family: var(--sn-font, sans-serif);
  box-sizing: border-box;
}

.sn-qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 6px);
  padding: var(--sn-space-md);
  box-sizing: border-box;
}

.sn-qr-svg-wrap {
  width: 120px;
  height: 120px;
  background-color: var(--sn-qr-background, #fff);
  padding: 6px;
  border-radius: 4px;
  box-sizing: border-box;
}

.sn-qr-svg {
  width: 100%;
  height: 100%;
}

.sn-qr-module {
  fill: var(--sn-qr-module-color, #000);
}

.sn-qr-label {
  margin-top: var(--sn-space-sm);
  max-width: 120px;
  font-size: 11px;
  color: var(--sn-text-dim, rgba(255,255,255,0.5));
  overflow-wrap: anywhere;
}
`;
