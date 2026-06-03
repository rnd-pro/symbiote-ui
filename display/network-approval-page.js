import { createTranslator, getLocalization } from '../locale/index.js';

const TEXT_KEYS = {
  title: 'networkApproval.title',
  heading: 'networkApproval.heading',
  message: 'networkApproval.message',
  requestLabel: 'networkApproval.requestLabel',
  addressLabel: 'networkApproval.addressLabel',
  waitingStatus: 'networkApproval.waitingStatus',
  approvedStatus: 'networkApproval.approvedStatus',
  rejectedStatus: 'networkApproval.rejectedStatus',
};

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function serializeText(text = {}, options = {}) {
  let locale = options.locale ?? getLocalization().locale;
  let t = createTranslator({ locale, messages: options.messages });
  let defaults = Object.fromEntries(
    Object.entries(TEXT_KEYS).map(([name, key]) => [name, t(key)])
  );
  return { ...defaults, ...text };
}

function scriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003C')
    .replace(/>/g, '\\u003E')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function createNetworkApprovalPageStyles() {
  return `
    :root {
      --sn-theme-hue: 218;
      --sn-theme-chroma: 89%;
      --sn-theme-bg-lightness: 10%;
      --sn-theme-surface-lightness: 13%;
      --sn-theme-text-lightness: 94%;
      --sn-theme-radius-scale: 1;
      --sn-theme-motion-scale: 1;
      --sn-theme-elevation-scale: 1;
      --sn-hue-base: 0;
      --sn-hue-accent: var(--sn-theme-hue);
      --sn-sat-vivid: var(--sn-theme-chroma);
      --sn-sat-muted: 0%;
      --sn-lit-bg: var(--sn-theme-bg-lightness);
      --sn-lit-surface: var(--sn-theme-surface-lightness);
      --sn-lit-text: var(--sn-theme-text-lightness);
      --sn-lit-text-dim: 60%;
      --sn-lit-accent: 63%;
      --sn-bg: hsl(0 0% var(--sn-lit-bg));
      --sn-panel-bg: hsl(0 0% var(--sn-lit-surface));
      --sn-node-border: hsl(var(--sn-hue-base) var(--sn-sat-muted) var(--sn-lit-text) / 0.1);
      --sn-node-selected: hsl(var(--sn-hue-accent) var(--sn-sat-vivid) var(--sn-lit-accent));
      --sn-node-radius: calc(6px * var(--sn-theme-radius-scale));
      --sn-node-shadow: 0 2px calc(8px * var(--sn-theme-elevation-scale)) hsl(var(--sn-hue-base) var(--sn-sat-muted) 0% / 0.4);
      --sn-text: hsl(var(--sn-hue-base) var(--sn-sat-muted) var(--sn-lit-text));
      --sn-text-dim: hsl(var(--sn-hue-base) var(--sn-sat-muted) var(--sn-lit-text-dim));
      --sn-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --sn-font-mono: 'JetBrains Mono', 'Fira Code', monospace;
      --sn-cell-bg: var(--sn-bg);
      --sn-cell-dot: hsl(var(--sn-hue-base) var(--sn-sat-muted) 31%);
      --sn-cell-base-alpha: 0.06;
      --sn-cell-alpha-span: 0.18;
      --sn-cell-glare: hsl(var(--sn-hue-base) var(--sn-sat-muted) var(--sn-lit-text) / 0.02);
      --sn-cell-vignette-mid: hsl(var(--sn-hue-base) var(--sn-sat-muted) var(--sn-lit-bg) / 0.7);
      --sn-cell-vignette-edge: var(--sn-bg);
      --sn-cell-noise: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: var(--sn-cell-bg);
      color: var(--sn-text);
      font: 14px var(--sn-font);
    }

    .sn-network-approval-cell-bg,
    .sn-network-approval-cell-bg canvas,
    .sn-network-approval-cell-bg::after,
    body::after {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
    }

    .sn-network-approval-cell-bg {
      overflow: hidden;
      z-index: 0;
    }

    .sn-network-approval-cell-bg canvas {
      width: 100%;
      height: 100%;
      display: block;
      background: var(--sn-cell-bg);
    }

    .sn-network-approval-cell-bg::after {
      background:
        radial-gradient(ellipse 80% 50% at 50% -10%, var(--sn-cell-glare) 0%, transparent 100%),
        radial-gradient(ellipse at 50% 50%, transparent 20%, var(--sn-cell-vignette-mid) 70%, var(--sn-cell-vignette-edge) 100%),
        var(--sn-cell-noise);
    }

    body::after {
      background:
        linear-gradient(to bottom, var(--sn-bg) 0%, transparent 18%),
        linear-gradient(to top, var(--sn-bg) 0%, transparent 18%),
        linear-gradient(to right, var(--sn-bg) 0%, transparent 18%),
        linear-gradient(to left, var(--sn-bg) 0%, transparent 18%);
      z-index: 1;
    }

    main {
      position: relative;
      width: min(520px, calc(100vw - 32px));
      padding: 22px;
      border: 1px solid var(--sn-node-border);
      border-radius: var(--sn-node-radius);
      background: color-mix(in srgb, var(--sn-panel-bg) 92%, transparent);
      box-shadow: var(--sn-node-shadow), 0 18px 60px hsl(var(--sn-hue-base) var(--sn-sat-muted) 0% / 0.32);
      backdrop-filter: blur(18px);
      z-index: 2;
    }

    h1 {
      margin: 0 0 10px;
      font-size: 18px;
      line-height: 1.2;
      letter-spacing: 0;
    }

    p {
      margin: 10px 0 0;
      color: var(--sn-text-dim);
      line-height: 1.45;
    }

    code {
      color: var(--sn-node-selected);
      font-family: var(--sn-font-mono);
      font-size: 12px;
    }

    #status {
      color: var(--sn-text);
    }

    @media (prefers-reduced-motion: reduce) {
      .sn-network-approval-cell-bg canvas {
        opacity: 0.55;
      }
    }
  `;
}

