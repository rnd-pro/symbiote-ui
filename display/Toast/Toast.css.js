export default /*css*/ `
sn-toast-region {
  position: fixed;
  bottom: var(--sn-space-xl);
  right: var(--sn-space-xl);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: var(--sn-space-sm);
  max-width: min(calc(100% - 48px), 380px);
  pointer-events: none;
}

.sn-toast-region-container {
  display: flex;
  flex-direction: column;
  gap: var(--sn-space-sm);
}

sn-toast {
  display: block;
  pointer-events: auto;
  animation: snToastSlideIn var(--sn-transition-normal, 240ms) cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

sn-toast[data-dismissing] {
  animation: snToastFadeOut var(--sn-transition-normal, 240ms) ease forwards;
}

.sn-toast-card {
  display: flex;
  align-items: flex-start;
  gap: var(--sn-space-md);
  padding: calc(12px * var(--sn-theme-density, 1)) calc(16px * var(--sn-theme-density, 1));
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  border-radius: var(--sn-panel-radius, 6px);
  box-shadow: var(--sn-panel-shadow, 0 8px 20px rgba(0,0,0,0.3));
  color: var(--sn-text);
  font-family: var(--sn-font, sans-serif);
  font-size: calc(13px * var(--sn-theme-type-scale, 1));
  box-sizing: border-box;
}

.sn-toast-icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.sn-toast-message {
  flex-grow: 1;
  line-height: 1.4;
  word-break: break-word;
}

.sn-toast-close {
  background: transparent;
  border: none;
  color: var(--sn-text-dim, rgba(255,255,255,0.6));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 4px;
  margin-top: 1px;
  transition: background-color var(--sn-transition-fast, 120ms), color var(--sn-transition-fast, 120ms);
}

.sn-toast-close:hover {
  background-color: var(--sn-node-hover, rgba(255,255,255,0.05));
  color: var(--sn-text);
}

/* Variant Styles */
.sn-toast-card.sn-toast-info .sn-toast-icon {
  color: var(--sn-cat-data, #2e90fa);
}

.sn-toast-card.sn-toast-success .sn-toast-icon {
  color: var(--sn-status-success, #12b76a);
}

.sn-toast-card.sn-toast-warning .sn-toast-icon {
  color: var(--sn-cat-control, #f79009);
}

.sn-toast-card.sn-toast-error .sn-toast-icon {
  color: var(--sn-status-error, #f04438);
}

@keyframes snToastSlideIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes snToastFadeOut {
  from {
    opacity: 1;
    transform: scale(1);
  }
  to {
    opacity: 0;
    transform: scale(0.9);
  }
}
`;
