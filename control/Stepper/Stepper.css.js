export default /*css*/ `
sn-stepper {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: 100%;
  gap: var(--sn-stepper-gap, 8px);
  font-family: var(--sn-font, sans-serif);
  font-size: var(--sn-stepper-font-size, 12px);
}

sn-stepper[hidden] {
  display: none !important;
}

.sn-stepper-step {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  flex: 1;
}

.sn-stepper-step:last-child {
  flex: 0 0 auto;
}

.sn-stepper-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--sn-stepper-indicator-size, 24px);
  height: var(--sn-stepper-indicator-size, 24px);
  border-radius: 50%;
  background: var(--sn-stepper-indicator-bg, var(--sn-bg, #121214));
  border: 2px solid var(--sn-stepper-indicator-border, var(--sn-outline-color, rgba(255, 255, 255, 0.12)));
  color: var(--sn-stepper-indicator-color, var(--sn-text-dim, rgba(255, 255, 255, 0.7)));
  font-size: 11px;
  font-weight: 600;
  transition: all var(--sn-transition-normal, 240ms);
}

.sn-stepper-label {
  color: var(--sn-stepper-label-color, var(--sn-text-dim, rgba(255, 255, 255, 0.7)));
  white-space: nowrap;
}

.sn-stepper-line {
  flex: 1;
  height: 2px;
  background: var(--sn-stepper-line-bg, var(--sn-outline-color-soft, rgba(255, 255, 255, 0.08)));
  margin: 0 8px;
  transition: background var(--sn-transition-normal, 240ms);
}

/* Completed state */
.sn-stepper-step[data-state="completed"] .sn-stepper-indicator {
  background: var(--sn-stepper-completed-bg, var(--sn-success-color, #4caf50));
  border-color: var(--sn-stepper-completed-border, var(--sn-success-color, #4caf50));
  color: var(--sn-stepper-completed-color, #ffffff);
}

.sn-stepper-step[data-state="completed"] .sn-stepper-line {
  background: var(--sn-stepper-completed-line, var(--sn-success-color, #4caf50));
}

.sn-stepper-step[data-state="completed"] .sn-stepper-label {
  color: var(--sn-stepper-completed-label-color, var(--sn-text, #ffffff));
}

/* Active state */
.sn-stepper-step[data-state="active"] .sn-stepper-indicator {
  background: var(--sn-stepper-active-bg, var(--sn-node-selected, #2196f3));
  border-color: var(--sn-stepper-active-border, var(--sn-node-selected, #2196f3));
  color: var(--sn-stepper-active-color, #ffffff);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--sn-node-selected, #2196f3) 25%, transparent);
}

.sn-stepper-step[data-state="active"] .sn-stepper-label {
  color: var(--sn-stepper-active-label-color, var(--sn-text, #ffffff));
  font-weight: 600;
}

.sn-stepper-indicator .material-symbols-outlined {
  font-size: 14px;
}
`;
