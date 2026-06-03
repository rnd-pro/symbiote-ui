export default `
:host,
chat-message-item {
  display: contents;
}

.message {
  max-width: 100%;
  display: flex;
}

.message.board {
  width: 100%;
}

.message.tool {
  align-self: flex-start;
  max-width: 100%;
  width: 100%;
}

.message.thinking {
  max-width: 100%;
}

.message.agent {
  flex-direction: column;
}

.message.system {
  align-self: center;
  font-size: 11px;
  max-width: 90%;
  color: var(--sn-text-dim);
}

.message.system .msg-content {
  background: transparent;
  text-align: center;
  font-style: italic;
  padding: 4px;
}

.msg-content {
  padding: 12px 16px;
  border-radius: 16px;
  width: 100%;
  line-height: 1.5;
  word-break: break-word;
}

.message.user .msg-content {
  background: var(--sn-chat-user-message-bg, var(--sn-composer-bg, var(--sn-chat-message-bg, var(--sn-node-bg))));
  color: var(--sn-text);
}

.message.agent .msg-content {
  background: var(--sn-chat-agent-message-bg, var(--sn-node-bg));
  color: var(--sn-text);
}

.tool-card {
  border-radius: 12px;
  background: var(--sn-node-hover);
  overflow: hidden;
  transition: background 0.15s ease;
}

.tool-card[open] {
  background: var(--sn-node-hover);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--sn-text-dim);
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.tool-header::-webkit-details-marker {
  display: none;
}

.tool-header::before {
  content: '>';
  font-size: 10px;
  transition: transform 0.15s ease;
  color: var(--sn-text-dim);
}

.tool-card[open] .tool-header::before {
  transform: rotate(90deg);
}

.tool-header .material-symbols-outlined {
  color: var(--sn-text-dim);
}

.tool-icon {
  font-size: var(--sn-chat-tool-icon-size);
}

.tool-name {
  flex: 0 0 auto;
}

.tool-summary {
  min-width: 0;
  max-width: min(56ch, 60vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--sn-text);
  opacity: 0.72;
  font-weight: 500;
}

.tool-summary::before {
  content: '-';
  margin-inline-end: 6px;
  color: var(--sn-text-dim);
}

.tool-card[open] .tool-header {
  border-bottom: none;
  color: var(--sn-text);
}

.tool-section {
  padding: 8px 12px;
}

.tool-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--sn-text-dim);
  margin-bottom: 4px;
}

.tool-code {
  background: var(--sn-bg);
  border-radius: 6px;
  padding: 8px;
  font-family: var(--sn-font-mono);
  font-size: 11px;
  color: var(--sn-text-dim);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.tool-waiting {
  color: var(--sn-text-dim);
  font-style: italic;
  font-size: 11px;
}

.spin-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  100% { transform: rotate(360deg); }
}

.streaming-cursor {
  display: inline-block;
  width: 6px;
  height: 14px;
  background-color: var(--sn-text-dim);
  vertical-align: middle;
  margin-left: 4px;
  animation: blink 1s step-end infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

.md-code-block {
  background: var(--sn-bg);
  border-radius: 8px;
  padding: 12px;
  overflow-x: auto;
  margin: 6px 0;
  font-family: var(--sn-font-mono);
  font-size: 12px;
  white-space: pre;
}

.md-inline-code {
  background: var(--sn-node-hover);
  padding: 2px 5px;
  border-radius: 4px;
  font-family: var(--sn-font-mono);
  font-size: 11px;
  color: var(--sn-text);
}

.markdown-mention {
  color: var(--sn-node-selected);
  background: var(--sn-accent-bg);
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 500;
  word-break: break-all;
}

.md-link {
  color: var(--sn-text-dim);
  text-decoration: underline;
  text-decoration-color: var(--sn-node-border);
}

.md-link:hover {
  color: var(--sn-text);
}

.md-h {
  margin: 16px 0 8px;
  color: var(--sn-text);
  font-weight: 700;
}

h1.md-h {
  font-size: 20px;
  border-bottom: 1px solid var(--sn-node-border);
  padding-bottom: 6px;
}

h2.md-h {
  font-size: 18px;
  border-bottom: 1px solid var(--sn-node-border);
  padding-bottom: 4px;
}

h3.md-h {
  font-size: 16px;
}

h4.md-h {
  font-size: 14px;
}

.md-p {
  margin: 0;
}

.md-quote {
  margin: 8px 0;
  padding: 8px 16px;
  border-left: 4px solid var(--sn-node-selected);
  background: var(--sn-accent-bg-subtle);
  border-radius: 0 4px 4px 0;
  font-style: italic;
  color: var(--sn-text-dim);
}

.md-list {
  margin: 8px 0;
  padding-left: 24px;
}

.md-list li {
  margin: 3px 0;
}

.md-img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  margin: 8px 0;
  border: 1px solid var(--sn-node-border);
}

.md-hr {
  border: none;
  border-top: 1px solid var(--sn-node-border);
  margin: 16px 0;
}

.md-table {
  width: 100%;
  border-collapse: collapse;
  margin: 12px 0;
  font-size: 12px;
}

.md-table th,
.md-table td {
  padding: 6px 12px;
  border: 1px solid var(--sn-node-border);
  text-align: left;
}

.md-table th {
  background: var(--sn-node-hover);
  font-weight: 600;
}

.md-table tr:hover td {
  background: var(--sn-node-hover);
}

.t-kw,
.t-lit {
  color: var(--sn-syntax-keyword);
}

.t-str,
.t-num {
  color: var(--sn-syntax-string);
}

.t-cm {
  color: var(--sn-syntax-comment);
  font-style: italic;
}

.t-fn,
.t-bi {
  color: var(--sn-syntax-function);
}

.t-prop {
  color: var(--sn-syntax-property);
}

.work-summary-wrap {
  display: inline-flex;
  align-items: flex-start;
  align-self: flex-start;
  max-width: 100%;
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.message.agent:hover .work-summary-wrap,
.message.agent:focus-within .work-summary-wrap,
.work-summary-wrap:focus-within {
  opacity: 1;
  transform: translateY(0);
}

.thinking-block,
.work-summary {
  font-size: 12px;
  color: var(--sn-text-dim);
}

.thinking-block summary,
.work-summary summary {
  cursor: pointer;
  user-select: none;
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  font-weight: 500;
}

.thinking-block summary::-webkit-details-marker,
.work-summary summary::-webkit-details-marker {
  display: none;
}

.thinking-block summary .material-symbols-outlined {
  animation: thinking-pulse 1.2s ease-in-out infinite;
}

.thinking-icon {
  font-size: var(--sn-chat-summary-icon-size);
}

@keyframes thinking-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

.work-summary summary > .work-summary-icon {
  color: var(--sn-success-color);
}

.work-summary-icon {
  font-size: var(--sn-chat-summary-icon-size);
  color: var(--sn-success-color);
}

.work-copy-btn {
  flex: 0 0 24px;
  margin-top: 1px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--sn-text-dim);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.75;
  transition: background 0.12s ease, color 0.12s ease, opacity 0.12s ease;
}

.work-copy-btn:hover {
  background: var(--sn-node-hover);
  color: var(--sn-text);
  opacity: 1;
}

.work-copy-btn .material-symbols-outlined {
  font-size: 15px;
}

.work-copy-btn.copied {
  color: var(--sn-text);
}

.work-copy-btn.copied .material-symbols-outlined {
  color: var(--sn-text);
}

.work-copy-btn.copy-error {
  color: var(--sn-danger-color);
}

.work-body {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 0 2px 24px;
}

.chat-session-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.chat-session-meta:empty {
  display: none;
}

.meta-chip {
  font-size: 10px;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
  background: var(--sn-node-hover);
  color: var(--sn-text-dim);
  white-space: nowrap;
  font-family: var(--sn-font-mono, monospace);
  letter-spacing: 0.2px;
}

.meta-chip-icon {
  font-size: var(--sn-chat-meta-icon-size);
}

.meta-chip.meta-ok {
  color: var(--sn-success-color);
  background: var(--sn-status-ok-bg);
}

.meta-chip.meta-err {
  color: var(--sn-danger-color);
  background: var(--sn-status-error-bg);
}

.meta-chip.meta-sid {
  cursor: default;
  max-width: 110px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.thinking-status {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--sn-text-dim);
  font-style: italic;
}

.status-board {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 4px 0;
  width: 100%;
}

.status-card {
  flex: 1 1 220px;
  max-width: 320px;
  background: var(--sn-node-hover);
  border: 1px solid var(--sn-node-hover);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
  position: relative;
  overflow: hidden;
}

.status-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--card-accent, var(--sn-node-hover));
  transition: background 0.3s ease;
}

.status-card[data-status="running"] {
  border-color: var(--sn-accent-border);
  --card-accent: var(--sn-cat-server);
}

.status-card[data-status="running"]::before {
  animation: card-progress 1.8s ease-in-out infinite;
}

@keyframes card-progress {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

.status-card[data-status="done"] {
  border-color: var(--sn-success-border);
  --card-accent: var(--sn-success-color);
}

.status-card[data-status="error"] {
  border-color: var(--sn-danger-border);
  --card-accent: var(--sn-danger-color);
}

.status-card-linked {
  cursor: pointer;
}

.status-card-linked:hover {
  border-color: var(--sn-node-border);
  box-shadow: var(--sn-accent-glow);
}

.status-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--sn-text);
}

.status-card-header .material-symbols-outlined {
  font-size: 16px;
}

.status-card-header .spin-icon {
  animation: spin 1.2s linear infinite;
}

.status-card-status {
  font-size: 11px;
  color: var(--sn-text-dim);
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-card-events {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.status-card-event {
  display: inline-block;
  background: var(--sn-node-bg);
  color: var(--sn-text-dim);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  white-space: nowrap;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid var(--border-color, var(--sn-node-border));
}

.status-card-event[data-type="tool_use"],
.status-card-event[data-type="tool_result"] {
  color: var(--sn-text);
  border-color: var(--sn-node-selected);
  background: var(--sn-accent-bg);
}

.status-card-event[data-status="error"] {
  color: var(--sn-danger-color);
  border-color: var(--sn-danger-color);
  background: var(--sn-danger-bg);
}

.status-card-event[data-type="message"] {
  color: var(--sn-cat-server);
  background: var(--sn-message-event-bg);
}
`;
