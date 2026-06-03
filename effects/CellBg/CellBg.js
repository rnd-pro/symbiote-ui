import Symbiote from '@symbiotejs/symbiote';
import template from './CellBg.tpl.js';
import css from './CellBg.css.js';

/**
 * Cellular Automaton Background Component
 * Parameters based on user config:
 * Rule: Conway B3/S23
 * Cell Size: 14px
 * Speed: 75ms
 * Min Radius: 2px
 * Max Radius: 4px
 * Fade Rate: 4%
 */

const RULE_B = [3];
const RULE_S = [2, 3];
const CELL_SIZE = 14;
const STEP_MS = 75;
const MIN_RADIUS = 2;
const MAX_RADIUS = 5;
const FADE_RATE = 0.04;

const PALETTE_SIZE = 32;
const now = () => globalThis.performance?.now?.() ?? Date.now();
const requestFrame = (callback) => {
  if (typeof globalThis.requestAnimationFrame === 'function') {
    return globalThis.requestAnimationFrame(callback);
  }
  return setTimeout(() => callback(now()), 16);
};

function normalizeCssColor(source, value) {
  let doc = source?.ownerDocument || globalThis.document;
  if (!doc || !value) return null;
  let probe = doc.createElement('span');
  probe.style.color = value;
  let target = typeof source?.append === 'function' ? source : doc.documentElement;
  target.append(probe);
  let normalized = globalThis.getComputedStyle(probe).color.trim();
  probe.remove();
  return normalized || null;
}

function parseCssRgb(source, value) {
  let normalized = normalizeCssColor(source, value);
  if (!normalized) return null;

  let rgbMatch = normalized.match(/rgba?\(([^)]+)\)/);
  if (rgbMatch) {
    let channels = rgbMatch[1]
      .replaceAll(',', ' ')
      .split(/[ /\t]+/)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => (part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part)));
    return channels.every(Number.isFinite) ? channels : null;
  }

  let srgbMatch = normalized.match(/color\(\s*srgb\s+([^)]+)\)/);
  if (!srgbMatch) return null;
  let channels = srgbMatch[1]
    .split(/[ /\t]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => (part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part) * 255));
  return channels.every(Number.isFinite) ? channels : null;
}

function readCssToken(source, token) {
  let computed = globalThis.getComputedStyle?.(source);
  return computed?.getPropertyValue(token).trim() || '';
}

export class CellBg extends Symbiote {
  init$ = {
    active: false,
  };

  initCallback() {
    this.canvas = this.ref.canvas;
    this.ctx = this.canvas?.getContext?.('2d') || null;
    this._available = Boolean(this.canvas && this.ctx);

    this._buildPalette();

    this.cols = 0;
    this.rows = 0;
    this.grid = new Uint8Array(0);
    this.radii = new Float32Array(0);
    this.running = false;
    this.currentSpeed = 0;
    this.accumulator = 0;
    this.lastTime = now();
    this.isAnimating = false;
    this._stagnantCount = 0;

    // We only redraw on rAF if running, or if a single frame is needed after resize
    this.resize = this.resize.bind(this);
    this.renderLoop = this.renderLoop.bind(this);

    // Use ResizeObserver to catch layout panel resizing (not just window resizes)
    // Debounce: resize canvas immediately (prevents flash), pulse only after settle
    const onResize = () => {
      this.resize();
      if (this._resizeDebounce) clearTimeout(this._resizeDebounce);
      this._resizeDebounce = setTimeout(() => {
        this._resizeDebounce = null;
        this.pulse(10000);
      }, 300);
    };

    if (typeof globalThis.ResizeObserver === 'function') {
      this.ro = new ResizeObserver(onResize);
    } else if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('resize', onResize);
      this._removeResizeFallback = () => globalThis.removeEventListener?.('resize', onResize);
    }

    // Defer observation to allow DOM to settle
    setTimeout(() => {
      this.ro?.observe(this);
      this.resize();
      this._seedRandom();
      this.pulse(10000);
    }, 0);

