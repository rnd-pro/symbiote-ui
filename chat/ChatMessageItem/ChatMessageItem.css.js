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
  flex-direction: column;
  gap: var(--sn-chat-tool-gap, 6px);
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
  font-size: var(--sn-chat-small-size, 11px);
  max-width: 90%;
  color: var(--sn-text-dim);
}

.message.system .msg-content {
  background: transparent;
  text-align: center;
  font-style: italic;
  padding: var(--sn-space-xs);
}

.msg-content {
  padding: var(--sn-chat-message-padding, 12px 16px);
  border-radius: 16px;
  width: 100%;
  font-size: var(--sn-chat-message-font-size, 13px);
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
  border-radius: var(--sn-radius-xl);
  background: var(--sn-node-hover);
  overflow: hidden;
  width: 100%;
  min-width: 0;
  transition: background var(--sn-transition-fast) var(--sn-transition-easing);
}

.tool-card[open] {
  background: var(--sn-node-hover);
}

.tool-header {
  display: flex;
  align-items: center;
  gap: var(--sn-chat-status-card-gap, 6px);
  padding: var(--sn-chat-tool-padding, 8px 12px);
  font-size: var(--sn-chat-tool-font-size, 12px);
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
  font-size: var(--sn-chat-tool-label-size, 10px);
  transition: transform var(--sn-transition-fast) var(--sn-transition-easing);
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
  padding: var(--sn-chat-tool-padding, 8px 12px);
}

.tool-label {
  font-size: var(--sn-chat-tool-label-size, 10px);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--sn-text-dim);
  margin-bottom: var(--sn-space-xs);
}

.tool-code {
  background: var(--sn-bg);
  border-radius: var(--sn-radius-md);
  padding: var(--sn-chat-code-padding, 8px);
  font-family: var(--sn-font-mono);
  font-size: var(--sn-chat-code-size, 11px);
  color: var(--sn-text-dim);
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow-y: auto;
}

.tool-waiting {
  color: var(--sn-text-dim);
  font-style: italic;
  font-size: var(--sn-chat-small-size, 11px);
}

.spin-icon {
  animation: spin var(--sn-animation-duration-normal) linear infinite;
  animation-play-state: var(--sn-animation-play-state);
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
  margin-left: var(--sn-space-xs);
  animation: blink var(--sn-animation-duration-normal) step-end infinite;
  animation-play-state: var(--sn-animation-play-state);
}

@keyframes blink {
  50% { opacity: 0; }
}

.md-code-block {
  background: var(--sn-bg);
  border-radius: var(--sn-radius-lg);
  padding: var(--sn-chat-code-padding, 12px);
  overflow-x: auto;
  margin: 6px 0;
  font-family: var(--sn-font-mono);
  font-size: var(--sn-chat-code-size, 12px);
  white-space: pre;
}

.md-inline-code {
  background: var(--sn-node-hover);
  padding: 2px 5px;
  border-radius: var(--sn-radius-sm);
  font-family: var(--sn-font-mono);
  font-size: var(--sn-chat-code-size, 11px);
  color: var(--sn-text);
}

.markdown-mention {
  color: var(--sn-node-selected);
  background: var(--sn-accent-bg);
  padding: 1px 4px;
  border-radius: var(--sn-radius-sm);
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
  margin: var(--sn-space-lg) 0 var(--sn-space-sm);
  color: var(--sn-text);
  font-weight: 700;
}

h1.md-h {
  font-size: var(--sn-chat-markdown-h1-size, 20px);
  border-bottom: 1px solid var(--sn-node-border);
  padding-bottom: 6px;
}

h2.md-h {
  font-size: var(--sn-chat-markdown-h2-size, 18px);
  border-bottom: 1px solid var(--sn-node-border);
  padding-bottom: var(--sn-space-xs);
}

h3.md-h {
  font-size: var(--sn-chat-markdown-h3-size, 16px);
}

h4.md-h {
  font-size: var(--sn-chat-markdown-h4-size, 14px);
}

.md-p {
  margin: 0;
}

.md-quote {
  margin: var(--sn-space-sm) 0;
  padding: var(--sn-space-sm) var(--sn-space-lg);
  border-left: 4px solid var(--sn-node-selected);
  background: var(--sn-accent-bg-subtle);
  border-radius: 0 var(--sn-radius-sm) var(--sn-radius-sm) 0;
  font-style: italic;
  color: var(--sn-text-dim);
}

.md-list {
  margin: var(--sn-space-sm) 0;
  padding-left: var(--sn-space-xl);
}

.md-list li {
  margin: 3px 0;
}

.md-img {
  max-width: 100%;
  height: auto;
  border-radius: var(--sn-radius-md);
  margin: var(--sn-space-sm) 0;
  border: 1px solid var(--sn-node-border);
}

