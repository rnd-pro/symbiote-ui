export default `
:host,
chat-composer {
  --chat-composer-bg: var(--sn-composer-bg);
  --chat-composer-action-bg: var(--sn-composer-action-bg);
  container: chat-composer / inline-size;
  display: block;
  padding: var(--sn-composer-padding);
  position: relative;
  z-index: 2;
}

.composer-body {
  container: composer-body / inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  grid-template-rows: auto;
  align-items: stretch;
  align-content: end;
  gap: var(--sn-composer-control-gap);
  background: var(--chat-composer-bg);
  border-radius: var(--sn-composer-radius);
  padding: var(--sn-composer-body-padding);
  transition: background var(--sn-transition-fast) var(--sn-transition-easing);
}

.voice-preview {
  container: composer-body / inline-size;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--sn-composer-control-gap);
  background: var(--chat-composer-bg);
  border-radius: var(--sn-composer-radius);
  padding: var(--sn-composer-body-padding);
  transition: background var(--sn-transition-fast) var(--sn-transition-easing);
}

.composer-body:focus-within,
.voice-preview:focus-within {
  background: var(--chat-composer-bg);
}

.composer-body textarea {
  grid-column: 1;
  grid-row: 1;
  align-self: end;
  min-width: 0;
  min-inline-size: min(100%, var(--sn-composer-input-min-inline-size, 160px));
  width: 100%;
  background: transparent;
  border: none;
  color: var(--sn-text);
  padding: var(--sn-composer-input-padding, 4px 0);
  outline: none;
  font-family: inherit;
  font-size: var(--sn-composer-input-size, 13px);
  line-height: 1.4;
  resize: none;
  min-height: var(--sn-composer-input-min-height);
  max-height: 200px;
  overflow-y: auto;
}

.composer-leading-controls {
  grid-column: 1;
  grid-row: 1;
  align-self: end;
  display: none;
  min-inline-size: 0;
}

:host([leading-controls]) .composer-body,
chat-composer[leading-controls] .composer-body {
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  padding-inline-start: var(--sn-composer-body-leading-padding-inline-start, 8px);
}

:host([leading-controls]) .composer-leading-controls,
chat-composer[leading-controls] .composer-leading-controls {
  display: flex;
  align-items: center;
  justify-content: center;
}

:host([leading-controls]) .composer-body textarea,
chat-composer[leading-controls] .composer-body textarea {
  grid-column: 2;
}

:host([leading-controls]) .composer-actions,
chat-composer[leading-controls] .composer-actions {
  grid-column: 3;
}

:host([leading-controls]) .btn-mic,
chat-composer[leading-controls] .btn-mic {
  grid-column: 4;
}

:host([leading-controls]) .composer-body > sn-button.btn-send,
chat-composer[leading-controls] .composer-body > sn-button.btn-send {
  grid-column: 5;
}

.composer-actions {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  align-self: end;
  justify-self: flex-end;
  gap: var(--sn-composer-control-gap);
  max-width: min(54cqi, var(--sn-composer-actions-max-inline-size, 460px));
  min-width: 0;
  overflow: hidden;
}

.btn-mic {
  grid-column: 3;
  grid-row: 1;
  align-self: end;
}

.composer-body > sn-button.btn-send {
  grid-column: 4;
  grid-row: 1;
  align-self: end;
  justify-self: end;
}

.composer-body textarea::placeholder {
  color: var(--sn-text-dim);
}

sn-button.btn-send[variant="icon"] {
  --sn-button-icon-size: var(--sn-composer-send-size);
  --sn-button-icon-font-size: var(--sn-composer-send-icon-size);
  --sn-button-radius: 50%;
  --sn-button-bg: var(--sn-text);
  --sn-button-hover-bg: var(--sn-composer-send-hover-bg);
  --sn-button-color: var(--chat-composer-bg);
  --sn-button-disabled-opacity: 0.3;
  --sn-button-focus-ring: 2px solid color-mix(in oklab, var(--sn-text-dim) 50%, transparent);
  background: var(--sn-button-bg);
  border: 0;
  color: var(--sn-button-color);
  flex: 0 0 var(--sn-composer-send-size);
  width: var(--sn-composer-send-size);
  height: var(--sn-composer-send-size);
  min-width: var(--sn-composer-send-size);
  min-height: var(--sn-composer-send-size);
  box-shadow: var(--sn-shadow-sm);
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), box-shadow var(--sn-transition-fast) var(--sn-transition-easing), transform var(--sn-transition-fast) var(--sn-transition-easing);
}

sn-button.btn-send[variant="icon"] .material-symbols-outlined {
  font-size: var(--sn-composer-send-icon-size);
}

sn-button.btn-send[variant="icon"]:hover {
  background: var(--sn-button-hover-bg);
  color: var(--sn-button-color);
  box-shadow: var(--sn-shadow-md);
  transform: scale(1.05);
}

sn-button.btn-send[variant="icon"]:focus-visible {
  outline-offset: 2px;
}

sn-button.btn-send[variant="icon"][disabled] {
  transform: none;
}

sn-button.btn-send[variant="icon"].btn-stop {
  --sn-button-bg: var(--sn-danger-color);
  --sn-button-hover-bg: var(--sn-danger-color);
  color: var(--sn-text);
  position: relative;
}

sn-button.btn-send[variant="icon"].btn-stop:hover {
  color: var(--sn-text);
}

sn-button.btn-send[variant="icon"].btn-stop .material-symbols-outlined {
  opacity: 0;
}

sn-button.btn-send[variant="icon"].btn-stop::after {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: var(--sn-radius-xs);
  background: var(--sn-text);
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.composer-footer {
  container: composer-footer / inline-size;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--sn-composer-footer-gap, 4px);
  padding: var(--sn-composer-footer-padding, 6px 16px 0);
  min-height: 0;
  overflow: visible;
}

.composer-footer:empty {
  display: none;
}

.composer-leading-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--sn-composer-footer-gap, 4px);
  inline-size: var(--sn-composer-send-size);
  block-size: var(--sn-composer-send-size);
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--sn-text-dim);
  font-family: inherit;
  cursor: pointer;
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing), transform var(--sn-transition-fast) var(--sn-transition-easing);
}

.composer-leading-btn:hover,
.composer-leading-btn.active {
  background: var(--sn-node-hover);
  color: var(--sn-text);
}

.composer-leading-btn:focus-visible {
  outline: var(--sn-effect-focus-ring);
  outline-offset: 2px;
}

.composer-leading-btn[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.composer-leading-btn .material-symbols-outlined {
  font-size: var(--sn-composer-send-icon-size);
}

.composer-leading-label {
  overflow: hidden;
  max-inline-size: var(--sn-composer-leading-label-max, 120px);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.composer-footer-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--sn-composer-footer-gap, 4px);
  min-height: var(--sn-composer-footer-btn-min-height, 24px);
  padding: var(--sn-composer-footer-btn-padding, 3px 8px);
  border-radius: var(--sn-radius-lg);
  border: none;
  background: transparent;
  color: var(--sn-text-dim);
  font-size: var(--sn-composer-footer-size, 11px);
  font-family: inherit;
  cursor: pointer;
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing);
  white-space: nowrap;
  min-width: 0;
  max-width: 100%;
  flex: 0 1 auto;
}

.composer-footer-btn:hover {
  background: var(--sn-node-hover);
  color: var(--sn-text);
}

.composer-footer-btn.active {
  color: var(--sn-text);
  background: color-mix(in oklab, var(--sn-node-bg) 78%, var(--sn-text) 22%);
}

.composer-footer-btn .material-symbols-outlined {
  font-size: var(--sn-composer-footer-icon-size);
  opacity: 0.75;
  flex: 0 0 auto;
}

.composer-footer-btn:hover .material-symbols-outlined {
  opacity: 1;
}

.composer-footer-select {
  background: transparent;
  border: none;
  color: var(--sn-text-dim);
  font-size: var(--sn-composer-footer-size, 11px);
  font-family: inherit;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  appearance: auto;
  field-sizing: content;
  width: fit-content;
  padding: 0;
  min-width: 0;
  max-width: min(160px, 100%);
  text-overflow: ellipsis;
}

.composer-footer-select-control {
  padding-right: var(--sn-step-2);
}

.composer-footer-checkbox-control {
  user-select: none;
}

.composer-footer-checkbox {
  accent-color: var(--sn-node-selected);
  inline-size: var(--sn-composer-footer-icon-size, 16px);
  block-size: var(--sn-composer-footer-icon-size, 16px);
  margin: 0;
}

.composer-footer-select option {
  background: var(--sn-node-bg);
  color: var(--sn-text);
}

.composer-param-model .composer-footer-select {
  max-width: min(190px, 100%);
}

.composer-toggle-icon {
  font-size: var(--sn-composer-footer-toggle-icon-size) !important;
}

.composer-footer-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-footer-value {
  overflow: hidden;
  max-width: var(--sn-composer-footer-value-max, 92px);
  color: var(--sn-text);
  font-weight: 650;
  text-overflow: ellipsis;
}

.composer-param-collapsed .composer-footer-select,
.composer-param-collapsed .composer-footer-label,
.composer-param-collapsed .composer-footer-value {
  width: var(--sn-composer-collapsed-control-width);
  max-width: var(--sn-composer-collapsed-control-width);
  padding-right: var(--sn-composer-collapsed-control-padding);
  color: transparent !important;
}

@container composer-footer (width <= 560px) {
  .composer-priority-1 .composer-footer-select,
  .composer-priority-1 .composer-footer-label,
  .composer-priority-1 .composer-footer-value {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

@container composer-footer (width <= 500px) {
  .composer-priority-2 .composer-footer-select,
  .composer-priority-2 .composer-footer-label,
  .composer-priority-2 .composer-footer-value {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

@container composer-footer (width <= 440px) {
  .composer-priority-3 .composer-footer-select,
  .composer-priority-3 .composer-footer-label,
  .composer-priority-3 .composer-footer-value {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

@container composer-footer (width <= 380px) {
  .composer-priority-4 .composer-footer-select,
  .composer-priority-4 .composer-footer-label,
  .composer-priority-4 .composer-footer-value {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

@container composer-footer (width <= 320px) {
  .composer-priority-5 .composer-footer-select,
  .composer-priority-5 .composer-footer-label,
  .composer-priority-5 .composer-footer-value {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

.chat-context-bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sn-composer-chip-gap, 6px);
  padding: 0 var(--sn-composer-control-gap, 8px) var(--sn-composer-control-gap, 8px);
  min-height: 0;
  min-width: 0;
  max-width: 100%;
}

.chat-context-bar:empty {
  display: none;
}

.context-chip {
  display: flex;
  align-items: center;
  gap: var(--sn-composer-chip-gap, 4px);
  min-width: 0;
  max-width: 100%;
  background: var(--sn-node-hover);
  border-radius: var(--sn-radius-md);
  padding: var(--sn-composer-chip-padding, 3px 8px);
  font-size: var(--sn-composer-chip-size, 11px);
  color: var(--sn-text-dim);
}

.context-path {
  min-width: 0;
  max-width: min(200px, 100%);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-remove {
  --sn-button-icon-size: calc(var(--sn-composer-send-size) * 0.5);
  --sn-button-icon-font-size: var(--sn-composer-input-size, 13px);
  --sn-button-border: transparent;
  --sn-button-radius: 4px;
  --sn-button-bg: transparent;
  --sn-button-hover-bg: transparent;
  --sn-button-hover-border: transparent;
  --sn-button-color: var(--sn-text-dim);
  --sn-button-focus-ring: var(--sn-effect-focus-ring);
  color: var(--sn-text-dim);
  line-height: 1;
}

.context-remove:hover {
  color: var(--sn-danger-color);
}

:host(.drag-over) .composer-body,
chat-composer.drag-over .composer-body {
  background: var(--chat-composer-action-bg);
  outline: 1px dashed var(--sn-node-border);
  outline-offset: -1px;
}

.autocomplete-popup {
  display: none;
  position: absolute;
  bottom: 100%;
  left: var(--sn-composer-popup-inset, 20px);
  right: var(--sn-composer-popup-inset, 20px);
  max-height: 240px;
  overflow-y: auto;
  background: color-mix(in oklab, var(--sn-node-bg) 95%, transparent);
  border: 1px solid color-mix(in oklab, var(--sn-node-hover) 45%, transparent);
  border-radius: 16px;
  padding: var(--sn-composer-autocomplete-padding, 4px);
  margin-bottom: var(--sn-composer-footer-gap, 6px);
  box-shadow: var(--sn-shadow-xl);
  z-index: 10;
  backdrop-filter: blur(8px);
}

.autocomplete-popup.visible {
  display: block;
}

.autocomplete-header {
  padding: var(--sn-composer-autocomplete-item-padding, 6px 10px);
  font-size: var(--sn-composer-popup-header-size, 10px);
  font-weight: 600;
  color: var(--sn-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.autocomplete-item {
  display: flex;
  align-items: center;
  gap: var(--sn-composer-control-gap, 8px);
  padding: var(--sn-composer-autocomplete-item-padding, 6px 10px);
  border-radius: var(--sn-radius-lg);
  cursor: pointer;
  font-size: var(--sn-composer-popup-item-size, 12px);
  color: var(--sn-text);
  opacity: 0.75;
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), opacity var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing);
}

.autocomplete-item:hover,
.autocomplete-item.active {
  background: var(--sn-node-hover);
  color: var(--sn-text);
  opacity: 1;
}

.autocomplete-item .material-symbols-outlined {
  font-size: var(--sn-composer-send-icon-size, 16px);
  color: var(--sn-text-dim);
}

.autocomplete-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.autocomplete-item-hint {
  font-size: var(--sn-composer-popup-hint-size, 10px);
  color: var(--sn-text-dim);
}

/* ── Voice Input — Mic Button ── */

.btn-mic,
.btn-wake-listen,
.btn-voice-response,
.btn-voice-command,
.btn-voice-language {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--sn-composer-send-size);
  height: var(--sn-composer-send-size);
  border-radius: 50%;
  border: none;
  background: transparent;
  color: var(--sn-text-dim);
  cursor: pointer;
  transition: color var(--sn-transition-fast) var(--sn-transition-easing), background var(--sn-transition-fast) var(--sn-transition-easing);
  flex: 0 0 auto;
}

.btn-mic:hover,
.btn-wake-listen:hover,
.btn-voice-response:hover,
.btn-voice-command:hover,
.btn-voice-language:hover {
  color: var(--sn-text);
  background: var(--sn-node-hover);
}

.btn-mic .material-symbols-outlined,
.btn-wake-listen .material-symbols-outlined,
.btn-voice-response .material-symbols-outlined,
.btn-voice-command .material-symbols-outlined {
  font-size: var(--sn-composer-send-icon-size);
}

.btn-mic[hidden],
.btn-wake-listen[hidden],
.btn-voice-response[hidden],
.btn-voice-command[hidden],
.btn-voice-language[hidden] {
  display: none;
}

.btn-mic {
  order: 60;
}

.btn-wake-listen {
  order: 20;
}

.btn-voice-response {
  order: 30;
}

.btn-voice-command {
  order: 40;
}

.btn-voice-language {
  order: 50;
}

.btn-wake-listen.has-command {
  width: auto;
  max-width: min(var(--sn-composer-wake-command-max, 164px), 36cqi);
  padding: 0 var(--sn-composer-control-gap, 10px);
  gap: var(--sn-composer-footer-gap, 6px);
  border-radius: var(--sn-radius-full);
}

.wake-command-text {
  display: none;
  max-width: var(--sn-composer-voice-label-max, 118px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--sn-composer-voice-label-size, 11px);
  font-weight: 650;
  letter-spacing: 0;
}

.btn-wake-listen.has-command .wake-command-text {
  display: inline;
}

.btn-voice-language {
  width: auto;
  min-width: calc(var(--sn-composer-send-size) * 2.7);
  max-width: min(var(--sn-composer-voice-command-max, 170px), 38cqi);
  overflow: hidden;
  padding: calc(var(--sn-composer-send-size) * 0.0625);
  gap: calc(var(--sn-composer-send-size) * 0.0625);
  border-radius: var(--sn-radius-full);
  font-size: var(--sn-composer-voice-label-size, 11px);
  font-weight: 650;
  letter-spacing: 0;
  color: var(--sn-text-dim);
  background: var(--sn-node-bg);
}

.voice-language-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: calc(var(--sn-composer-send-size) * 0.75);
  height: calc(var(--sn-composer-send-size) - var(--sn-composer-footer-gap, 4px));
  padding: 0 calc(var(--sn-composer-control-gap, 8px) * 0.875);
  border-radius: var(--sn-radius-full);
  color: var(--sn-text-dim);
  line-height: 1;
}

.voice-language-option.active {
  color: var(--sn-text);
  background: var(--sn-node-hover);
}

.btn-voice-command {
  width: auto;
  max-width: min(var(--sn-composer-voice-command-max, 170px), 36cqi);
  padding: 0 var(--sn-composer-control-gap, 10px);
  gap: var(--sn-composer-footer-gap, 6px);
  border-radius: var(--sn-radius-full);
  background: color-mix(in oklab, var(--sn-node-bg) 88%, var(--sn-text) 12%);
  color: var(--sn-text-dim);
}

.btn-voice-command.active {
  color: var(--sn-text);
  background: color-mix(in oklab, var(--sn-node-bg) 72%, var(--sn-text) 28%);
}

.voice-command-button-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--sn-composer-voice-label-size, 11px);
  font-weight: 650;
  letter-spacing: 0;
}

.btn-mic[disabled],
.btn-wake-listen[disabled],
.btn-voice-response[disabled],
.btn-voice-command[disabled],
.btn-voice-language[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-voice-response.active,
.btn-voice-response.speaking {
  color: var(--sn-node-selected);
  background: var(--sn-node-hover);
}

.btn-wake-listen.listening {
  color: var(--sn-node-selected);
  background: var(--sn-node-hover);
}

.btn-wake-listen.listening .material-symbols-outlined {
  font-variation-settings: 'FILL' 1;
}

@container composer-body (width <= 960px) {
  .btn-voice-command {
    width: var(--sn-composer-send-size);
    max-width: var(--sn-composer-send-size);
    padding: 0;
    border-radius: 50%;
  }

  .btn-voice-command .voice-command-button-text {
    display: none;
  }

}

@container composer-body (width <= 560px) {
  .btn-wake-listen.has-command {
    width: var(--sn-composer-send-size);
    max-width: var(--sn-composer-send-size);
    padding: 0;
    border-radius: 50%;
  }

  .btn-wake-listen.has-command .wake-command-text {
    display: none;
  }
}

@container chat-composer (width <= 480px) {
  .composer-body {
    grid-template-columns: minmax(0, 1fr) auto auto;
    grid-template-rows: auto auto;
  }

  :host([leading-controls]) .composer-body,
  chat-composer[leading-controls] .composer-body {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
  }

  :host([leading-controls]) .composer-leading-controls,
  chat-composer[leading-controls] .composer-leading-controls {
    grid-column: 1;
    grid-row: 1;
  }

  :host([leading-controls]) .composer-body textarea,
  chat-composer[leading-controls] .composer-body textarea {
    grid-column: 2;
  }

  .composer-actions {
    grid-column: 1 / -1;
    grid-row: 2;
    width: 100%;
    max-width: 100%;
    flex-wrap: wrap;
    overflow: visible;
  }

  .btn-mic {
    grid-column: 2;
    grid-row: 1;
    align-self: end;
  }

  .composer-body > sn-button.btn-send {
    grid-column: 3;
    grid-row: 1;
  }

  :host([leading-controls]) .btn-mic,
  chat-composer[leading-controls] .btn-mic {
    grid-column: 3;
  }

  :host([leading-controls]) .composer-body > sn-button.btn-send,
  chat-composer[leading-controls] .composer-body > sn-button.btn-send {
    grid-column: 4;
  }

  .btn-voice-language {
    min-width: calc(var(--sn-composer-send-size) * 2.2);
    max-width: calc(var(--sn-composer-send-size) * 2.6);
  }

  .voice-language-option {
    min-width: calc(var(--sn-composer-send-size) * 0.62);
    padding-inline: calc(var(--sn-composer-control-gap, 8px) * 0.5);
  }
}

@container composer-body (width <= 340px) {
  .composer-actions {
    justify-self: stretch;
    align-self: end;
    justify-content: flex-end;
  }

  .btn-voice-language {
    width: var(--sn-composer-send-size);
    min-width: var(--sn-composer-send-size);
    max-width: var(--sn-composer-send-size);
    border-radius: 50%;
    padding: 0;
  }

  .btn-voice-language .voice-language-option:not(.active) {
    display: none;
  }
}

.btn-mic.recording {
  color: var(--sn-danger-color);
  animation: mic-pulse var(--sn-animation-duration-slow) var(--sn-transition-easing) infinite;
  animation-play-state: var(--sn-animation-play-state);
}

.btn-mic.recording .material-symbols-outlined {
  font-variation-settings: 'FILL' 1;
}

.btn-mic.processing {
  color: var(--sn-text-dim);
  pointer-events: none;
}

.btn-mic.processing .material-symbols-outlined {
  animation: mic-spin var(--sn-animation-duration-normal) linear infinite;
  animation-play-state: var(--sn-animation-play-state);
}

@keyframes mic-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes mic-spin {
  100% { transform: rotate(360deg); }
}

/* ── Voice Input — Preview Banner ── */

.voice-preview {
  margin: 0 0 var(--sn-composer-footer-gap, 4px);
  animation: voice-preview-in var(--sn-transition-fast) var(--sn-transition-easing);
  animation-play-state: var(--sn-animation-play-state);
}

.voice-preview[hidden] {
  display: none;
}

@keyframes voice-preview-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.voice-preview.recording {
  background: var(--chat-composer-bg);
}

.voice-preview.processing {
  background: var(--chat-composer-bg);
}

.voice-preview.result {
  background: var(--chat-composer-bg);
}

.voice-preview-body {
  font-size: var(--sn-composer-voice-preview-size, 13px);
  line-height: 1.4;
  color: var(--sn-text);
  min-height: var(--sn-composer-input-min-height);
  padding: var(--sn-composer-input-padding, 4px 0);
  outline: none;
  word-break: break-word;
}

.voice-preview-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.voice-preview-status {
  color: var(--sn-text-dim);
  font-size: var(--sn-composer-voice-status-size, 12px);
  line-height: 1.4;
  font-family: var(--sn-font-mono);
}

.voice-preview.recording .voice-preview-status.voice-preview-elapsed {
  color: var(--sn-danger-color);
}

.voice-preview-status[hidden],
.voice-preview-body[hidden] {
  display: none;
}

.voice-preview-body[contenteditable="true"] {
  cursor: text;
  border-radius: calc(6px * var(--sn-theme-radius-scale));
  padding-inline: var(--sn-step-2);
  margin-inline: -4px;
}

.voice-preview-body[contenteditable="true"]:focus {
  background: var(--sn-bg);
}

.voice-command-hints {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sn-composer-footer-gap, 4px);
  margin-top: var(--sn-composer-footer-gap, 6px);
}

.voice-command-hints[hidden] {
  display: none;
}

.voice-command-hint {
  display: inline-flex;
  align-items: center;
  min-height: var(--sn-composer-input-min-height, 20px);
  padding: var(--sn-composer-footer-btn-padding, 2px 7px);
  border-radius: var(--sn-radius-full);
  background: color-mix(in oklab, var(--sn-node-bg) 86%, var(--sn-text) 14%);
  color: var(--sn-text-dim);
  font-size: var(--sn-composer-voice-label-size, 11px);
  font-weight: 600;
  line-height: 1.2;
}

.voice-preview-actions {
  display: flex;
  align-items: center;
  gap: var(--sn-composer-control-gap);
  flex: 0 0 auto;
}

.voice-preview-btn {
  --sn-button-icon-size: var(--sn-composer-send-size);
  --sn-button-icon-font-size: var(--sn-composer-send-icon-size);
  --sn-button-radius: 50%;
  --sn-button-focus-ring: 2px solid color-mix(in oklab, var(--sn-text-dim) 50%, transparent);
  width: var(--sn-composer-send-size);
  height: var(--sn-composer-send-size);
  min-height: var(--sn-composer-send-size);
  padding: 0;
  border-radius: 50%;
  box-shadow: var(--sn-shadow-sm);
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), border-color var(--sn-transition-fast) var(--sn-transition-easing), box-shadow var(--sn-transition-fast) var(--sn-transition-easing), transform var(--sn-transition-fast) var(--sn-transition-easing);
}

.voice-preview-btn:hover {
  box-shadow: var(--sn-shadow-md);
  transform: scale(1.05);
}

.voice-preview-btn[hidden] {
  display: none;
}

.voice-preview-btn .material-symbols-outlined {
  font-size: var(--sn-composer-send-icon-size, 16px);
}

`;
