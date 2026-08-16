/**
 * @file xr/meta-window-chrome.js
 * @description Renderer-neutral Meta Horizon window-chrome drawing helpers.
 * Canvas access is deferred until a texture is requested, so the module stays
 * safe to import from Node and SSR entrypoints.
 */

import { configureXRUITextureQuality } from './texture-quality.js';

export const META_WINDOW_CHROME_VERSION = 'meta-window-chrome-v1';

const CHROME_TEXTURE_KINDS = new Set([
  'grab-strip',
  'control-bar',
  'corner',
  'edge',
  'action-highlight',
  'island-toggle',
]);

const CORNER_FLIPS = Object.freeze({
  northWest: [1, 1],
  northEast: [-1, 1],
  southEast: [-1, -1],
  southWest: [1, -1],
});

function canvasFor(width, height, createCanvas) {
  if (typeof createCanvas === 'function') {
    let canvas = createCanvas(width, height);
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  return null;
}

function roundedRect(context, x, y, width, height, radius) {
  let r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawGlyph(context, action, centerX, centerY, size, color) {
  let radius = size / 2;
  context.save();
  context.translate(centerX - radius, centerY - radius);
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = Math.max(2, size * 0.075);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (action === 'pin') {
    context.beginPath();
    context.arc(radius, radius - size * 0.08, size * 0.105, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.moveTo(radius, radius + size * 0.04);
    context.lineTo(radius, radius + size * 0.24);
    context.stroke();
  } else if (action === 'reset') {
    context.beginPath();
    context.arc(radius, radius, size * 0.2, Math.PI * 0.12, Math.PI * 1.62);
    context.stroke();
    let angle = Math.PI * 1.62;
    let x = radius + Math.cos(angle) * size * 0.2;
    let y = radius + Math.sin(angle) * size * 0.2;
    context.beginPath();
    context.moveTo(x - size * 0.09, y - size * 0.015);
    context.lineTo(x, y);
    context.lineTo(x + size * 0.025, y - size * 0.1);
    context.stroke();
  } else if (action === 'close') {
    let arm = size * 0.14;
    context.beginPath();
    context.moveTo(radius - arm, radius - arm);
    context.lineTo(radius + arm, radius + arm);
    context.moveTo(radius + arm, radius - arm);
    context.lineTo(radius - arm, radius + arm);
    context.stroke();
  } else if (action === 'exit-xr') {
    let doorLeft = size * 0.28;
    let doorTop = size * 0.24;
    let doorWidth = size * 0.27;
    let doorHeight = size * 0.52;
    context.strokeRect(doorLeft, doorTop, doorWidth, doorHeight);
    let arrowY = radius;
    context.beginPath();
    context.moveTo(size * 0.43, arrowY);
    context.lineTo(size * 0.76, arrowY);
    context.moveTo(size * 0.64, arrowY - size * 0.12);
    context.lineTo(size * 0.76, arrowY);
    context.lineTo(size * 0.64, arrowY + size * 0.12);
    context.stroke();
  } else if (action === 'scale-down' || action === 'scale-up') {
    let arm = size * 0.2;
    context.beginPath();
    context.moveTo(radius - arm, radius);
    context.lineTo(radius + arm, radius);
    if (action === 'scale-up') {
      context.moveTo(radius, radius - arm);
      context.lineTo(radius, radius + arm);
    }
    context.stroke();
  } else if (action === 'aspect') {
    let left = size * 0.27;
    let top = size * 0.31;
    let width = size * 0.46;
    let height = size * 0.38;
    context.strokeRect(left, top, width, height);
    context.beginPath();
    context.moveTo(left + width * 0.18, top + height * 0.72);
    context.lineTo(left + width * 0.42, top + height * 0.48);
    context.lineTo(left + width * 0.58, top + height * 0.64);
    context.lineTo(left + width * 0.82, top + height * 0.35);
    context.stroke();
  } else if (action === 'planetary-gear') {
    context.beginPath();
    for (let index = 0; index < 16; index += 1) {
      let angle = -Math.PI / 2 + index * Math.PI / 8;
      let gearRadius = size * (index % 2 === 0 ? 0.25 : 0.2);
      let x = radius + Math.cos(angle) * gearRadius;
      let y = radius + Math.sin(angle) * gearRadius;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.stroke();
    context.beginPath();
    context.arc(radius, radius, size * 0.075, 0, Math.PI * 2);
    context.stroke();
  } else if (action === 'hover-engine') {
    context.beginPath();
    context.arc(radius, radius, size * 0.24, 0, Math.PI * 2);
    context.stroke();
    for (let index = 0; index < 3; index += 1) {
      let angle = index * Math.PI * 2 / 3;
      let innerX = radius + Math.cos(angle) * size * 0.055;
      let innerY = radius + Math.sin(angle) * size * 0.055;
      let outerX = radius + Math.cos(angle + 0.5) * size * 0.19;
      let outerY = radius + Math.sin(angle + 0.5) * size * 0.19;
      context.beginPath();
      context.moveTo(radius, radius);
      context.lineTo(innerX, innerY);
      context.lineTo(outerX, outerY);
      context.stroke();
    }
    context.beginPath();
    context.arc(radius, radius, size * 0.045, 0, Math.PI * 2);
    context.fill();
  } else if (action === 'lego-motor') {
    let left = size * 0.25;
    let top = size * 0.31;
    let width = size * 0.5;
    let height = size * 0.38;
    context.strokeRect(left, top, width, height);
    context.beginPath();
    context.arc(left + width * 0.28, radius, size * 0.075, 0, Math.PI * 2);
    context.arc(left + width * 0.72, radius, size * 0.075, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.moveTo(left + width, radius);
    context.lineTo(size * 0.84, radius);
    context.stroke();
  } else if (action === 'pneumatic-engine') {
    let left = size * 0.22;
    let top = size * 0.34;
    let width = size * 0.38;
    let height = size * 0.32;
    context.strokeRect(left, top, width, height);
    context.beginPath();
    context.moveTo(left + width * 0.3, top);
    context.lineTo(left + width * 0.3, top + height);
    context.moveTo(left + width, radius);
    context.lineTo(size * 0.82, radius);
    context.moveTo(size * 0.82, top + height * 0.22);
    context.lineTo(size * 0.82, top + height * 0.78);
    context.stroke();
  } else {
    let inset = size * 0.27;
    let arm = size * 0.12;
    context.beginPath();
    context.moveTo(inset + arm, inset);
    context.lineTo(inset, inset);
    context.lineTo(inset, inset + arm);
    context.moveTo(size - inset - arm, inset);
    context.lineTo(size - inset, inset);
    context.lineTo(size - inset, inset + arm);
    context.moveTo(inset, size - inset - arm);
    context.lineTo(inset, size - inset);
    context.lineTo(inset + arm, size - inset);
    context.moveTo(size - inset - arm, size - inset);
    context.lineTo(size - inset, size - inset);
    context.lineTo(size - inset, size - inset - arm);
    context.stroke();
  }
  context.restore();
}

function truncate(context, value, width) {
  let text = String(value || 'Window');
  if (typeof context.measureText !== 'function') return text;
  while (text.length > 1 && context.measureText(text).width > width) {
    text = `${text.slice(0, -2)}…`;
  }
  return text;
}

function drawControlBar(context, width, height, options) {
  let background = options.background || '#f5f5f5';
  let foreground = options.foreground || '#202020';
  let actions = Array.isArray(options.actions) ? options.actions : ['reset', 'fullscreen', 'pin', 'close'];
  let activeActions = new Set([
    ...(Array.isArray(options.activeActions) ? options.activeActions : []),
    ...(options.activeAction ? [options.activeAction] : []),
  ]);
  let inset = height * 0.11;
  roundedRect(context, inset, inset, width - inset * 2, height - inset * 2, height / 2);
  context.fillStyle = background;
  context.fill();

  let actionRects = Array.isArray(options.actionRects) ? options.actionRects : [];
  let actionWidth = height * 0.88;
  let actionArea = actions.length * actionWidth + height * 0.12;
  context.fillStyle = foreground;
  context.font = `600 ${Math.round(height * 0.29)}px Inter, -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textBaseline = 'middle';
  let labelLeft = height * 0.55;
  let actionStarts = actionRects
    .map((rect) => Number(rect?.x))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
  let labelRight = actionStarts.length
    ? Math.min(...actionStarts) * width
    : width - actionArea;
  let labelWidth = Math.max(0, labelRight - labelLeft - height * 0.12);
  context.fillText(truncate(context, options.title, labelWidth), labelLeft, height / 2);

  actions.forEach((action, index) => {
    let rect = actionRects.find((candidate) => candidate?.action === action);
    let centerX = rect
      ? (Number(rect.x) + Number(rect.width) / 2) * width
      : width - height * 0.28 - actionWidth * (actions.length - index - 0.5);
    let centerY = rect
      ? (Number(rect.y) + Number(rect.height) / 2) * height
      : height / 2;
    let highlightRadius = Math.max(0, Math.min(
      height * 0.29,
      centerX,
      width - centerX,
      centerY,
      height - centerY,
    ));
    if (activeActions.has(action) || action === options.hoveredAction) {
      context.globalAlpha = action === options.hoveredAction ? 0.2 : 0.12;
      context.beginPath();
      context.arc(centerX, centerY, highlightRadius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
    let glyphSize = Math.max(0, Math.min(
      height * 0.58,
      centerX * 2,
      (width - centerX) * 2,
      centerY * 2,
      (height - centerY) * 2,
    ));
    drawGlyph(context, action, centerX, centerY, glyphSize, foreground);
  });
}

function drawActionHighlight(context, width, height, color) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(width / 2, height / 2, Math.min(width, height) * 0.39, 0, Math.PI * 2);
  context.fill();
}

function drawCorner(context, width, height, handle, color) {
  let [flipX, flipY] = CORNER_FLIPS[handle] || [1, 1];
  context.save();
  context.translate(width / 2, height / 2);
  context.scale(flipX, flipY);
  context.translate(-width / 2, -height / 2);
  context.strokeStyle = color;
  context.lineWidth = width * 0.105;
  context.lineCap = 'round';
  let inset = width * 0.14;
  let arm = width * 0.48;
  let radius = width * 0.24;
  context.beginPath();
  context.moveTo(inset + arm, inset);
  context.arcTo(inset, inset, inset, inset + arm, radius);
  context.lineTo(inset, inset + arm);
  context.stroke();
  context.restore();
}

function drawEdge(context, width, height, edge, color) {
  context.save();
  if (edge === 'west' || edge === 'east') {
    context.translate(width / 2, height / 2);
    context.rotate(Math.PI / 2);
    context.translate(-height / 2, -width / 2);
    [width, height] = [height, width];
  }
  context.fillStyle = color;
  roundedRect(context, width * 0.12, height * 0.34, width * 0.76, height * 0.32, height * 0.16);
  context.fill();
  context.restore();
}

function drawGrabStrip(context, width, height, color) {
  context.fillStyle = color;
  let stripWidth = width * 0.72;
  let stripHeight = height * 0.32;
  roundedRect(
    context,
    (width - stripWidth) / 2,
    (height - stripHeight) / 2,
    stripWidth,
    stripHeight,
    stripHeight / 2,
  );
  context.fill();
}

function drawIslandToggle(context, width, height, background, foreground) {
  context.fillStyle = background;
  context.beginPath();
  context.arc(width / 2, height / 2, Math.min(width, height) * 0.45, 0, Math.PI * 2);
  context.fill();
  drawGlyph(context, 'reset', width / 2, height / 2, Math.min(width, height) * 0.72, foreground);
}

/**
 * Creates a transparent CanvasTexture for the Meta Horizon-style window shell.
 *
 * @param {Object} THREE Host Three namespace.
 * @param {'grab-strip'|'control-bar'|'corner'|'edge'|'action-highlight'|'island-toggle'} kind Visual kind.
 * @param {Object} [options] Drawing and theme options.
 * @returns {Object} CanvasTexture.
 * @throws {Error} When the requested kind, canvas context or Three texture API is unavailable.
 */
export function createMetaWindowChromeTexture(THREE, kind, options = {}) {
  if (!CHROME_TEXTURE_KINDS.has(kind)) {
    throw new TypeError(`Unknown Meta window chrome texture kind "${kind}".`);
  }
  if (typeof THREE?.CanvasTexture !== 'function') {
    throw new Error(`Meta window chrome "${kind}" requires THREE.CanvasTexture.`);
  }
  let dimensions = kind === 'control-bar' || kind === 'grab-strip'
    ? [2304, 384]
    : kind === 'edge' ? [768, 192] : [480, 480];
  if (options.aspect && (kind === 'control-bar' || kind === 'grab-strip')) {
    dimensions = [Math.round(384 * options.aspect), 384];
  }
  dimensions[0] = Math.max(32, Math.min(4096, dimensions[0]));
  dimensions[1] = Math.max(32, Math.min(4096, dimensions[1]));
  let canvas = canvasFor(dimensions[0], dimensions[1], options.createCanvas);
  let context = canvas?.getContext?.('2d');
  if (!context) {
    throw new Error(`Meta window chrome "${kind}" could not create a 2D canvas texture.`);
  }
  context.clearRect(0, 0, dimensions[0], dimensions[1]);
  if (kind === 'grab-strip') {
    drawGrabStrip(context, dimensions[0], dimensions[1], options.color || '#fff');
  } else if (kind === 'control-bar') {
    drawControlBar(context, dimensions[0], dimensions[1], options);
  } else if (kind === 'corner') {
    drawCorner(context, dimensions[0], dimensions[1], options.handle, options.color || '#fff');
  } else if (kind === 'edge') {
    drawEdge(context, dimensions[0], dimensions[1], options.edge, options.color || '#fff');
  } else if (kind === 'action-highlight') {
    drawActionHighlight(context, dimensions[0], dimensions[1], options.color || '#fff');
  } else if (kind === 'island-toggle') {
    drawIslandToggle(
      context,
      dimensions[0],
      dimensions[1],
      options.background || '#fff',
      options.foreground || '#202020',
    );
  }
  let texture = new THREE.CanvasTexture(canvas);
  return configureXRUITextureQuality(THREE, texture, {
    source: 'meta-window-chrome',
    kind,
    anisotropy: options.anisotropy ?? 4,
  });
}
