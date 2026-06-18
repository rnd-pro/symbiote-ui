export default /*css*/ `
sn-event-feed {
  display: flex;
  flex-direction: column;
  min-height: 0;
  color: var(--sn-text);
  font-family: var(--sn-font);
  font-size: var(--sn-event-feed-font-size, 12px);
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
  gap: var(--sn-event-feed-header-gap, 12px);
  padding: var(--sn-event-feed-header-padding, 6px 12px);
  border-block-end: 1px solid var(--sn-event-feed-border, var(--sn-node-border));
  background: var(--sn-event-feed-header-bg, var(--sn-node-header-bg));
  color: var(--sn-text-dim);
  font-size: var(--sn-event-feed-header-size, 11px);
}

.sn-event-feed-count {
  color: var(--sn-text);
  font-family: var(--sn-font-mono);
}

.sn-event-feed-body-list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: var(--sn-event-feed-body-padding, 8px);
}

.sn-event-feed-items {
  display: flex;
  flex-direction: column;
  gap: var(--sn-event-feed-item-gap, 8px);
}

sn-event-feed-item {
  display: block;
  border: 1px solid var(--sn-event-feed-border, var(--sn-node-border));
  border-radius: var(--sn-card-radius);
  background: var(--sn-event-feed-item-bg, var(--sn-bg-overlay));
}

sn-event-feed-item:hover {
  background: var(--sn-event-feed-item-hover-bg, var(--sn-node-hover));
}

.sn-event-feed-item {
  padding: var(--sn-event-feed-item-padding, 8px);
}

.sn-event-feed-item-header {
  display: flex;
  align-items: center;
  gap: var(--sn-event-feed-item-header-gap, 8px);
  margin-block-end: var(--sn-event-feed-item-header-margin, 6px);
  color: var(--sn-text);
  font-family: var(--sn-font-mono);
  font-size: var(--sn-event-feed-item-header-size, 11px);
}

.sn-event-feed-arrow {
  width: var(--sn-event-feed-arrow-width, 18px);
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
  font-size: var(--sn-event-feed-time-size, 10px);
  text-align: end;
}

.sn-event-feed-duration {
  color: var(--sn-cat-data);
  font-size: var(--sn-event-feed-time-size, 10px);
}

.sn-event-feed-body {
  padding: var(--sn-event-feed-code-padding, 6px);
  border-radius: var(--sn-list-item-radius);
  background: var(--sn-bg-overlay);
  color: var(--sn-text-dim);
  font-family: var(--sn-font-mono);
  font-size: var(--sn-event-feed-body-size, 11px);
  word-break: break-word;
}

.sn-event-feed-result {
  color: var(--sn-text);
}

.sn-event-feed-raw {
  max-height: var(--sn-event-feed-raw-max-height, 200px);
  margin: 0;
  overflow: auto;
  color: var(--sn-text-dim);
  font-size: var(--sn-event-feed-raw-size, 10px);
  white-space: pre-wrap;
}

.sn-event-feed-error {
  color: var(--sn-danger-color);
  font-weight: 700;
}

.sn-event-feed-empty {
  padding: var(--sn-event-feed-empty-padding, 30px);
}
`;
