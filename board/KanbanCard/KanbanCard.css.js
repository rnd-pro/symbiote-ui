import { css } from '@symbiotejs/symbiote';

export default css`
  sn-kanban-card {
    --sn-kc-attention-color: var(--sn-sys-danger);
    --sn-kc-icon-size: var(--sn-kanban-card-icon-size, var(--sn-text-xl));
    --sn-kc-hero-icon-size: var(--sn-kanban-card-hero-icon-size, var(--sn-kanban-card-hero-size, var(--sn-step-12)));
    --sn-kc-metric-size: var(--sn-kanban-card-metric-size, var(--sn-kanban-card-hero-size, var(--sn-step-12)));
    display: block;
    position: relative;
    box-sizing: border-box;
    background: var(--sn-kanban-card-bg, var(--sn-card-bg, var(--sn-sys-surface)));
    color: var(--sn-kanban-card-fg, var(--sn-card-fg, var(--sn-sys-on-surface)));
    border: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid var(--sn-kanban-card-border, var(--sn-card-border, var(--sn-sys-outline)));
    border-radius: var(--sn-kanban-card-radius, var(--sn-card-radius, var(--sn-radius-md)));
    transition: border-color var(--sn-transition-fast), background var(--sn-transition-fast);
    outline: none;
    font-family: var(--sn-font, sans-serif);
    overflow: hidden;
  }

  sn-kanban-card svg {
    display: block;
    flex: none;
    width: var(--sn-kc-icon-size);
    height: var(--sn-kc-icon-size);
  }
  
  sn-kanban-card[data-size="S"] .sn-kc-content { padding: var(--sn-kanban-card-padding-sm, var(--sn-card-padding-sm, var(--sn-space-sm))); gap: var(--sn-kanban-card-gap-sm, var(--sn-card-gap-sm, var(--sn-space-sm))); }
  sn-kanban-card[data-size="M"] .sn-kc-content { padding: var(--sn-kanban-card-padding-md, var(--sn-card-padding-md, var(--sn-space-md))); gap: var(--sn-kanban-card-gap-md, var(--sn-card-gap-md, var(--sn-space-md))); }
  sn-kanban-card[data-size="L"] .sn-kc-content { padding: var(--sn-kanban-card-padding-lg, var(--sn-card-padding-lg, var(--sn-space-lg))); gap: var(--sn-kanban-card-gap-lg, var(--sn-card-gap-lg, var(--sn-space-lg))); }
  sn-kanban-card[data-size="XL"] .sn-kc-content { padding: var(--sn-kanban-card-padding-xl, var(--sn-card-padding-xl, var(--sn-space-md))); gap: var(--sn-kanban-card-gap-xl, var(--sn-card-gap-xl, var(--sn-space-md))); }
  
  .sn-kc-selector:focus-visible {
    outline: var(--sn-kanban-card-focus-width, var(--sn-card-focus-width, thin)) solid var(--sn-sys-accent);
    outline-offset: var(--sn-kanban-card-focus-offset, var(--sn-card-focus-offset, thin));
  }
  
  sn-kanban-card:hover {
    border-color: var(--sn-kanban-card-hover-border, color-mix(in oklch, var(--sn-sys-accent) var(--sn-sys-state-hover-mix), var(--sn-kanban-card-border, var(--sn-card-border, var(--sn-sys-outline)))));
  }
  
  sn-kanban-card[selected],
  sn-kanban-card[aria-selected="true"] {
    border-color: var(--sn-sys-accent);
    background: var(--sn-kanban-card-selected-bg, color-mix(in oklch, var(--sn-sys-accent) var(--sn-sys-state-selected-mix), var(--sn-sys-surface)));
  }
  
  sn-kanban-card[data-has-attention="true"] {
    border-color: var(--sn-kc-attention-color);
  }
  sn-kanban-card[data-attention-tone="warning"] { --sn-kc-attention-color: var(--sn-sys-warning); }
  sn-kanban-card[data-attention-tone="info"] { --sn-kc-attention-color: var(--sn-sys-info, var(--sn-sys-accent)); }
  sn-kanban-card[data-attention-tone="success"] { --sn-kc-attention-color: var(--sn-sys-success); }
  sn-kanban-card[data-attention-tone="neutral"] { --sn-kc-attention-color: var(--sn-sys-on-surface-dim); }
  
  .sn-kc-selector {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    border: none;
    background: transparent;
    padding: 0;
    margin: 0;
  }
  
  .sn-kc-content {
    position: relative;
    pointer-events: none;
    display: flex;
    flex-direction: column;
  }
  
  sn-kanban-card[data-layout="split-progress"] .sn-kc-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: min-content;
  }
  sn-kanban-card[data-layout="split-progress"] .sn-kc-module { grid-column: 1 / -1; }
  sn-kanban-card[data-layout="split-progress"] .sn-kc-child-realization { grid-column: 1; }
  sn-kanban-card[data-layout="split-progress"] .sn-kc-stages { grid-column: 2; }
  sn-kanban-card[data-layout="split-progress"] .sn-kc-child-realization,
  sn-kanban-card[data-layout="split-progress"] .sn-kc-stages,
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-child-realization,
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-stages {
    align-self: stretch;
    justify-content: flex-end;
  }
  sn-kanban-card[data-layout="split-progress"] .sn-kc-stages-list,
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-stages-list {
    flex: 1;
    justify-content: flex-end;
  }

  sn-kanban-card[data-layout="activity"] .sn-kc-content {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-auto-rows: min-content;
  }
  sn-kanban-card[data-layout="activity"] .sn-kc-module { grid-column: 1 / -1; }
  sn-kanban-card[data-layout="activity"] .sn-kc-agent { grid-column: 1; }
  sn-kanban-card[data-layout="activity"] .sn-kc-retries { grid-column: 2; justify-content: flex-end; }
  
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-auto-rows: min-content;
  }
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-module { grid-column: 1 / -1; }
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-audit {
    border: none;
    background: transparent;
    padding-inline: 0;
    flex-direction: row;
    align-items: center;
  }
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-audit-icon svg {
    width: var(--sn-kanban-card-audit-icon-size, var(--sn-kc-hero-icon-size));
    height: var(--sn-kanban-card-audit-icon-size, var(--sn-kc-hero-icon-size));
  }
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-child-realization { grid-column: 1; }
  sn-kanban-card[data-layout="audit-progress"] .sn-kc-stages { grid-column: 2; }
  
  .sn-kc-module button, .sn-kc-module a {
    pointer-events: auto;
    position: relative; 
  }
  
  .sn-kc-module {
    display: flex;
    flex-direction: column;
  }

  .sn-kc-module[hidden], [hidden] {
    display: none !important;
  }
  
  .sn-kc-attention {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--sn-space-sm);
    color: var(--sn-kc-attention-color);
    font-size: var(--sn-text-sm);
    font-weight: 500;
  }
  
  .sn-kc-attention[data-attention-layout="strip"] {
    padding: var(--sn-space-xs) var(--sn-space-sm);
    background: color-mix(in oklch, var(--sn-kc-attention-color) 10%, transparent);
    margin: calc(var(--sn-space-md) * -1) calc(var(--sn-space-md) * -1) 0;
    border-bottom: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid color-mix(in oklch, var(--sn-kc-attention-color) 20%, transparent);
  }
  sn-kanban-card[data-size="S"] .sn-kc-attention[data-attention-layout="strip"] { margin: calc(var(--sn-space-sm) * -1) calc(var(--sn-space-sm) * -1) 0; }
  
  .sn-kc-attention[data-attention-layout="hero"] {
    background: transparent;
    border: none;
    margin: 0;
    padding: 0;
    justify-content: flex-start;
  }
  .sn-kc-attention[data-attention-layout="hero"] .sn-kc-attention-icon svg {
    width: var(--sn-kc-hero-icon-size);
    height: var(--sn-kc-hero-icon-size);
  }
  .sn-kc-attention[data-attention-layout="hero"] .sn-kc-header-menu { display: none; }
  
  .sn-kc-attention-icon { display: flex; align-items: center; gap: var(--sn-space-xs); }
  
  .sn-kc-header-top {
    display: flex;
    align-items: center;
    gap: var(--sn-space-sm);
    justify-content: space-between;
  }
  
  .sn-kc-header-title {
    font-size: var(--sn-text-sm);
    font-weight: 500;
    color: var(--sn-sys-on-surface);
    flex-grow: 1;
    line-height: 1.4;
  }
  
  .sn-kc-header-icon {
    display: flex;
    color: var(--sn-sys-on-surface-dim);
  }
  .sn-kc-header-icon[data-icon="grid"],
  .sn-kc-header-icon[data-icon="flag"] { color: var(--sn-sys-accent); }
  
  .sn-kc-header-menu {
    color: var(--sn-sys-on-surface-dim);
    display: flex;
  }
  
  .sn-kc-header-desc {
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
    margin-block-start: var(--sn-space-xs);
    line-height: 1.4;
  }
  
  .sn-kc-dependencies {
    flex-direction: row;
    align-items: center;
    gap: var(--sn-space-xs);
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
  }
  .sn-kc-dependencies-icon { display: flex; color: var(--sn-sys-accent); }
  
  .sn-kc-stages-list {
    display: flex;
    flex-direction: column;
    gap: var(--sn-space-sm);
  }
  
  .sn-kc-stage {
    display: flex;
    flex-direction: column;
    gap: var(--sn-space-sm);
  }
  
  .sn-kc-stage-header {
    display: flex;
    justify-content: space-between;
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
  }
  
  .sn-kc-progress-track {
    height: var(--sn-kanban-card-progress-thickness, var(--sn-step-2));
    background: var(--sn-sys-outline);
    border-radius: var(--sn-radius-full);
    overflow: hidden;
  }
  
  .sn-kc-segmented-track {
    display: flex;
    gap: var(--sn-step-1);
    height: var(--sn-kanban-card-progress-thickness, var(--sn-step-2));
  }
  .sn-kc-segment {
    flex: 1;
    background: var(--sn-sys-outline);
    border-radius: var(--sn-radius-full);
  }
  .sn-kc-segment-active {
    background: var(--sn-sys-accent);
  }
  .sn-kc-progress-bar {
    height: 100%;
    background: var(--sn-sys-accent);
  }
  
  .sn-kc-progress-track[data-tone="blue"] .sn-kc-progress-bar,
  .sn-kc-segmented-track[data-tone="blue"] .sn-kc-segment-active {
    background: var(--sn-sys-info, var(--sn-sys-accent));
  }
  .sn-kc-progress-track[data-tone="teal"] .sn-kc-progress-bar,
  .sn-kc-segmented-track[data-tone="teal"] .sn-kc-segment-active {
    background: var(--sn-sys-success);
  }
  
  .sn-kc-stepper {
    display: flex;
    align-items: center;
    gap: var(--sn-space-md);
    position: relative;
    padding-block: var(--sn-space-xs);
  }
  
  .sn-kc-step {
    flex: 0 0 1.5em;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
    height: 1.5em;
    width: 1.5em;
    border-radius: 50%;
    border: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid var(--sn-sys-outline);
    background: var(--sn-sys-surface);
  }
  
  .sn-kc-step:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 100%;
    width: var(--sn-space-md);
    height: var(--sn-kanban-card-progress-thickness, var(--sn-step-2));
    background: color-mix(in oklch, var(--sn-sys-on-surface-dim) 55%, var(--sn-sys-outline));
    transform: translateY(-50%);
  }
  
  .sn-kc-step[data-status="active"] {
    border-color: var(--sn-sys-accent);
    color: var(--sn-sys-on-surface);
  }
  
  .sn-kc-step[data-status="active"]:empty {
    background: color-mix(in oklch, var(--sn-sys-accent) 82%, var(--sn-sys-outline));
  }
  
  .sn-kc-step[data-status="done"]:empty {
    background: var(--sn-sys-success);
  }
  
  .sn-kc-step[data-status="done"]:has(svg) {
    background: var(--sn-sys-accent);
    color: var(--sn-sys-surface);
    border: none;
  }
  
  .sn-kc-step[data-status="done"]:not(:last-child)::after {
    background: var(--sn-sys-accent);
  }
  
  sn-kanban-card[data-size="L"] .sn-kc-metric {
    align-items: center;
    text-align: center;
    gap: var(--sn-space-xs);
    padding-block: var(--sn-space-md);
  }
  
  .sn-kc-metric-main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sn-space-xs);
  }
  
  .sn-kc-metric-value {
    font-size: var(--sn-kc-metric-size);
    line-height: 1;
    font-weight: 400;
  }
  
  sn-kanban-card[data-primary-emphasis="cost"] .sn-kc-metric-value,
  sn-kanban-card[data-primary-emphasis="tokens"] .sn-kc-metric-value {
    color: var(--sn-sys-accent);
  }
  
  sn-kanban-card[data-primary-emphasis="idle"] .sn-kc-idle {
    display: grid;
    grid-template-columns: auto auto;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding-block: var(--sn-space-md);
  }
  sn-kanban-card[data-primary-emphasis="idle"] .sn-kc-idle-time {
    font-size: var(--sn-kc-metric-size);
    font-weight: 400;
    line-height: 1;
    color: var(--sn-sys-warning);
  }
  sn-kanban-card[data-primary-emphasis="idle"] .sn-kc-idle-icon svg {
    width: var(--sn-kanban-card-idle-icon-size, var(--sn-kc-metric-size));
    height: var(--sn-kanban-card-idle-icon-size, var(--sn-kc-metric-size));
    color: var(--sn-sys-warning);
  }
  sn-kanban-card[data-primary-emphasis="idle"] .sn-kc-idle-text {
    grid-column: 1 / -1;
    grid-row: 2;
    font-size: var(--sn-text-sm);
    color: var(--sn-sys-on-surface-dim);
  }
  
  .sn-kc-metric-unit, .sn-kc-metric-limit, .sn-kc-metric-meta {
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
  }
  
  .sn-kc-metric .sn-kc-progress-track {
    align-self: stretch;
    margin-block: var(--sn-space-sm);
  }
  
  .sn-kc-current-action, .sn-kc-next-action {
    flex-direction: row;
    align-items: center;
    gap: var(--sn-space-xs);
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
  }
  .sn-kc-ca-icon, .sn-kc-na-icon { display: flex; color: var(--sn-sys-on-surface-dim); }
  
  .sn-kc-stop-label {
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
    margin-bottom: var(--sn-space-xs);
  }
  .sn-kc-stop-text {
    font-size: var(--sn-text-sm);
    color: var(--sn-sys-on-surface);
    display: flex;
    align-items: flex-start;
    gap: var(--sn-space-sm);
    line-height: 1.4;
  }
  .sn-kc-stop-text::before {
    content: '';
    display: inline-block;
    width: 0.75em; height: 0.75em;
    flex: 0 0 0.75em;
    margin-block-start: calc(var(--sn-space-xs) / 2);
    border: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid var(--sn-sys-outline);
    border-radius: var(--sn-radius-xs);
  }
  
  .sn-kc-agent, .sn-kc-retries, .sn-kc-idle {
    flex-direction: row;
    align-items: center;
    gap: var(--sn-space-xs);
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
  }
  .sn-kc-agent-icon, .sn-kc-retries-icon, .sn-kc-idle-icon { display: flex; color: var(--sn-sys-on-surface-dim); }
  .sn-kc-agent-icon {
    color: var(--sn-kanban-card-agent-accent, var(--sn-sys-accent));
  }
  
  .sn-kc-agent-divider {
    width: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin));
    height: 0.75em;
    background: var(--sn-sys-outline);
    margin-inline: var(--sn-space-xs);
  }
  
  .sn-kc-agent-name,
  .sn-kc-agent-provider,
  .sn-kc-agent-local {
    min-width: 0;
  }

  .sn-kc-agent-provider,
  .sn-kc-agent-local {
    display: flex;
    align-items: center;
    gap: var(--sn-space-xs);
  }

  .sn-kc-agent-provider span,
  .sn-kc-agent-local span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .sn-kc-idle[data-alert="true"] {
    color: var(--sn-sys-warning);
  }
  .sn-kc-idle[data-alert="true"] .sn-kc-idle-icon { color: var(--sn-sys-warning); }
  
  .sn-kc-audit {
    flex-direction: row;
    align-items: center;
    gap: var(--sn-space-sm);
    padding: var(--sn-space-md);
    border: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid color-mix(in oklch, var(--sn-sys-danger) 30%, transparent);
    border-radius: var(--sn-radius-md);
    background: color-mix(in oklch, var(--sn-sys-danger) 5%, transparent);
  }
  .sn-kc-audit-icon {
    display: flex;
    color: var(--sn-sys-danger);
  }
  .sn-kc-audit-icon svg {
    width: var(--sn-kanban-card-audit-icon-size, var(--sn-kc-hero-icon-size));
    height: var(--sn-kanban-card-audit-icon-size, var(--sn-kc-hero-icon-size));
  }
  
  .sn-kc-audit-content {
    display: flex;
    flex-direction: column;
  }
  .sn-kc-audit-status {
    color: var(--sn-sys-danger);
    font-size: var(--sn-text-sm);
    font-weight: 500;
  }
  .sn-kc-audit-summary {
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
  }
  
  .sn-kc-decision-problem-label, .sn-kc-decision-question-label {
    font-size: var(--sn-text-xs);
    color: var(--sn-sys-on-surface-dim);
    margin-bottom: var(--sn-space-xs);
  }
  .sn-kc-decision-question-label { margin-top: var(--sn-space-sm); }
  
  .sn-kc-decision-problem, .sn-kc-decision-question {
    font-size: var(--sn-text-sm);
    color: var(--sn-sys-on-surface);
    line-height: 1.4;
  }
  
  .sn-kc-dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 92px), 1fr));
    gap: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin));
    padding: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin));
    background: var(--sn-sys-outline);
    border-radius: var(--sn-radius-sm);
    overflow: hidden;
  }
  
  .sn-kc-dash-item {
    position: relative;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: var(--sn-space-xs);
    padding-block: var(--sn-space-sm);
    padding-inline: var(--sn-space-xs);
    background: var(--sn-sys-surface);
    min-width: 0;
  }
  
  .sn-kc-dash-icon {
    display: flex;
    color: var(--sn-sys-on-surface-dim);
    position: absolute;
    inset-block-start: var(--sn-space-sm);
    inset-inline-end: var(--sn-space-sm);
  }
  .sn-kc-dash-item:has(.sn-kc-dash-icon) .sn-kc-dash-label {
    padding-inline-end: calc(var(--sn-space-md) + var(--sn-space-xs));
  }
  
  .sn-kc-dash-content {
    display: flex;
    flex-direction: column;
    gap: var(--sn-space-xs);
    flex: 1;
    min-height: 100%;
    min-width: 0;
  }
  .sn-kc-dash-content > .sn-kc-progress-track,
  .sn-kc-dash-content > .sn-kc-segmented-track { margin-block-start: auto; }
  
  .sn-kc-dash-label {
    font-size: var(--sn-text-2xs);
    color: var(--sn-sys-on-surface-dim);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .sn-kc-dash-val {
    font-size: var(--sn-text-xs);
    font-weight: 500;
    color: var(--sn-sys-on-surface);
    overflow-wrap: anywhere;
  }
  .sn-kc-dash-item .sn-kc-metric-meta { overflow-wrap: anywhere; }
  
  .sn-kc-dash-item[data-tone="blue"] .sn-kc-dash-val {
    color: var(--sn-sys-info, var(--sn-sys-accent));
    font-size: var(--sn-text-xl);
  }
  
  .sn-kc-dash-item[data-tone="teal"] .sn-kc-dash-val {
    color: var(--sn-sys-success);
    font-size: var(--sn-text-xl);
  }
  .sn-kc-dash-item[data-tone="red"] .sn-kc-dash-icon,
  .sn-kc-dash-item[data-tone="red"] .sn-kc-dash-val {
    color: var(--sn-sys-danger);
  }
  .sn-kc-dash-item[data-tone="amber"] .sn-kc-dash-icon,
  .sn-kc-dash-item[data-tone="amber"] .sn-kc-dash-val {
    color: var(--sn-sys-warning);
  }
  .sn-kc-dash-item[data-tone="agent"] .sn-kc-dash-icon,
  .sn-kc-dash-item[data-tone="agent"] .sn-kc-dash-val {
    color: var(--sn-kanban-card-agent-accent, var(--sn-sys-accent));
  }
  
  .sn-kc-actions-list {
    display: flex;
    gap: var(--sn-space-xs);
    padding-top: var(--sn-space-md);
    border-top: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid var(--sn-sys-outline);
    margin-top: auto;
  }
  
  .sn-kc-action-btn {
    pointer-events: auto;
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--sn-space-xs);
    background: transparent;
    border: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid var(--sn-sys-outline);
    color: var(--sn-sys-on-surface);
    border-radius: var(--sn-radius-sm);
    padding: var(--sn-space-xs) var(--sn-space-sm);
    font-size: var(--sn-text-xs);
    font-weight: 500;
    cursor: pointer;
    transition: background var(--sn-transition-fast);
  }
  .sn-kc-action-btn:hover {
    background: color-mix(in oklch, var(--sn-sys-on-surface) var(--sn-sys-state-hover-mix), transparent);
  }
  
  .sn-kc-action-btn[data-tone="primary"] {
    background: transparent;
    color: var(--sn-sys-accent);
    border-color: var(--sn-sys-outline);
  }
  .sn-kc-action-btn[data-tone="primary"]:hover {
    background: color-mix(in oklch, var(--sn-sys-accent) var(--sn-sys-state-hover-mix), transparent);
    border-color: var(--sn-sys-accent);
  }
  
  .sn-kc-action-icon { display: flex; }
  
  .sn-kc-current-action, .sn-kc-next-action, .sn-kc-idle {
    border-top: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid var(--sn-sys-outline);
    padding-top: var(--sn-space-sm);
  }
  sn-kanban-card[data-primary-emphasis="idle"] .sn-kc-idle { border-top: none; }
  
  .sn-kc-agent-module { margin-top: auto; }
  
  @media (prefers-reduced-motion: reduce) {
    sn-kanban-card, .sn-kc-action-btn { transition: none; }
  }
  
  @media (forced-colors: active) {
    sn-kanban-card { border: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid CanvasText; }
    .sn-kc-attention[data-attention-layout="strip"] { border-bottom: var(--sn-kanban-card-border-width, var(--sn-card-border-width, thin)) solid CanvasText; }
    .sn-kc-dashboard-grid { background: CanvasText; }
    .sn-kc-actions-list { border-color: CanvasText; }
  }
`;
