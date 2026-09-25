// One focusable collector for the library, shared by every trap: deep
// traversal (nested open shadow roots and their assigned slotted content),
// in composed tab order, with disabled/hidden/inert candidates excluded.
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function isFocusableCandidate(el) {
  if (!el || el.hasAttribute?.('disabled') || el.disabled) return false;
  if (el.getAttribute?.('tabindex') === '-1') return false;
  if (el.closest?.('[inert], [hidden], [aria-hidden="true"]')) return false;
  // Server-side environment fallback: no layout model means no computed style.
  if (typeof el.getBoundingClientRect !== 'function') return true;
  if (typeof el.getClientRects === 'function' && !el.getClientRects().length) return false;
  const view = el.ownerDocument?.defaultView;
  if (view?.getComputedStyle) {
    const style = view.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

// Collects focusables in composed tab order: the container's own light DOM
// first, then — at the position of the host that owns them — everything its
// open shadow roots and slots contribute. Flattening at the host position is
// what keeps reading order intact for nested islands and for <slot> content.
export function getFocusableElements(container) {
  if (!container) return [];
  const found = [];
  const seen = new Set();

  const collectFrom = (root) => {
    if (!root?.querySelectorAll) return;
    for (const el of root.querySelectorAll(FOCUSABLE_SELECTOR)) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (isFocusableCandidate(el)) found.push(el);
    }
  };

  // Every root is visited once: an environment whose shadow query leaks into
  // the host tree would otherwise send this walk in circles.
  const visitedRoots = new Set();
  const walk = (root) => {
    if (!root || visitedRoots.has(root)) return;
    visitedRoots.add(root);
    // Light DOM first: assigned <slot> content participates in the order the
    // light tree defines, shadow-only content follows its host.
    for (const el of root.children || []) {
      // The child fast path must apply the same contract as the query below:
      // an arbitrary container (a panel wrapper, a flex row) is NOT a tab stop
      // just because it is visible.
      if (el.matches?.(FOCUSABLE_SELECTOR) && isFocusableCandidate(el)) { seen.add(el); found.push(el); }
    }
    collectFrom(root);
    for (const host of root.querySelectorAll('*')) {
      if (!host.shadowRoot) continue;
      walk(host.shadowRoot);
    }
  };

  if (container.matches?.(FOCUSABLE_SELECTOR) && isFocusableCandidate(container)) {
    seen.add(container);
    found.push(container);
  }
  walk(container);
  return found;
}

// Shadow-aware membership: the container owns an element that lives behind one
// of its open shadow hosts even when `contains` stops at the shadow edge.
function ownsElement(container, active) {
  if (container.contains?.(active)) return true;
  for (let node = active; node; node = node.parentElement || node.getRootNode?.()?.host) {
    if (container === node) return true;
  }
  return false;
}

export class FocusTrap {
  #container;
  #restoreElement = null;
  #options;
  #active = false;

  constructor(container, options = {}) {
    this.#container = container;
    this.#options = options;
  }

  #onKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    const elements = getFocusableElements(this.#container);
    if (elements.length === 0) {
      event.preventDefault();
      return;
    }
    const first = elements[0];
    const last = elements[elements.length - 1];

    // Focus can sit several shadow levels deep: the trap must compare the
    // DEEPEST active element against its collected list.
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement && active.shadowRoot.activeElement !== active) {
      active = active.shadowRoot.activeElement;
    }

    if (event.shiftKey) {
      if (active === first || !ownsElement(this.#container, active) || !elements.includes(active)) {
        last.focus();
        event.preventDefault();
      }
    } else {
      if (active === last || !ownsElement(this.#container, active) || !elements.includes(active)) {
        first.focus();
        event.preventDefault();
      }
    }
  };

  activate() {
    if (this.#active) return;
    this.#active = true;
    if (typeof document !== 'undefined') {
      this.#restoreElement = document.activeElement;
    }

    this.#container.addEventListener('keydown', this.#onKeyDown);

    const elements = getFocusableElements(this.#container);
    if (elements.length > 0) {
      const initialFocus = this.#options.initialFocus;
      if (initialFocus && typeof initialFocus.focus === 'function') {
        initialFocus.focus();
      } else {
        elements[0].focus();
      }
    }
  }

  deactivate() {
    if (!this.#active) return;
    this.#active = false;
    this.#container.removeEventListener('keydown', this.#onKeyDown);

    if (this.#options.restoreFocus !== false && this.#restoreElement && typeof this.#restoreElement.focus === 'function') {
      this.#restoreElement.focus();
    }
    this.#restoreElement = null;
  }
}
