/**
 * CrossLayoutPortalBridge draws a themed visual bridge between two DOM anchors.
 *
 * It is intentionally data-agnostic: host apps decide which elements represent
 * portal endpoints, while the bridge owns viewport tracking and path rendering.
 */
export class CrossLayoutPortalBridge extends HTMLElement {
  #root;
  #svg;
  #path;
  #sourceDot;
  #targetDot;
  #resizeObserver;
  #mutationObserver;
  #raf = 0;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.innerHTML = `
      <style>
        :host,
        cross-layout-portal-bridge {
          position: fixed;
          inset: 0;
          z-index: var(--sn-portal-bridge-z, 12);
          pointer-events: none;
          contain: layout style;
        }

        svg {
          width: 100%;
          height: 100%;
          overflow: visible;
        }

        path {
          fill: none;
          stroke: var(--sn-portal-bridge-stroke, var(--sn-node-selected, var(--sn-node-accent, #4a9eff)));
          stroke-width: var(--sn-portal-bridge-width, 2);
          stroke-linecap: round;
          stroke-dasharray: var(--sn-portal-bridge-dash, 7 7);
          filter: drop-shadow(0 0 5px color-mix(in srgb, var(--sn-portal-bridge-stroke, var(--sn-node-selected, #4a9eff)) 40%, transparent));
        }

        circle {
          fill: var(--sn-portal-bridge-dot, var(--sn-node-selected, var(--sn-node-accent, #4a9eff)));
          stroke: var(--sn-bg, #f3f5f8);
          stroke-width: 2;
        }
      </style>
      <svg aria-hidden="true">
        <path part="path"></path>
        <circle part="source-dot" r="5"></circle>
        <circle part="target-dot" r="5"></circle>
      </svg>
    `;
    this.#svg = this.#root.querySelector('svg');
    this.#path = this.#root.querySelector('path');
    this.#sourceDot = this.#root.querySelector('[part="source-dot"]');
    this.#targetDot = this.#root.querySelector('[part="target-dot"]');
  }

  static get observedAttributes() {
    return ['source-selector', 'target-selector', 'source-side', 'target-side', 'path-style'];
  }

  connectedCallback() {
    this.#resizeObserver = new ResizeObserver(() => this.requestUpdate());
    this.#mutationObserver = new MutationObserver(() => this.requestUpdate());
    this.#mutationObserver.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    window.addEventListener('resize', this.#onWindowChange, { passive: true });
    window.addEventListener('scroll', this.#onWindowChange, { passive: true, capture: true });
    this.requestUpdate();
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.#mutationObserver?.disconnect();
    window.removeEventListener('resize', this.#onWindowChange);
    window.removeEventListener('scroll', this.#onWindowChange, { capture: true });
    cancelAnimationFrame(this.#raf);
  }

  attributeChangedCallback() {
    this.requestUpdate();
  }

  requestUpdate() {
    cancelAnimationFrame(this.#raf);
    this.#raf = requestAnimationFrame(() => this.#render());
  }

  #onWindowChange = () => this.requestUpdate();

  #render() {
    const source = this.#endpoint('source-selector');
    const target = this.#endpoint('target-selector');

    if (!source || !target) {
      this.hidden = true;
      return;
    }

    this.hidden = false;
    this.#resizeObserver?.observe(source);
    this.#resizeObserver?.observe(target);

    const start = this.#anchorPoint(source, this.getAttribute('source-side') || 'right');
    const end = this.#anchorPoint(target, this.getAttribute('target-side') || 'left');
    const path = this.#getPath(start, end, this.getAttribute('path-style') || 'bezier');

    this.#svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
    this.#path.setAttribute('d', path);
    this.#sourceDot.setAttribute('cx', String(start.x));
    this.#sourceDot.setAttribute('cy', String(start.y));
    this.#targetDot.setAttribute('cx', String(end.x));
    this.#targetDot.setAttribute('cy', String(end.y));
  }

  #endpoint(attributeName) {
    const selector = this.getAttribute(attributeName) || '';
    const invalidAttribute = `data-${attributeName}-invalid`;
    if (!selector) {
      this.toggleAttribute(invalidAttribute, false);
      return null;
    }
    try {
      const endpoint = document.querySelector(selector);
      this.toggleAttribute(invalidAttribute, false);
      return endpoint;
    } catch {
      this.toggleAttribute(invalidAttribute, true);
      return null;
    }
  }

  #getPath(start, end, style) {
    if (style === 'pcb') {
      const grid = Number.parseFloat(getComputedStyle(this).getPropertyValue('--sn-portal-bridge-grid')) || 20;
      const stub = Number.parseFloat(getComputedStyle(this).getPropertyValue('--sn-portal-bridge-stub')) || 36;
      const chamfer = Number.parseFloat(getComputedStyle(this).getPropertyValue('--sn-portal-bridge-chamfer')) || 8;
      const snap = (value) => Math.round(value / grid) * grid;
      const startStubX = start.x + Math.sign(end.x - start.x || 1) * stub;
      const endStubX = end.x - Math.sign(end.x - start.x || 1) * stub;
      const channelX = snap((startStubX + endStubX) / 2);
      return this.#orthogonalPath([
        start,
        { x: startStubX, y: start.y },
        { x: channelX, y: start.y },
        { x: channelX, y: end.y },
        { x: endStubX, y: end.y },
        end,
      ], chamfer);
    }

    const dx = Math.max(48, Math.abs(end.x - start.x) * 0.45);
    const c1 = { x: start.x + dx, y: start.y };
    const c2 = { x: end.x - dx, y: end.y };
    return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
  }

  #orthogonalPath(points, chamfer = 0) {
    const compact = [];
    for (const point of points) {
      const previous = compact.at(-1);
      if (!previous || Math.abs(previous.x - point.x) > 0.5 || Math.abs(previous.y - point.y) > 0.5) {
        compact.push(point);
      }
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (let index = 1; index < compact.length - 1; index += 1) {
        const prev = compact[index - 1];
        const curr = compact[index];
        const next = compact[index + 1];
        const sameVertical = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
        const sameHorizontal = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
        if (sameVertical || sameHorizontal) {
          compact.splice(index, 1);
          changed = true;
          break;
        }
      }
    }

    let path = `M ${compact[0].x} ${compact[0].y}`;
    for (let index = 1; index < compact.length; index += 1) {
      const prev = compact[index - 1];
      const curr = compact[index];
      const next = compact[index + 1];
      if (next && chamfer > 0) {
        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;
        const isH1 = Math.abs(dx1) > Math.abs(dy1);
        const isH2 = Math.abs(dx2) > Math.abs(dy2);
        if (isH1 !== isH2) {
          const len1 = Math.hypot(dx1, dy1);
          const len2 = Math.hypot(dx2, dy2);
          if (len1 >= chamfer * 3 && len2 >= chamfer * 3) {
            const c = Math.min(chamfer, len1 / 2, len2 / 2);
            const preX = curr.x - (dx1 / len1) * c;
            const preY = curr.y - (dy1 / len1) * c;
            const postX = curr.x + (dx2 / len2) * c;
            const postY = curr.y + (dy2 / len2) * c;
            path += ` L ${preX} ${preY} L ${postX} ${postY}`;
            continue;
          }
        }
      }
      if (Math.abs(curr.y - prev.y) < 0.5) {
        path += ` H ${curr.x}`;
      } else if (Math.abs(curr.x - prev.x) < 0.5) {
        path += ` V ${curr.y}`;
      } else {
        path += ` H ${curr.x} V ${curr.y}`;
      }
    }
    return path;
  }

  #anchorPoint(el, side) {
    const rect = el.getBoundingClientRect();
    const xMap = {
      left: rect.left,
      right: rect.right,
      center: rect.left + rect.width / 2,
    };
    const yMap = {
      top: rect.top,
      bottom: rect.bottom,
      center: rect.top + rect.height / 2,
    };
    return {
      x: Math.round(xMap[side] ?? xMap.center),
      y: Math.round(yMap[side] ?? yMap.center),
    };
  }
}

CrossLayoutPortalBridge.reg = (tagName = 'cross-layout-portal-bridge') => {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, CrossLayoutPortalBridge);
  }
};

CrossLayoutPortalBridge.reg('cross-layout-portal-bridge');