.md-hr {
  border: none;
  border-top: 1px solid var(--sn-node-border);
  margin: var(--sn-space-lg) 0;
}

.md-table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--sn-space-md) 0;
  font-size: var(--sn-chat-table-size, 12px);
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
  transition: opacity var(--sn-transition-fast) var(--sn-transition-easing), transform var(--sn-transition-fast) var(--sn-transition-easing);
}

.message.agent:hover .work-summary-wrap,
.message.agent:focus-within .work-summary-wrap,
.work-summary-wrap:focus-within {
  opacity: 1;
  transform: translateY(0);
}

.thinking-block,
.work-summary {
  font-size: var(--sn-chat-tool-font-size, 12px);
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
  padding: var(--sn-space-xs) 0;
  font-weight: 500;
}

.thinking-block summary::-webkit-details-marker,
.work-summary summary::-webkit-details-marker {
  display: none;
}

.thinking-block summary .material-symbols-outlined {
  animation: thinking-pulse var(--sn-animation-duration-normal) var(--sn-transition-easing) infinite;
  animation-play-state: var(--sn-animation-play-state);
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
  flex: 0 0 calc(var(--sn-chat-summary-icon-size, 16px) * 1.5);
  margin-top: 1px;
  width: calc(var(--sn-chat-summary-icon-size, 16px) * 1.5);
  height: calc(var(--sn-chat-summary-icon-size, 16px) * 1.5);
  border: none;
  border-radius: var(--sn-radius-lg);
  background: transparent;
  color: var(--sn-text-dim);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.75;
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), color var(--sn-transition-fast) var(--sn-transition-easing), opacity var(--sn-transition-fast) var(--sn-transition-easing);
}

.work-copy-btn:hover {
  background: var(--sn-node-hover);
  color: var(--sn-text);
  opacity: 1;
}

.work-copy-btn .material-symbols-outlined {
  font-size: var(--sn-chat-summary-icon-size, 15px);
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
  margin-left: var(--sn-space-sm);
}

.chat-session-meta:empty {
  display: none;
}

.meta-chip {
  font-size: var(--sn-chat-tool-label-size, 10px);
  font-weight: 500;
  padding: 2px 7px;
  border-radius: var(--sn-radius-sm);
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
  margin-left: var(--sn-space-sm);
  font-size: var(--sn-chat-small-size, 11px);
  font-weight: 400;
  color: var(--sn-text-dim);
  font-style: italic;
}

.status-board {
  display: flex;
  flex-wrap: wrap;
  gap: var(--sn-chat-status-card-gap, 8px);
  padding: var(--sn-space-xs) 0;
  width: 100%;
}

.status-card {
  flex: 1 1 220px;
  max-width: 320px;
  background: var(--sn-node-hover);
  border: 1px solid var(--sn-node-hover);
  border-radius: var(--sn-radius-lg);
  padding: var(--sn-chat-status-card-padding, 10px 12px);
  display: flex;
  flex-direction: column;
  gap: var(--sn-chat-status-card-gap, 6px);
  transition: border-color var(--sn-transition-normal) var(--sn-transition-easing), box-shadow var(--sn-transition-normal) var(--sn-transition-easing);
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
  transition: background var(--sn-transition-normal) var(--sn-transition-easing);
}

.status-card[data-status="running"] {
  border-color: var(--sn-accent-border);
  --card-accent: var(--sn-cat-server);
}

.status-card[data-status="running"]::before {
  animation: card-progress var(--sn-animation-duration-slow) var(--sn-transition-easing) infinite;
  animation-play-state: var(--sn-animation-play-state);
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
  gap: var(--sn-chat-status-card-gap, 6px);
  font-size: var(--sn-chat-status-card-size, 12px);
  font-weight: 500;
  color: var(--sn-text);
}

.status-card-header .material-symbols-outlined {
  font-size: var(--sn-chat-status-icon-size, 16px);
}

.status-card-header .spin-icon {
  animation: spin var(--sn-animation-duration-normal) linear infinite;
  animation-play-state: var(--sn-animation-play-state);
}

.status-card-status {
  font-size: var(--sn-chat-small-size, 11px);
  color: var(--sn-text-dim);
  display: flex;
  align-items: center;
  gap: var(--sn-space-xs);
}

.status-card-events {
  display: flex;
  flex-wrap: wrap;
  gap: calc(var(--sn-chat-status-card-gap, 6px) * 0.5);
}

.status-card-event {
  display: inline-block;
  background: var(--sn-node-bg);
  color: var(--sn-text-dim);
  padding: var(--sn-composer-footer-btn-padding, 2px 6px);
  border-radius: var(--sn-radius-sm);
  font-size: var(--sn-chat-small-size, 11px);
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

.source-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--sn-node-hover);
  border: 1px solid var(--sn-node-border);
  padding: var(--sn-space-xs) var(--sn-space-sm);
  border-radius: var(--sn-radius-md);
  font-size: var(--sn-chat-small-size, 11px);
  color: var(--sn-text-dim);
  margin-top: var(--sn-space-xs);
}
.source-badge .material-symbols-outlined {
  font-size: var(--sn-text-lg);
}