export function createNetworkApprovalCellBgScript() {
  return `
    (() => {
      const canvas = document.getElementById('sn-network-approval-canvas');
      const ctx = canvas?.getContext?.('2d');
      if (!canvas || !ctx) return;

      const RULE_B = [3];
      const RULE_S = [2, 3];
      const CELL_SIZE = 14;
      const STEP_MS = 75;
      const MIN_RADIUS = 2;
      const MAX_RADIUS = 5;
      const FADE_RATE = 0.04;
      const PALETTE_SIZE = 32;
      const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const state = {
        cols: 0,
        rows: 0,
        grid: new Uint8Array(0),
        radii: new Float32Array(0),
        palette: [],
        running: false,
        currentSpeed: 0,
        accumulator: 0,
        lastTime: performance.now(),
        isAnimating: false,
        stagnantCount: 0,
        pulseTimer: null,
        bgFill: 'transparent',
      };

      function readToken(token) {
        return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
      }

      function normalizeColor(value) {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.documentElement.append(probe);
        const normalized = getComputedStyle(probe).color.trim();
        probe.remove();
        return normalized || null;
      }

      function parseRgb(value) {
        const normalized = normalizeColor(value);
        if (!normalized) return null;
        const rgbMatch = normalized.match(/rgba?\\(([^)]+)\\)/);
        if (rgbMatch) {
          const channels = rgbMatch[1]
            .replaceAll(',', ' ')
            .split(/[ /\\t]+/)
            .filter(Boolean)
            .slice(0, 3)
            .map((part) => part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part));
          return channels.every(Number.isFinite) ? channels : null;
        }
        const srgbMatch = normalized.match(/color\\(\\s*srgb\\s+([^)]+)\\)/);
        if (!srgbMatch) return null;
        const channels = srgbMatch[1]
          .split(/[ /\\t]+/)
          .filter(Boolean)
          .slice(0, 3)
          .map((part) => part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part) * 255);
        return channels.every(Number.isFinite) ? channels : null;
      }

      function buildPalette() {
        const bg = readToken('--sn-cell-bg') || readToken('--sn-bg');
        const dot = readToken('--sn-cell-dot') || readToken('--sn-text-dim');
        const bgRgb = parseRgb(bg) || [0, 0, 0];
        const dotRgb = parseRgb(dot) || bgRgb;
        const baseAlpha = Number.parseFloat(readToken('--sn-cell-base-alpha')) || 0;
        const alphaSpan = Number.parseFloat(readToken('--sn-cell-alpha-span')) || 0;
        state.bgFill = normalizeColor(bg) || 'transparent';
        state.palette = [];
        for (let i = 0; i < PALETTE_SIZE; i++) {
          const t = i / (PALETTE_SIZE - 1);
          const alpha = baseAlpha + t * alphaSpan;
          const r = Math.round(bgRgb[0] * (1 - alpha) + dotRgb[0] * alpha);
          const g = Math.round(bgRgb[1] * (1 - alpha) + dotRgb[1] * alpha);
          const b = Math.round(bgRgb[2] * (1 - alpha) + dotRgb[2] * alpha);
          state.palette.push('#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0'));
        }
      }

      function seedRandom() {
        if (!state.grid.length) return;
        for (let i = 0; i < state.grid.length; i++) {
          state.grid[i] = Math.random() < 0.15 ? 1 : 0;
          if (state.grid[i]) state.radii[i] = MIN_RADIUS;
        }
      }

      function draw() {
        if (!canvas._w) return;
        const w = canvas._w;
        const h = canvas._h;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = state.bgFill;
        ctx.fillRect(0, 0, w, h);
        const maxIdx = PALETTE_SIZE - 1;
        for (let y = 0; y < state.rows; y++) {
          for (let x = 0; x < state.cols; x++) {
            const idx = y * state.cols + x;
            const alive = state.grid[idx];
            const targetR = alive ? MAX_RADIUS : MIN_RADIUS;
            const currentR = state.radii[idx];
            state.radii[idx] = alive
              ? currentR + (targetR - currentR) * 0.2
              : currentR + (targetR - currentR) * FADE_RATE;
            const radius = state.radii[idx];
            const t = Math.max(0, Math.min(1, (radius - MIN_RADIUS) / (MAX_RADIUS - MIN_RADIUS)));
            const paletteIndex = (t * maxIdx + 0.5) | 0;
            ctx.beginPath();
            ctx.arc(x * CELL_SIZE, y * CELL_SIZE, radius, 0, Math.PI * 2);
            ctx.fillStyle = state.palette[paletteIndex];
            ctx.fill();
          }
        }
      }

      function resize() {
        const dpr = devicePixelRatio || 1;
        const w = canvas.parentElement.clientWidth;
        const h = canvas.parentElement.clientHeight;
        if (!w || !h) return;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        canvas._w = w;
        canvas._h = h;
        buildPalette();
        const oldGrid = state.grid;
        const oldRadii = state.radii;
        const oldCols = state.cols;
        const oldRows = state.rows;
        state.cols = Math.ceil(w / CELL_SIZE) + 1;
        state.rows = Math.ceil(h / CELL_SIZE) + 1;
        state.grid = new Uint8Array(state.cols * state.rows);
        state.radii = new Float32Array(state.cols * state.rows);
        state.radii.fill(MIN_RADIUS);
        if (oldGrid.length) {
          const mc = Math.min(state.cols, oldCols);
          const mr = Math.min(state.rows, oldRows);
          for (let y = 0; y < mr; y++) {
            for (let x = 0; x < mc; x++) {
              state.grid[y * state.cols + x] = oldGrid[y * oldCols + x];
              state.radii[y * state.cols + x] = oldRadii[y * oldCols + x];
            }
          }
        } else {
          seedRandom();
        }
        draw();
      }

      function injectNoise() {
        const regionW = Math.max(4, (state.cols * 0.3) | 0);
        const regionH = Math.max(4, (state.rows * 0.3) | 0);
        const startX = (Math.random() * Math.max(1, state.cols - regionW)) | 0;
        const startY = (Math.random() * Math.max(1, state.rows - regionH)) | 0;
        for (let y = startY; y < startY + regionH; y++) {
          for (let x = startX; x < startX + regionW; x++) {
            if (Math.random() < 0.15) {
              const idx = y * state.cols + x;
              state.grid[idx] = 1;
              state.radii[idx] = MIN_RADIUS;
            }
          }
        }
      }

      function step() {
        const len = state.cols * state.rows;
        const next = new Uint8Array(len);
        let changed = 0;
        for (let y = 0; y < state.rows; y++) {
          for (let x = 0; x < state.cols; x++) {
            let neighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = (x + dx + state.cols) % state.cols;
                const ny = (y + dy + state.rows) % state.rows;
                neighbors += state.grid[ny * state.cols + nx];
              }
            }
            const idx = y * state.cols + x;
            const alive = state.grid[idx];
            next[idx] = alive ? (RULE_S.includes(neighbors) ? 1 : 0) : (RULE_B.includes(neighbors) ? 1 : 0);
            if (next[idx] !== alive) changed++;
          }
        }
        state.grid = next;
        if (changed < len * 0.02) {
          state.stagnantCount++;
          if (state.stagnantCount >= 5) {
            injectNoise();
            state.stagnantCount = 0;
          }
        } else {
          state.stagnantCount = 0;
        }
      }

      function stop() {
        state.running = false;
      }

      function loop() {
        if (!state.isAnimating) return;
        const time = performance.now();
        const dt = Math.min(time - state.lastTime, 100);
        state.lastTime = time;
        const targetSpeed = state.running ? 1 : 0;
        state.currentSpeed += (targetSpeed - state.currentSpeed) * 0.03;
        if (!state.running && state.currentSpeed < 0.005) {
          state.currentSpeed = 0;
          state.isAnimating = false;
        }
        state.accumulator += dt * state.currentSpeed;
        let maxSteps = 5;
        while (state.accumulator >= STEP_MS && maxSteps > 0) {
          step();
          state.accumulator -= STEP_MS;
          maxSteps--;
        }
        draw();
        if (state.isAnimating) requestAnimationFrame(loop);
      }

      function pulse(duration = 10000) {
        if (prefersReducedMotion) return;
        if (state.pulseTimer) clearTimeout(state.pulseTimer);
        state.running = true;
        if (!state.isAnimating) {
          state.lastTime = performance.now();
          state.isAnimating = true;
          requestAnimationFrame(loop);
        }
        state.pulseTimer = setTimeout(() => {
          state.pulseTimer = null;
          stop();
        }, duration);
      }

      addEventListener('resize', () => {
        resize();
        pulse(10000);
      });
      resize();
      pulse(10000);
    })();
  `;
}

