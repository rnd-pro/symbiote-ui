export default /*css*/ `
:host,
sn-list-item {
  display: block;
  color: var(--sn-text);
}

:host([hidden]),
sn-list-item[hidden]  {
  display: none !important;
}

.sn-list-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: var(--sn-list-item-gap);
  min-height: var(--sn-list-item-min-height);
  padding: var(--sn-list-item-padding);
  border: 1px solid transparent;
  border-radius: var(--sn-list-item-radius);
  background: var(--sn-list-item-bg);
  color: inherit;
  cursor: pointer;
  user-select: none;
  outline: none;
  transition:
    background 0.14s ease,
    border-color 0.14s ease,
    color 0.14s ease;
}

.sn-list-item:hover {
  background: var(--sn-list-item-hover-bg);
}

.sn-list-item:focus-visible {
  border-color: var(--sn-list-item-focus-border);
}

:host([active]) .sn-list-item,
sn-list-item[active] .sn-list-item {
  background: var(--sn-list-item-active-bg);
  border-color: var(--sn-list-item-active-border);
}

:host([disabled]),
sn-list-item[disabled]  {
  color: var(--sn-list-item-disabled-color);
}

:host([disabled]) .sn-list-item,
sn-list-item[disabled] .sn-list-item {
  cursor: default;
  opacity: 0.58;
}

:host([disabled]) .sn-list-item:hover,
sn-list-item[disabled] .sn-list-item:hover {
  background: var(--sn-list-item-bg);
}

.sn-list-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--sn-list-item-icon-size);
  width: var(--sn-list-item-icon-size);
  height: var(--sn-list-item-icon-size);
  color: var(--sn-list-item-icon-color);
  font-family: var(--sn-icon-font);
  font-size: var(--sn-list-item-icon-font-size);
  line-height: 1;
}

.sn-list-item-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.sn-list-item-label,
.sn-list-item-description,
.sn-list-item-meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sn-list-item-label {
  color: var(--sn-list-item-label-color);
  font-size: var(--sn-list-item-label-size);
  font-weight: var(--sn-list-item-label-weight);
}

.sn-list-item-description {
  color: var(--sn-list-item-description-color);
  font-size: var(--sn-list-item-description-size);
  line-height: 1.25;
}

.sn-list-item-meta {
  flex: 0 1 auto;
  max-width: var(--sn-list-item-meta-max-width);
  color: var(--sn-list-item-meta-color);
  font-family: var(--sn-font-mono, monospace);
  font-size: var(--sn-list-item-meta-size);
}
`;
