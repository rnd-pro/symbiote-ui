export default /*css*/ `
sn-event-feed {
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--sn-text);
  font-family: var(--sn-font);
  font-size: 12px;
}

sn-event-feed[hidden],
sn-event-feed-item[hidden] {
  display: none !important;
}

.sn-event-feed {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.sn-event-feed-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 12px;
  border-block-end: 1px solid var(--sn-node-border);
  background: var(--sn-node-header-bg);
  color: var(--sn-text-dim);
  font-size: 11px;
}

.sn-event-feed-count {
  color: var(--sn-text);
  font-family: var(--sn-font-mono);
}

.sn-event-feed-body-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}

.sn-event-feed-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

sn-event-feed-item {
  display: block;
  border: 1px solid var(--sn-node-border);
  border-radius: var(--sn-card-radius);
  background: var(--sn-bg-overlay);
}

sn-event-feed-item:hover {
  background: var(--sn-node-hover);
}

.sn-event-feed-item {
  padding: 8px;
}

.sn-event-feed-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-block-end: 6px;
  color: var(--sn-text);
  font-family: var(--sn-font-mono);
  font-size: 11px;
}

.sn-event-feed-arrow {
  width: 18px;
  color: var(--sn-cat-server);
  font-weight: 700;
}

.sn-event-feed-item[data-is-call="false"] .sn-event-feed-arrow {
  color: var(--sn-success-color);
}

.sn-event-feed-item[data-success="false"] .sn-event-feed-arrow {
  color: var(--sn-danger-color);
}

.sn-event-feed-tool {
  min-width: 100px;
  min-inline-size: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.sn-event-feed-time {
  flex: 1 1 auto;
  color: var(--sn-text-dim);
  font-size: 10px;
  text-align: end;
}

.sn-event-feed-duration {
  color: var(--sn-cat-data);
  font-size: 10px;
}

.sn-event-feed-body {
  padding: 6px;
  border-radius: var(--sn-list-item-radius);
  background: var(--sn-bg-overlay);
  color: var(--sn-text-dim);
  font-family: var(--sn-font-mono);
  font-size: 11px;
  word-break: break-word;
}

.sn-event-feed-result {
  color: var(--sn-text);
}

.sn-event-feed-raw {
  max-height: 200px;
  margin: 0;
  overflow: auto;
  color: var(--sn-text-dim);
  font-size: 10px;
  white-space: pre-wrap;
}

.sn-event-feed-error {
  color: var(--sn-danger-color);
  font-weight: 700;
}

.sn-event-feed-empty {
  padding: 30px;
}
`;
