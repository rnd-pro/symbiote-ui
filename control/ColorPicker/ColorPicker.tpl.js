import { html } from '@symbiotejs/symbiote';

export default html`
  <div class="sn-color-container">
    <button ref="trigger" type="button" class="sn-color-trigger" aria-haspopup="dialog" aria-expanded="false">
      <div ref="previewSwatch" class="sn-color-swatch-preview"></div>
      <span class="sn-color-value-text">{{value}}</span>
    </button>
    <div ref="dropdown" class="sn-color-dropdown" role="dialog" aria-label="Color picker dropdown" tabindex="-1">
      <div ref="canvas" class="sn-color-canvas-wrap">
        <div class="sn-color-canvas-bg" ref="canvasBg"></div>
        <div ref="handle" class="sn-color-canvas-handle"></div>
      </div>
      <input ref="hueSlider" type="range" class="sn-color-hue-slider" min="0" max="360" value="0">
      <div ref="presets" class="sn-color-presets"></div>
      <div class="sn-color-input-wrap">
        <input ref="hexInput" type="text" class="sn-color-text-input" placeholder="#000000" maxlength="7">
      </div>
    </div>
    <input ref="nativeInput" type="color" class="sn-color-native-input" tabindex="-1" aria-hidden="true">
  </div>
`;
