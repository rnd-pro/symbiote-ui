export default `
:host,
chat-composer {
  --chat-composer-bg: var(--sn-composer-bg);
  --chat-composer-action-bg: var(--sn-composer-action-bg);
  display: block;
  padding: var(--sn-composer-padding);
  position: relative;
  z-index: 2;
}

.composer-body,
.voice-preview {
  display: flex;
  align-items: flex-end;
  gap: var(--sn-composer-control-gap);
  background: var(--chat-composer-bg);
  border-radius: var(--sn-composer-radius);
  padding: var(--sn-composer-body-padding);
  transition: background 0.15s;
}

.composer-body:focus-within,
.voice-preview:focus-within {
  background: var(--chat-composer-bg);
}

.composer-body textarea {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--sn-text);
  padding: 4px 0;
  outline: none;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.4;
  resize: none;
  min-height: var(--sn-composer-input-min-height);
  max-height: 200px;
  overflow-y: auto;
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
  --sn-button-focus-ring: 2px solid color-mix(in srgb, var(--sn-text-dim) 50%, transparent);
  background: var(--sn-button-bg);
  border: 0;
  color: var(--sn-button-color);
  box-shadow: var(--sn-shadow-sm);
  transition: background 0.15s, box-shadow 0.15s, transform 0.1s;
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
  border-radius: 2px;
  background: var(--sn-text);
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.composer-footer {
  container: composer-footer / inline-size;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 16px 0;
  min-height: 0;
  overflow: hidden;
}

.composer-footer:empty {
  display: none;
}

.composer-footer-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  padding: 3px 8px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--sn-text-dim);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
  min-width: 0;
  flex: 0 1 auto;
}

.composer-footer-btn:hover {
  background: var(--sn-node-hover);
  color: var(--sn-text);
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
  font-size: 11px;
  font-family: inherit;
  font-weight: 500;
  outline: none;
  cursor: pointer;
  appearance: auto;
  field-sizing: content;
  width: fit-content;
  padding: 0;
  min-width: 0;
  max-width: 160px;
  text-overflow: ellipsis;
}

.composer-footer-select option {
  background: var(--sn-node-bg);
  color: var(--sn-text);
}

.composer-param-model .composer-footer-select {
  max-width: 190px;
}

.composer-toggle-icon {
  font-size: var(--sn-composer-footer-toggle-icon-size) !important;
}

.composer-footer-label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.composer-param-collapsed .composer-footer-select,
.composer-param-collapsed .composer-footer-label {
  width: var(--sn-composer-collapsed-control-width);
  max-width: var(--sn-composer-collapsed-control-width);
  padding-right: var(--sn-composer-collapsed-control-padding);
  color: transparent !important;
}

@container composer-footer (width <= 560px) {
  .composer-priority-1 .composer-footer-select,
  .composer-priority-1 .composer-footer-label {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

@container composer-footer (width <= 500px) {
  .composer-priority-2 .composer-footer-select,
  .composer-priority-2 .composer-footer-label {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

@container composer-footer (width <= 440px) {
  .composer-priority-3 .composer-footer-select,
  .composer-priority-3 .composer-footer-label {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

@container composer-footer (width <= 380px) {
  .composer-priority-4 .composer-footer-select,
  .composer-priority-4 .composer-footer-label {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

@container composer-footer (width <= 320px) {
  .composer-priority-5 .composer-footer-select,
  .composer-priority-5 .composer-footer-label {
    width: var(--sn-composer-collapsed-control-width);
    max-width: var(--sn-composer-collapsed-control-width);
    padding-right: var(--sn-composer-collapsed-control-padding);
    color: transparent !important;
  }
}

.chat-context-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 8px 8px;
  min-height: 0;
}

.chat-context-bar:empty {
  display: none;
}

.context-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--sn-node-hover);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 11px;
  color: var(--sn-text-dim);
}

.context-path {
  max-width: 200px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.context-remove {
  --sn-button-icon-size: 16px;
  --sn-button-icon-font-size: 13px;
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
  left: 20px;
  right: 20px;
  max-height: 240px;
  overflow-y: auto;
  background: color-mix(in srgb, var(--sn-node-bg) 95%, transparent);
  border: 1px solid color-mix(in srgb, var(--sn-node-hover) 45%, transparent);
  border-radius: 16px;
  padding: 4px;
  margin-bottom: 6px;
  box-shadow: var(--sn-shadow-xl);
  z-index: 10;
  backdrop-filter: blur(8px);
}

.autocomplete-popup.visible {
  display: block;
}

.autocomplete-header {
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--sn-text-dim);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.autocomplete-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  color: var(--sn-text);
  opacity: 0.75;
  transition: background 0.1s, opacity 0.1s, color 0.1s;
}

.autocomplete-item:hover,
.autocomplete-item.active {
  background: var(--sn-node-hover);
  color: var(--sn-text);
  opacity: 1;
}

.autocomplete-item .material-symbols-outlined {
  font-size: 16px;
  color: var(--sn-text-dim);
}

.autocomplete-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.autocomplete-item-hint {
  font-size: 10px;
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
  transition: color 0.15s, background 0.15s;
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

.btn-wake-listen.has-command {
  width: auto;
  max-width: 164px;
  padding: 0 10px;
  gap: 6px;
  border-radius: 999px;
}

.wake-command-text {
  display: none;
  max-width: 118px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0;
}

.btn-wake-listen.has-command .wake-command-text {
  display: inline;
}

.btn-voice-language {
  width: auto;
  min-width: 86px;
  padding: 2px;
  gap: 2px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0;
  color: var(--sn-text-dim);
  background: var(--sn-node-bg);
}

.voice-language-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: calc(var(--sn-composer-send-size) - 4px);
  padding: 0 7px;
  border-radius: 999px;
  color: var(--sn-text-dim);
  line-height: 1;
}

.voice-language-option.active {
  color: var(--sn-text);
  background: var(--sn-node-hover);
}

.btn-voice-language[hidden] {
  display: none;
}

.btn-voice-command {
  width: auto;
  max-width: min(170px, 28vw);
  padding: 0 10px;
  gap: 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--sn-node-bg) 88%, var(--sn-text) 12%);
  color: var(--sn-text-dim);
}

.btn-voice-command.active {
  color: var(--sn-text);
  background: color-mix(in srgb, var(--sn-node-bg) 72%, var(--sn-text) 28%);
}

.voice-command-button-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0;
}

.btn-voice-command[hidden] {
  display: none;
}

.btn-voice-response[hidden] {
  display: none;
}

.btn-voice-response[disabled] {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn-voice-response.enabled,
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

.btn-mic.recording {
  color: var(--sn-danger-color);
  animation: mic-pulse 1.5s ease-in-out infinite;
}

.btn-mic.recording .material-symbols-outlined {
  font-variation-settings: 'FILL' 1;
}

.btn-mic.processing {
  color: var(--sn-text-dim);
  pointer-events: none;
}

.btn-mic.processing .material-symbols-outlined {
  animation: mic-spin 1s linear infinite;
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
  margin: 0 0 4px;
  animation: voice-preview-in 0.15s ease;
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
  font-size: 13px;
  line-height: 1.4;
  color: var(--sn-text);
  min-height: var(--sn-composer-input-min-height);
  padding: 4px 0;
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
  font-size: 12px;
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
  padding-inline: 4px;
  margin-inline: -4px;
}

.voice-preview-body[contenteditable="true"]:focus {
  background: var(--sn-bg);
}

.voice-command-hints {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.voice-command-hints[hidden] {
  display: none;
}

.voice-command-hint {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--sn-node-bg) 86%, var(--sn-text) 14%);
  color: var(--sn-text-dim);
  font-size: 11px;
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
  --sn-button-focus-ring: 2px solid color-mix(in srgb, var(--sn-text-dim) 50%, transparent);
  width: var(--sn-composer-send-size);
  height: var(--sn-composer-send-size);
  min-height: var(--sn-composer-send-size);
  padding: 0;
  border-radius: 50%;
  box-shadow: var(--sn-shadow-sm);
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.1s;
}

.voice-preview-btn:hover {
  box-shadow: var(--sn-shadow-md);
  transform: scale(1.05);
}

.voice-preview-btn[hidden] {
  display: none;
}

.voice-preview-btn .material-symbols-outlined {
  font-size: 16px;
}

`;
