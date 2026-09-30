/**
 * Transient click ripple feedback.
 *
 * Renders a themed pulse at a viewport point whenever the host app wants to
 * acknowledge a user activation (scene transition, in-app navigation, command
 * commit) with a visual ripple at the click point.
 */

export const CLICK_RIPPLE_CLASS = 'sn-click-ripple';
export const CLICK_RIPPLE_STYLE_ID = 'sn-click-ripple-styles';
export const CLICK_RIPPLE_DURATION_MS = 480;
const CLICK_RIPPLE_SIZE_PX = 44;

const CLICK_RIPPLE_CSS = `
.${CLICK_RIPPLE_CLASS}{
  position:fixed;
  width:${CLICK_RIPPLE_SIZE_PX}px;
  height:${CLICK_RIPPLE_SIZE_PX}px;
  margin-left:${-CLICK_RIPPLE_SIZE_PX / 2}px;
  margin-top:${-CLICK_RIPPLE_SIZE_PX / 2}px;
  border-radius:999px;
  border:2px solid var(--sn-click-ripple, var(--sn-sys-accent, #4f8cff));
  background:color-mix(in oklab, var(--sn-click-ripple, var(--sn-sys-accent, #4f8cff)) 22%, transparent);
  box-shadow:0 0 12px color-mix(in oklab, var(--sn-click-ripple, var(--sn-sys-accent, #4f8cff)) 45%, transparent);
  opacity:0;
  transform:scale(0.4);
  pointer-events:none;
  z-index:2147483647;
}
.${CLICK_RIPPLE_CLASS}[data-sn-ripple-active="true"]{
  transition:transform ${CLICK_RIPPLE_DURATION_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1), opacity ${CLICK_RIPPLE_DURATION_MS}ms ease-out;
  opacity:1;
  transform:scale(1.9);
}
@media (prefers-reduced-motion: reduce){
  .${CLICK_RIPPLE_CLASS}[data-sn-ripple-active="true"]{ transition:none; }
}
`;

/**
 * Inject the ripple stylesheet once per document.
 * @param {Document} doc
 * @returns {HTMLStyleElement|null}
 */
export function ensureClickRippleStyles(doc) {
  let target = doc || globalThis.document;
  if (!target?.head || !target?.createElement) return null;
  let style = target.getElementById?.(CLICK_RIPPLE_STYLE_ID) || null;
  if (style) return style;
  style = target.createElement('style');
  style.id = CLICK_RIPPLE_STYLE_ID;
  style.textContent = CLICK_RIPPLE_CSS;
  target.head.appendChild(style);
  return style;
}

/**
 * Show a transient ripple pulse centred on a viewport point.
 * @param {{x?: number, y?: number, doc?: Document}} options
 * @returns {HTMLElement|null} the ripple element, or null without a DOM body
 */
export function showClickRipple({ x, y, doc } = {}) {
  let target = doc || globalThis.document;
  if (!target?.body || !target?.createElement) return null;
  ensureClickRippleStyles(target);
  let ripple = target.createElement('div');
  ripple.className = CLICK_RIPPLE_CLASS;
  ripple.setAttribute('aria-hidden', 'true');
  ripple.style.left = `${Number.isFinite(Number(x)) ? Number(x) : 0}px`;
  ripple.style.top = `${Number.isFinite(Number(y)) ? Number(y) : 0}px`;
  target.body.appendChild(ripple);
  let raf = target.defaultView?.requestAnimationFrame?.bind(target.defaultView)
    || ((callback) => setTimeout(callback, 16));
  raf(() => {
    if (ripple.isConnected !== false) ripple.setAttribute('data-sn-ripple-active', 'true');
  });
  setTimeout(() => ripple.remove?.(), CLICK_RIPPLE_DURATION_MS + 60);
  return ripple;
}
