export default /*css*/ `
:root {
  --cat-bg: var(--sn-bg, #1a1a1a);
  --cat-surface: var(--sn-surface, #232323);
  --cat-text: var(--sn-text, #f0f0f0);
  --cat-dim: var(--sn-text-dim, #9aa0a6);
  --cat-border: var(--sn-border, #333);
  --cat-accent-bg: var(--sn-accent-bg, #3b82f6);
  --cat-accent-border: var(--sn-accent-border, #2563eb);
  --cat-font: var(--sn-font-family, var(--sn-font, Inter, system-ui, sans-serif));
  --cat-mono: var(--sn-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  --cat-radius: var(--sn-radius-md, var(--sn-radius, 8px));
  --cat-inset: var(--sn-node-bg, #1c1c1c);
  --cat-success: var(--sn-success, #2ea043);
  --cat-warn: var(--sn-warning, #d29922);
  --cat-muted: var(--sn-text-dim, #9aa0a6);
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  height: 100%;
  background: var(--cat-bg);
  color: var(--cat-text);
  font-family: var(--cat-font);
}

body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#catalog-shell {
  flex: 1 1 auto;
  min-height: 0;
}

.workspace-scroll {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}

#workspace-content {
  display: block;
  min-width: 0;
  padding: 24px;
}

.topbar-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  margin-right: 4px;
  font-size: 13px;
  color: var(--cat-dim);
  text-decoration: none;
  border: 1px solid var(--cat-border);
  border-radius: var(--cat-radius);
}

.topbar-link:hover {
  color: var(--cat-text);
  border-color: var(--cat-accent-border);
}

.topbar-link .material-symbols-outlined {
  font-size: 18px;
}

.category-heading {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--cat-dim);
}

catalog-category-panel {
  display: block;
  margin-bottom: 40px;
  scroll-margin-top: 24px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.card,
catalog-component-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 16px;
  background: var(--cat-surface);
  border: 1px solid var(--cat-border);
  border-radius: var(--cat-radius);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}

.card[hidden],
catalog-component-card[hidden] {
  display: none;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.card-tag {
  font-family: var(--cat-mono);
  font-size: 13px;
  color: color-mix(in srgb, var(--cat-accent-bg) 80%, var(--cat-text));
  word-break: break-all;
}

.tier-badge {
  flex: none;
  padding: 2px 8px;
  font-family: var(--cat-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  border-radius: 999px;
  border: 1px solid currentColor;
}

.tier-badge.tier-static {
  color: var(--cat-success);
  background: color-mix(in srgb, var(--cat-success) 14%, transparent);
}

.tier-badge.tier-hydrate {
  color: var(--cat-warn);
  background: color-mix(in srgb, var(--cat-warn) 14%, transparent);
}

.tier-badge.tier-client {
  color: var(--cat-muted);
  background: color-mix(in srgb, var(--cat-muted) 14%, transparent);
}

.card-desc {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--cat-dim);
}

.card-demo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 96px;
  padding: 16px;
  margin-bottom: 12px;
  background: var(--cat-inset);
  border: 1px solid var(--cat-border);
  border-radius: var(--cat-radius);
  overflow: auto;
}

.demo-note {
  margin: 0;
  font-size: 11px;
  color: var(--cat-dim);
  text-align: center;
}

.demo-ref {
  font-family: var(--cat-mono);
  font-size: 12px;
  color: var(--cat-dim);
  text-align: center;
}

.card-snippet {
  position: relative;
  margin-bottom: 12px;
}

.snippet-pre {
  margin: 0;
  padding: 12px;
  max-width: 100%;
  overflow-x: auto;
  background: var(--cat-inset);
  border: 1px solid var(--cat-border);
  border-radius: var(--cat-radius);
}

.snippet-code {
  font-family: var(--cat-mono);
  font-size: 12px;
  line-height: 1.5;
  color: var(--cat-text);
  white-space: pre;
}

.copy-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 10px;
  font: inherit;
  font-size: 11px;
  color: var(--cat-dim);
  background: var(--cat-surface);
  border: 1px solid var(--cat-border);
  border-radius: var(--cat-radius);
  cursor: pointer;
}

.copy-btn:hover {
  color: var(--cat-accent-bg);
  border-color: var(--cat-accent-border);
}

.card-api {
  margin-top: auto;
  border-top: 1px solid var(--cat-border);
  padding-top: 10px;
}

.card-api summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--cat-dim);
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.card-api summary::-webkit-details-marker {
  display: none;
}

.card-api summary::before {
  content: "▸";
  display: inline-block;
  margin-right: 6px;
  color: var(--cat-dim);
}

.card-api[open] summary::before {
  content: "▾";
}

.api-tables {
  margin-top: 12px;
}

.api-section-title {
  margin: 14px 0 6px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--cat-dim);
}

.api-section-title:first-child {
  margin-top: 0;
}

.api-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  table-layout: fixed;
}

.api-table th,
.api-table td {
  padding: 5px 8px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--cat-border);
  word-break: break-word;
  overflow-wrap: anywhere;
}

.api-table th {
  font-weight: 600;
  color: var(--cat-dim);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-size: 10px;
}

.api-table td:first-child {
  font-family: var(--cat-mono);
  color: var(--cat-text);
}

.api-table td:nth-child(2) {
  font-family: var(--cat-mono);
  color: var(--cat-dim);
}

.api-table td:last-child {
  color: var(--cat-dim);
}

@media (max-width: 720px) {
  #workspace-content {
    padding: 16px;
  }

  .category-grid {
    grid-template-columns: 1fr;
  }
}
`;