export function renderNetworkApprovalPage(options = {}) {
  let text = serializeText(options.text, options);
  let requestId = String(options.requestId ?? '');
  let address = String(options.address ?? '');
  let waitEndpoint = String(options.waitEndpoint || '/api/network-auth/wait');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(text.title)}</title>
  <style>${createNetworkApprovalPageStyles()}</style>
</head>
<body>
  <div class="sn-network-approval-cell-bg" aria-hidden="true">
    <canvas id="sn-network-approval-canvas"></canvas>
  </div>
  <main>
    <h1>${escapeHtml(text.heading)}</h1>
    <p>${escapeHtml(text.message)}</p>
    <p>${escapeHtml(text.requestLabel)}: <code>${escapeHtml(requestId)}</code><br>${escapeHtml(text.addressLabel)}: <code>${escapeHtml(address)}</code></p>
    <p id="status">${escapeHtml(text.waitingStatus)}</p>
  </main>
  <script>${createNetworkApprovalCellBgScript()}</script>
  <script>
    const requestId = ${scriptJson(requestId)};
    const waitEndpoint = ${scriptJson(waitEndpoint)};
    const approvedStatus = ${scriptJson(text.approvedStatus)};
    const rejectedStatus = ${scriptJson(text.rejectedStatus)};
    async function poll() {
      try {
        const separator = waitEndpoint.includes('?') ? '&' : '?';
        const res = await fetch(waitEndpoint + separator + 'id=' + encodeURIComponent(requestId), { cache: 'no-store' });
        const data = await res.json();
        if (data.ok) {
          document.getElementById('status').textContent = approvedStatus;
          location.reload();
          return;
        }
        if (data.rejected) {
          document.getElementById('status').textContent = rejectedStatus;
          return;
        }
      } catch {}
      setTimeout(poll, 1500);
    }
    poll();
  </script>
</body>
</html>`;
}
