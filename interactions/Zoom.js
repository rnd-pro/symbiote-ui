/**
 * Zoom handler — wheel, touch pinch, and double-click zoom
 *
 * Adapted from Rete.js area-plugin/zoom.ts (123 LOC).
 * Handles zoom relative to cursor/pinch center.
 *
 * @module symbiote-node/interactions/Zoom
 */

export class Zoom {
  /** @type {PointerEvent[]} */
  #pointers = [];

  /** @type {{ cx: number, cy: number, distance: number }|null} */
  #previous = null;

  /** @type {HTMLElement|null} */
  #container = null;

  /** @type {HTMLElement|null} */
  #content = null;

  /** @type {function|null} */
  #onZoom = null;

  /** @type {function|null} */
  #shouldHandleWheel = null;

  /**
   * @param {number} [intensity=0.1] - Zoom sensitivity
   */
  constructor(intensity = 0.1) {
    /** @type {number} */
    this.intensity = intensity;
  }

  /**
   * Initialize zoom handler
   * @param {HTMLElement} container - Outer container
   * @param {HTMLElement} content - Inner content element (for getBoundingClientRect)
   * @param {function} onZoom - Callback: (delta, ox, oy, source)
   * @param {function} [getTransform] - Optional callback returning {x, y} to avoid getBoundingClientRect layout thrashing
   * @param {{shouldHandleWheel?: function(WheelEvent): boolean}} [options]
   */
  initialize(container, content, onZoom, getTransform = null, options = {}) {
    this.#container = container;
    this.#content = content;
    this.#onZoom = onZoom;
    this.getTransform = getTransform;
    this.#shouldHandleWheel = options.shouldHandleWheel || null;

    container.addEventListener('wheel', this.#wheel, { passive: false });
    container.addEventListener('pointerdown', this.#down);
    container.addEventListener('dblclick', this.#dblclick);
    window.addEventListener('pointermove', this.#move);
    window.addEventListener('pointerup', this.#up);
    window.addEventListener('pointercancel', this.#up);
  }

  #getRect() {
    if (this.getTransform) {
      let c = this.#container.getBoundingClientRect();
      let t = this.getTransform();
      return { left: c.left + t.x, top: c.top + t.y };
    }
    return this.#content.getBoundingClientRect();
  }

  #wheel = (e) => {
    if (this.#shouldHandleWheel && !this.#shouldHandleWheel(e)) return;
    e.preventDefault();
    let rect = this.#getRect();

    let absDelta = Math.min(Math.abs(e.deltaY), 10) / 10;
    let sign = e.deltaY < 0 ? 1 : -1;
    let delta = sign * this.intensity * absDelta;
    let ox = (rect.left - e.clientX) * delta;
    let oy = (rect.top - e.clientY) * delta;
    this.#onZoom(delta, ox, oy, 'wheel');
  };

  #dblclick = (e) => {
    e.preventDefault();
    let rect = this.#getRect();
    let delta = 4 * this.intensity;
    let ox = (rect.left - e.clientX) * delta;
    let oy = (rect.top - e.clientY) * delta;
    this.#onZoom(delta, ox, oy, 'dblclick');
  };

  #down = (e) => {
    this.#pointers.push(e);
  };

  #move = (e) => {
    this.#pointers = this.#pointers.map((p) => (p.pointerId === e.pointerId ? e : p));
    if (this.#pointers.length < 2) return;

    let [p1, p2] = this.#pointers;
    let distance = Math.sqrt((p1.clientX - p2.clientX) ** 2 + (p1.clientY - p2.clientY) ** 2);
    let cx = (p1.clientX + p2.clientX) / 2;
    let cy = (p1.clientY + p2.clientY) / 2;

    if (this.#previous && this.#previous.distance > 0) {
      let rect = this.#getRect();
      let delta = distance / this.#previous.distance - 1;
      let ox = (rect.left - cx) * delta;
      let oy = (rect.top - cy) * delta;
      this.#onZoom(delta, ox - (this.#previous.cx - cx), oy - (this.#previous.cy - cy), 'touch');
    }
    this.#previous = { cx, cy, distance };
  };

  #up = (e) => {
    this.#previous = null;
    this.#pointers = this.#pointers.filter((p) => p.pointerId !== e.pointerId);
  };

  /**
   * Whether a multi-touch zoom is in progress
   * @returns {boolean}
   */
  isTranslating() {
    return this.#pointers.length >= 2;
  }

  /** Cleanup event listeners */
  destroy() {
    if (!this.#container) return;
    this.#container.removeEventListener('wheel', this.#wheel);
    this.#container.removeEventListener('pointerdown', this.#down);
    this.#container.removeEventListener('dblclick', this.#dblclick);
    window.removeEventListener('pointermove', this.#move);
    window.removeEventListener('pointerup', this.#up);
    window.removeEventListener('pointercancel', this.#up);
  }
}

export { Zoom as default };