.attachment-card {
  display: flex;
  align-items: center;
  gap: var(--sn-space-sm);
  background: var(--sn-node-hover);
  border: 1px solid var(--sn-node-border);
  padding: var(--sn-space-sm) var(--sn-space-md);
  border-radius: var(--sn-radius-lg);
  margin: var(--sn-space-xs) 0;
  max-width: 320px;
}
.attachment-card .material-symbols-outlined {
  font-size: 20px;
  color: var(--sn-text-dim);
}
.attachment-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.attachment-title {
  font-size: var(--sn-chat-small-size, 12px);
  font-weight: 500;
  color: var(--sn-text);
}

.artifact-card {
  background: var(--sn-node-hover);
  border: 1px solid var(--sn-node-border);
  border-radius: var(--sn-radius-lg);
  overflow: hidden;
  margin: 6px 0;
  width: 100%;
}
.artifact-header {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--sn-bg);
  padding: 6px 12px;
  border-bottom: 1px solid var(--sn-node-border);
}
.artifact-header .material-symbols-outlined {
  font-size: var(--sn-text-xl);
  color: var(--sn-text-dim);
}
.artifact-title {
  font-size: var(--sn-chat-small-size, 11px);
  font-weight: 600;
  color: var(--sn-text-dim);
  text-transform: uppercase;
}

.approval-card,
.action-card {
  background: var(--sn-node-hover);
  border: 1px solid var(--sn-accent-border, var(--sn-node-border));
  border-radius: var(--sn-radius-lg);
  padding: var(--sn-space-md);
  margin: var(--sn-space-sm) 0;
  display: flex;
  flex-direction: column;
  gap: var(--sn-space-sm);
  width: 100%;
}
.approval-header,
.action-header {
  display: flex;
  align-items: center;
  gap: var(--sn-space-sm);
  font-size: var(--sn-chat-status-card-size, 12px);
  font-weight: 600;
  color: var(--sn-text);
}
.approval-header .material-symbols-outlined {
  color: var(--sn-cat-server, var(--sn-text-dim));
}
.action-header .material-symbols-outlined {
  color: var(--sn-accent-color, var(--sn-text-dim));
}
.approval-body,
.action-body {
  font-size: var(--sn-chat-small-size, 12px);
  color: var(--sn-text-dim);
  line-height: 1.4;
}
.approval-actions,
.action-actions {
  display: flex;
  gap: var(--sn-space-sm);
  margin-top: var(--sn-space-xs);
}
.sn-btn {
  font-family: inherit;
  font-size: var(--sn-chat-small-size, 11px);
  font-weight: 600;
  padding: 6px 12px;
  border-radius: var(--sn-radius-md);
  border: 1px solid var(--sn-node-border);
  background: var(--sn-node-bg);
  color: var(--sn-text);
  cursor: pointer;
  transition: background var(--sn-transition-fast) var(--sn-transition-easing), border-color var(--sn-transition-fast) var(--sn-transition-easing);
}
.sn-btn:hover {
  background: var(--sn-node-hover);
  border-color: var(--sn-text-dim);
}
.sn-btn.approve {
  background: var(--sn-success-color, #22c55e);
  color: #fff;
  border-color: var(--sn-success-border, #15803d);
}
.sn-btn.approve:hover {
  background: var(--sn-success-hover, #16a34a);
}
.sn-btn.reject {
  background: var(--sn-danger-color, #ef4444);
  color: #fff;
  border-color: var(--sn-danger-border, #b91c1c);
}
.sn-btn.reject:hover {
  background: var(--sn-danger-hover, #dc2626);
}

.error-card {
  background: var(--sn-danger-bg, rgba(239, 68, 68, 0.08));
  border: 1px solid var(--sn-danger-border, var(--sn-node-border));
  border-radius: var(--sn-radius-lg);
  padding: var(--sn-space-md);
  margin: 6px 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.error-card.cancelled {
  background: var(--sn-node-hover);
  border-color: var(--sn-node-border);
}
.error-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--sn-chat-status-card-size, 12px);
  font-weight: 600;
  color: var(--sn-text);
}
.error-header .material-symbols-outlined {
  color: var(--sn-danger-color);
}
.error-card.cancelled .error-header .material-symbols-outlined {
  color: var(--sn-text-dim);
}
.error-body {
  font-size: var(--sn-chat-small-size, 11px);
  color: var(--sn-text-dim);
  font-family: var(--sn-font-mono, monospace);
  white-space: pre-wrap;
}
`;
