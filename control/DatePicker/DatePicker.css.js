export default /*css*/ `
sn-date-picker {
  display: block;
  font-family: var(--sn-font, sans-serif);
  position: relative;
  width: 100%;
}

.sn-date-container {
  position: relative;
  width: 100%;
}

.sn-date-trigger {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
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

.sn-date-trigger:focus-visible {
  outline: none;
  border-color: var(--sn-field-control-focus-border, var(--sn-node-selected, #2e90fa));
  box-shadow: 0 0 0 2px color-mix(in oklab, var(--sn-node-selected, #2e90fa) 25%, transparent);
}

.sn-date-calendar-icon {
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
}

.sn-date-dropdown {
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
  padding: var(--sn-space-sm);
  box-sizing: border-box;
  min-width: 260px;
}

.sn-date-dropdown[data-visible] {
  display: block;
}

.sn-date-native-input {
  display: none;
}

.sn-calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--sn-space-sm);
}

.sn-calendar-nav-btn {
  background: none;
  border: none;
  color: var(--sn-text);
  cursor: pointer;
  padding: var(--sn-space-xs);
  border-radius: 4px;
}

.sn-calendar-nav-btn:hover {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
}

.sn-calendar-title {
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  font-weight: 500;
  color: var(--sn-text);
}

.sn-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  text-align: center;
}

.sn-calendar-weekday {
  font-size: 11px;
  font-weight: 500;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  padding: var(--sn-space-xs) 0;
}

.sn-calendar-day {
  font-size: calc(12px * var(--sn-theme-type-scale, 1));
  padding: 6px 0;
  color: var(--sn-text);
  border-radius: 4px;
  cursor: pointer;
}

.sn-calendar-day:hover {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
}

.sn-calendar-day[data-selected] {
  background-color: var(--sn-node-selected, #2e90fa);
  color: #fff;
  font-weight: bold;
}

.sn-calendar-day[data-other-month] {
  opacity: 0.4;
}

sn-date-picker[disabled] .sn-date-trigger {
  cursor: not-allowed;
  opacity: 0.6;
}
`;
