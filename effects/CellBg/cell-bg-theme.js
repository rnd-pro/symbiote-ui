export const CELL_BG_DEFAULTS = Object.freeze({
  cellSize: 14,
  stepMs: 75,
  minRadius: 2,
  maxRadius: 5,
  fadeRate: 0.04,
  paletteSize: 32,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const finiteNumber = (value, fallback) => {
  let next = Number.parseFloat(value);
  return Number.isFinite(next) ? next : fallback;
};

const hexChannel = (value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');

export function createCellBgPalette({
  bgRgb = [0, 0, 0],
  dotRgb = bgRgb,
  baseAlpha = 0,
  alphaSpan = 0,
  paletteSize = CELL_BG_DEFAULTS.paletteSize,
} = {}) {
  let size = Math.max(2, Math.round(finiteNumber(paletteSize, CELL_BG_DEFAULTS.paletteSize)));
  let palette = [];
  for (let i = 0; i < size; i++) {
    let t = i / (size - 1);
    let alpha = baseAlpha + t * alphaSpan;
    let r = bgRgb[0] * (1 - alpha) + dotRgb[0] * alpha;
    let g = bgRgb[1] * (1 - alpha) + dotRgb[1] * alpha;
    let b = bgRgb[2] * (1 - alpha) + dotRgb[2] * alpha;
    palette.push(`#${hexChannel(r)}${hexChannel(g)}${hexChannel(b)}`);
  }
  return palette;
}

export function readCellBgTheme(source, {
  readToken = () => '',
  readNumber = (_source, _token, fallback) => fallback,
  normalizeColor = (_source, value) => value || null,
  parseRgb = () => null,
} = {}) {
  let cellSize = Math.max(4, readNumber(source, '--sn-cell-size', CELL_BG_DEFAULTS.cellSize));
  let minRadius = Math.max(0.5, readNumber(source, '--sn-cell-min-radius', CELL_BG_DEFAULTS.minRadius));
  let maxRadius = Math.max(
    minRadius + 0.5,
    readNumber(source, '--sn-cell-max-radius', CELL_BG_DEFAULTS.maxRadius)
  );
  let stepMs = Math.max(24, readNumber(source, '--sn-cell-step-ms', CELL_BG_DEFAULTS.stepMs));
  let fadeRate = clamp(readNumber(source, '--sn-cell-fade-rate', CELL_BG_DEFAULTS.fadeRate), 0.01, 0.18);

  let bg = readToken(source, '--sn-cell-bg') || readToken(source, '--sn-bg');
  let dot = readToken(source, '--sn-cell-dot') || readToken(source, '--sn-text-dim');
  let bgRgb = parseRgb(source, bg) || [0, 0, 0];
  let dotRgb = parseRgb(source, dot) || bgRgb;
  let baseAlpha = finiteNumber(readToken(source, '--sn-cell-base-alpha'), 0);
  let alphaSpan = finiteNumber(readToken(source, '--sn-cell-alpha-span'), 0);

  return {
    cellSize,
    minRadius,
    maxRadius,
    stepMs,
    fadeRate,
    bgFill: normalizeColor(source, bg) || 'transparent',
    palette: createCellBgPalette({ bgRgb, dotRgb, baseAlpha, alphaSpan }),
  };
}
