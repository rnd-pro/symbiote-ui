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
  gap: var(--sn-list-item-gap, 8px);
  min-height: var(--sn-list-item-min-height, 32px);
  padding: var(--sn-list-item-padding, 4px 12px);
  border: 1px solid transparent;
  border-radius: var(--sn-list-item-radius, 4px);
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
  background: var(--sn-list-item-hover-bg, rgba(255, 255, 255, 0.05));
}

.sn-list-item:focus-visible {
  border-color: var(--sn-list-item-focus-border, var(--sn-focus-ring-color, currentColor));
  box-shadow: 0 0 0 2px var(--sn-focus-ring-color, currentColor);
}

:host([active]) .sn-list-item,
sn-list-item[active] .sn-list-item,
:host([selected]) .sn-list-item,
sn-list-item[selected] .sn-list-item {
  background: var(--sn-list-item-active-bg, rgba(0, 122, 204, 0.15));
  border-color: var(--sn-list-item-active-border, var(--sn-tabs-accent, #007acc));
}

:host([current]) .sn-list-item,
sn-list-item[current] .sn-list-item {
  font-weight: 600;
  color: var(--sn-list-item-active-color, var(--sn-text));
  background: var(--sn-list-item-hover-bg, rgba(255, 255, 255, 0.05));
}

:host([disabled]),
sn-list-item[disabled]  {
  color: var(--sn-list-item-disabled-color, var(--sn-text-dim, #888));
}

:host([disabled]) .sn-list-item,
sn-list-item[disabled] .sn-list-item {
  cursor: not-allowed;
  opacity: 0.5;
}

:host([disabled]) .sn-list-item:hover,
sn-list-item[disabled] .sn-list-item:hover {
  background: transparent;
}

:host([loading]) .sn-list-item,
sn-list-item[loading] .sn-list-item {
  cursor: wait;
  opacity: 0.7;
}

.sn-list-item-spinner {
  display: inline-block;
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: sn-list-item-spin 0.6s linear infinite;
  margin-inline-end: 4px;
  flex: 0 0 auto;
}

@keyframes sn-list-item-spin {
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .sn-list-item-spinner {
    animation-duration: 2s;
  }
}

.sn-list-item-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 var(--sn-list-item-icon-size, 16px);
  width: var(--sn-list-item-icon-size, 16px);
  height: var(--sn-list-item-icon-size, 16px);
  color: var(--sn-list-item-icon-color);
  font-family: var(--sn-icon-font);
  font-size: var(--sn-list-item-icon-font-size, 16px);
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
  max-width: var(--sn-list-item-meta-max-width, 120px);
  color: var(--sn-list-item-meta-color);
  font-family: var(--sn-font-mono, monospace);
  font-size: var(--sn-list-item-meta-size);
}
`;
