export default /*css*/ `
sn-source-diff {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
  box-sizing: border-box;
}

.sn-source-diff {
  background: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 6px);
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.sn-source-diff-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--sn-surface, #272730);
  border-block-end: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  flex-wrap: wrap;
  gap: var(--sn-space-sm);
}

.sn-source-diff-info {
  display: flex;
  align-items: center;
  gap: var(--sn-space-md);
}

.sn-source-diff-filename {
  font-weight: 500;
  font-size: var(--sn-text-md);
  color: var(--sn-text, #fff);
}

.sn-source-diff-stats {
  font-size: var(--sn-text-xs);
  color: var(--sn-text-dim, #888);
}

.sn-source-diff-actions {
  display: flex;
  gap: var(--sn-space-sm);
}

.sn-source-diff-mode-btn,
.sn-source-diff-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.15));
  border-radius: 4px;
  color: var(--sn-text-dim, #ccc);
  padding: 4px 10px;
  font-size: var(--sn-text-sm);
  cursor: pointer;
  outline: none;
  transition: background 0.15s, color 0.15s;
}

.sn-source-diff-mode-btn:hover,
.sn-source-diff-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--sn-text, #fff);
}

.sn-source-diff-mode-btn .material-symbols-outlined,
.sn-source-diff-btn .material-symbols-outlined {
  font-size: var(--sn-text-xl);
}

.sn-source-diff-accept {
  border-color: var(--sn-hue-success, #166534);
  color: var(--sn-hue-success, #22c55e);
}
.sn-source-diff-accept:hover {
  background: rgba(34, 197, 94, 0.1);
  color: #4ade80;
}

.sn-source-diff-reject {
  border-color: var(--sn-hue-danger, #991b1b);
  color: var(--sn-hue-danger, #ef4444);
}
.sn-source-diff-reject:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.sn-source-diff-request {
  border-color: var(--sn-hue-warning, #a16207);
  color: var(--sn-hue-warning, #facc15);
}

.sn-source-diff-request:hover {
  background: rgba(250, 204, 21, 0.1);
  color: #fde047;
}

.sn-source-diff-body {
  overflow: auto;
  max-height: 500px;
  min-height: 100px;
}

.sn-source-diff-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--sn-code-font-family, monospace);
  font-size: var(--sn-code-font-size, 12px);
  color: var(--sn-text, #e6edf3);
}

/* Hunk Header style */
.sn-source-diff-hunk-header {
  background: rgba(0, 122, 204, 0.1);
  color: var(--sn-tabs-accent, #58a6ff);
  font-weight: 500;
  padding: 6px 12px;
  user-select: none;
  border-bottom: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.05));
  border-top: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.05));
}

.sn-source-diff-hunk-header td {
  padding: 6px 12px;
}

.sn-source-diff-hunk-actions {
  display: inline-flex;
  gap: var(--sn-space-sm);
  float: right;
}

.sn-source-diff-hunk-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 2px;
  color: var(--sn-text-dim, #888);
  border-radius: 4px;
}
.sn-source-diff-hunk-btn:hover {
  background: rgba(255,255,255,0.1);
  color: var(--sn-text, #fff);
}

.sn-source-diff-row {
  transition: background 0.1s;
}

.sn-source-diff-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

.sn-source-diff-gutter {
  width: 45px;
  text-align: right;
  padding: 2px 10px 2px 4px;
  color: var(--sn-text-dim, #57606a);
  user-select: none;
  border-right: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.05));
  vertical-align: top;
  position: relative;
}

/* Comment add anchor button */
.sn-source-diff-comment-btn {
  display: none;
  position: absolute;
  right: 2px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--sn-surface, #272730);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.2));
  color: var(--sn-text, #fff);
  border-radius: 50%;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: var(--sn-text-sm);
  font-weight: bold;
}

.sn-source-diff-row:hover .sn-source-diff-comment-btn {
  display: inline-flex;
}

.sn-source-diff-diagnostic {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  margin-inline-start: var(--sn-space-xs);
  border-radius: 999px;
  background: var(--sn-hue-info, #38bdf8);
  color: var(--sn-panel-bg, #1e1e24);
  font-family: var(--sn-font, sans-serif);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
}

.sn-source-diff-diagnostic[data-severity="error"] {
  background: var(--sn-hue-danger, #ef4444);
}

.sn-source-diff-diagnostic[data-severity="warning"] {
  background: var(--sn-hue-warning, #facc15);
}

.sn-source-diff-diagnostic[data-severity="hint"] {
  background: var(--sn-text-dim, #94a3b8);
}

.sn-source-diff-code {
  padding: 2px 12px;
  white-space: pre-wrap;
  word-break: break-all;
  vertical-align: top;
}

/* Unified deletion line coloring */
.sn-source-diff-line-delete {
  background-color: rgba(248, 81, 73, 0.15);
}
.sn-source-diff-line-delete .sn-source-diff-code {
  color: #ff7b72;
}

/* Unified addition line coloring */
.sn-source-diff-line-add {
  background-color: rgba(46, 160, 67, 0.15);
}
.sn-source-diff-line-add .sn-source-diff-code {
  color: #3fb950;
}

/* Empty placeholder styling for side-by-side */
.sn-source-diff-empty-cell {
  background-color: rgba(0, 0, 0, 0.1);
  opacity: 0.5;
}

/* Side by side columns width */
.sn-source-diff-side-by-side td {
  width: 50%;
}
`;