    this.sub('active', (val) => {
      this.toggle(!!val);
    });
  }

  /**
   * Persistent on/off state for host-controlled activity.
   * toggle(true) keeps animation running until explicit toggle(false).
   * @param {boolean} state
   */
  toggle(state) {
    this._toggled = !!state;
    if (state) {
      this._start();
    } else if (!this._pulseTimer) {
      // Only stop if no active pulse timer
      this._stop();
    }
  }

  /**
   * Timed pulse: start animation for `duration` ms then auto-stop.
   * Does NOT start if toggle is already active (animation already running).
   * Does NOT stop if toggle is active when timer expires.
   * @param {number} [duration=10000]
   */
  pulse(duration = 10000) {
    if (this._toggled) return; // Already running persistently
    if (this._pulseTimer) clearTimeout(this._pulseTimer);
    this._start();
    this._pulseTimer = setTimeout(() => {
      this._pulseTimer = null;
      if (!this._toggled) this._stop();
    }, duration);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.ro) this.ro.disconnect();
    this._removeResizeFallback?.();
    this._stop();
  }

  _buildPalette() {
    let bg = readCssToken(this, '--sn-cell-bg') || readCssToken(this, '--sn-bg');
    let dot = readCssToken(this, '--sn-cell-dot') || readCssToken(this, '--sn-text-dim');
    let bgRgb = parseCssRgb(this, bg) || [0, 0, 0];
    let dotRgb = parseCssRgb(this, dot) || bgRgb;
    let baseAlpha = Number.parseFloat(readCssToken(this, '--sn-cell-base-alpha')) || 0;
    let alphaSpan = Number.parseFloat(readCssToken(this, '--sn-cell-alpha-span')) || 0;

    this._bgFill = normalizeCssColor(this, bg) || 'transparent';

    this.palette = [];
    for (let i = 0; i < PALETTE_SIZE; i++) {
      let t = i / (PALETTE_SIZE - 1);
      let alpha = baseAlpha + t * alphaSpan;
      let r = Math.round(bgRgb[0] * (1 - alpha) + dotRgb[0] * alpha);
      let g = Math.round(bgRgb[1] * (1 - alpha) + dotRgb[1] * alpha);
      let b = Math.round(bgRgb[2] * (1 - alpha) + dotRgb[2] * alpha);
      this.palette.push(`#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`);
    }
  }

  resize() {
    if (!this._available || !this.canvas.parentElement) return;
    let dpr = globalThis.devicePixelRatio || 1;
    let w = this.canvas.parentElement.clientWidth;
    let h = this.canvas.parentElement.clientHeight;

    if (w === 0 || h === 0) return; // Hidden or not attached

    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.canvas._w = w;
    this.canvas._h = h;

    this._buildPalette();
    this.ctx.fillStyle = this._bgFill;
    this.ctx.fillRect(0, 0, w, h);

    let oldGrid = this.grid;
    let oldRadii = this.radii;
    let oldCols = this.cols;
    let oldRows = this.rows;

    this.cols = Math.ceil(w / CELL_SIZE) + 1;
    this.rows = Math.ceil(h / CELL_SIZE) + 1;

    this.grid = new Uint8Array(this.cols * this.rows);
    this.radii = new Float32Array(this.cols * this.rows);
    this.radii.fill(MIN_RADIUS);

    if (oldGrid && oldGrid.length > 0) {
      let mc = Math.min(this.cols, oldCols);
      let mr = Math.min(this.rows, oldRows);
      for (let y = 0; y < mr; y++) {
        for (let x = 0; x < mc; x++) {
          this.grid[y * this.cols + x] = oldGrid[y * oldCols + x];
          this.radii[y * this.cols + x] = oldRadii[y * oldCols + x];
        }
      }
    } else {
      this._seedRandom();
    }

    // Draw one frame if not running
    if (!this.running) {
      this._draw();
    }
  }

  _seedRandom() {
    if (!this.grid || this.grid.length === 0) return;
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = Math.random() < 0.15 ? 1 : 0;
      if (this.grid[i]) this.radii[i] = MIN_RADIUS;
    }
  }

  _start() {
    if (!this._available) return;
    if (this.running) return;
    this.running = true;
    if (!this.isAnimating) {
      this.lastTime = now();
      this.isAnimating = true;
      requestFrame(this.renderLoop);
    }
  }

  _stop() {
    if (!this.running) return;
    this.running = false;
    // Loop will smoothly decelerate and stop in renderLoop
  }

  _step() {
    if (!this.cols || !this.rows) return;
    let len = this.cols * this.rows;
    let next = new Uint8Array(len);
    let changed = 0;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        let neighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            let nx = (x + dx + this.cols) % this.cols;
            let ny = (y + dy + this.rows) % this.rows;
            neighbors += this.grid[ny * this.cols + nx];
          }
        }

        let idx = y * this.cols + x;
        let alive = this.grid[idx];

        if (alive) {
          next[idx] = RULE_S.includes(neighbors) ? 1 : 0;
        } else {
          next[idx] = RULE_B.includes(neighbors) ? 1 : 0;
        }
        if (next[idx] !== alive) changed++;
      }
    }
    this.grid = next;

    // Stagnation detector: if < 2% of cells changed for 5 consecutive steps, inject noise
    let threshold = len * 0.02;
    if (changed < threshold) {
      this._stagnantCount++;
      if (this._stagnantCount >= 5) {
        this._injectNoise();
        this._stagnantCount = 0;
      }
    } else {
      this._stagnantCount = 0;
    }
  }

  /**
   * Inject random live cells into a random rectangular region
   * to break stagnation without resetting the entire grid.
   */
  _injectNoise() {
    let regionW = Math.max(4, (this.cols * 0.3) | 0);
    let regionH = Math.max(4, (this.rows * 0.3) | 0);
    let startX = (Math.random() * (this.cols - regionW)) | 0;
    let startY = (Math.random() * (this.rows - regionH)) | 0;
    for (let y = startY; y < startY + regionH; y++) {
      for (let x = startX; x < startX + regionW; x++) {
        if (Math.random() < 0.15) {
          let idx = y * this.cols + x;
          this.grid[idx] = 1;
          this.radii[idx] = MIN_RADIUS;
        }
      }
    }
  }

  renderLoop(ts) {
    if (!this.isAnimating) return;

    let time = now();
    let dt = Math.min(time - this.lastTime, 100); // clamp dt to prevent huge jumps
    this.lastTime = time;

    // Smoothly accelerate/decelerate
    let targetSpeed = this.running ? 1.0 : 0.0;
    this.currentSpeed += (targetSpeed - this.currentSpeed) * 0.03; // Smooth transition factor

    // If we're fully stopped and radii have faded (we just wait for speed to drop near 0)
    if (!this.running && this.currentSpeed < 0.005) {
      this.currentSpeed = 0;
      this.isAnimating = false;
    }

    // Accumulate effective time for cellular automaton steps
    this.accumulator += dt * this.currentSpeed;

    let maxSteps = 5;
    while (this.accumulator >= STEP_MS && maxSteps > 0) {
      this._step();
      this.accumulator -= STEP_MS;
      maxSteps--;
    }

    this._draw();

    if (this.isAnimating) {
      requestFrame(this.renderLoop);
    }
  }

  _draw() {
    if (!this._available || !this.canvas._w) return;
    let w = this.canvas._w;
    let h = this.canvas._h;

    this.ctx.clearRect(0, 0, w, h);
    this.ctx.fillStyle = this._bgFill;
    this.ctx.fillRect(0, 0, w, h);

    let maxIdx = PALETTE_SIZE - 1;

    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        let idx = y * this.cols + x;
        let alive = this.grid[idx];

        let targetR = alive ? MAX_RADIUS : MIN_RADIUS;
        let currentR = this.radii[idx];

        if (alive) {
          this.radii[idx] = currentR + (targetR - currentR) * 0.2;
        } else {
          this.radii[idx] = currentR + (targetR - currentR) * FADE_RATE;
        }

        let r = this.radii[idx];
        let cx = x * CELL_SIZE;
        let cy = y * CELL_SIZE;

        let t = (r - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS);
        if (t < 0) t = 0;
        if (t > 1) t = 1;

        let pi = (t * maxIdx + 0.5) | 0;

        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.fillStyle = this.palette[pi];
        this.ctx.fill();
      }
    }
  }
}

CellBg.template = template;
CellBg.rootStyles = css;
CellBg.reg('cell-bg');
