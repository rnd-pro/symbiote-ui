export default /*css*/ `
sn-video-player {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
  box-sizing: border-box;
}

.sn-video-container {
  position: relative;
  width: 100%;
  background-color: var(--sn-video-bg, var(--sn-bg, #000));
  border-radius: var(--sn-panel-radius, 6px);
  overflow: hidden;
  box-sizing: border-box;
}

.sn-video-element {
  width: 100%;
  display: block;
}

.sn-video-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--sn-video-controls-bg, linear-gradient(transparent, rgba(0, 0, 0, 0.85)));
  padding: var(--sn-space-sm) var(--sn-space-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 10;
  opacity: 0;
  transition: opacity var(--sn-transition-normal, 240ms);
}

.sn-video-container:hover .sn-video-controls {
  opacity: 1;
}

.sn-video-controls-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sn-space-md);
}

.sn-video-controls-group {
  display: flex;
  align-items: center;
  gap: var(--sn-space-sm);
}

.sn-video-btn {
  background: none;
  border: none;
  color: var(--sn-video-btn-color, #fff);
  cursor: pointer;
  padding: var(--sn-space-xs);
  border-radius: var(--sn-radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color var(--sn-transition-fast, 120ms);
}

.sn-video-btn:hover {
  color: var(--sn-node-selected, #2e90fa);
}

.sn-video-scrub-bar {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  background: var(--sn-video-track, rgba(255, 255, 255, 0.3));
  border-radius: var(--sn-radius-xs);
  outline: none;
  cursor: pointer;
}

.sn-video-scrub-bar::-webkit-slider-runnable-track {
  width: 100%;
  height: 4px;
}

.sn-video-scrub-bar::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--sn-node-selected, #2e90fa);
  cursor: pointer;
  margin-top: -3px;
}

.sn-video-time {
  font-size: var(--sn-text-xs);
  color: var(--sn-video-text, #fff);
  font-variant-numeric: tabular-nums;
}

.sn-video-volume-slider {
  -webkit-appearance: none;
  width: 60px;
  height: 4px;
  background: var(--sn-video-track, rgba(255, 255, 255, 0.3));
  border-radius: var(--sn-radius-xs);
  outline: none;
  cursor: pointer;
}

.sn-video-volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--sn-video-thumb, #fff);
}
`;
