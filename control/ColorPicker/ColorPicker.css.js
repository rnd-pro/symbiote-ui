export default /*css*/ `
sn-color-picker {
  display: block;
  font-family: var(--sn-font, sans-serif);
  position: relative;
  width: 100%;
}

.sn-color-container {
  position: relative;
  width: 100%;
}

.sn-color-trigger {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-height: calc(36px * var(--sn-theme-density, 1));
  padding: 0 calc(12px * var(--sn-theme-density, 1));
  background: var(--sn-field-control-bg, var(--sn-bg, #0c0c0e));
  border: 1px solid var(--sn-field-control-border, var(--sn-outline-color-soft, rgba(255,255,255,0.08)));
  border-radius: var(--sn-field-control-radius, var(--sn-panel-radius, 6px));
  color: var(--sn-text);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  cursor: pointer;
  text-align: left;
}

.sn-color-trigger:focus-visible {
  outline: none;
  border-color: var(--sn-field-control-focus-border, var(--sn-node-selected, #2e90fa));
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--sn-node-selected, #2e90fa) 25%, transparent);
}

.sn-color-swatch-preview {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.2));
  margin-right: var(--sn-space-sm);
  box-sizing: border-box;
}

.sn-color-dropdown {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  margin-top: var(--sn-space-xs);
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 6px);
  box-shadow: var(--sn-panel-shadow, 0 10px 25px rgba(0,0,0,0.35));
  padding: var(--sn-space-md);
  box-sizing: border-box;
  min-width: 220px;
}

.sn-color-dropdown[data-visible] {
  display: block;
}

.sn-color-canvas-wrap {
  position: relative;
  width: 100%;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: var(--sn-space-sm);
  cursor: crosshair;
}

.sn-color-canvas-bg {
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, transparent, #000), linear-gradient(to right, #fff, transparent);
}

.sn-color-canvas-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 4px rgba(0,0,0,0.5);
  margin-left: -6px;
  margin-top: -6px;
  pointer-events: none;
}

.sn-color-native-input {
  display: none;
}

.sn-color-hue-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 10px;
  border-radius: 5px;
  outline: none;
  margin-bottom: var(--sn-space-md);
  background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);
}

.sn-color-hue-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--sn-outline-color-soft, rgba(0,0,0,0.3));
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.sn-color-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: var(--sn-space-sm);
}

.sn-color-preset-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.1));
}

.sn-color-preset-swatch:hover {
  transform: scale(1.1);
}

.sn-color-input-wrap {
  display: flex;
  gap: var(--sn-space-sm);
}

.sn-color-text-input {
  box-sizing: border-box;
  flex: 1;
  background: var(--sn-field-control-bg, var(--sn-bg, #0c0c0e));
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  color: var(--sn-text);
  border-radius: 4px;
  padding: var(--sn-space-xs) var(--sn-space-sm);
  font-size: 12px;
  outline: none;
}

.sn-color-text-input:focus {
  border-color: var(--sn-node-selected, #2e90fa);
}

sn-color-picker[disabled] .sn-color-trigger {
  cursor: not-allowed;
  opacity: 0.6;
}
`;
