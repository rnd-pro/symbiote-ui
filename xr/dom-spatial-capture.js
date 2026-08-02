/**
 * @file xr/dom-spatial-capture.js
 * @description Browser-only DOM/CSSOM measurement adapters that capture a bounded,
 * explicitly opted-in Symbiote subtree into a renderer-neutral `spatial-snapshot-v1`.
 * The module is evaluation-safe in Node: every DOM touch happens inside functions.
 * Not a generic DOM converter — only registered adapters, explicit text selectors,
 * and explicit surface selectors are captured; everything else becomes structured
 * diagnostics.
 * @module symbiote-ui/xr/dom-spatial-capture
 */

import { SPATIAL_ICON_NAME_PATTERN, normalizeSpatialSnapshot } from './spatial-snapshot.js';

export const SPATIAL_CAPTURE_COMPONENTS = Object.freeze([
  'canvas-graph',
  'chat-transcript',
  'layout-node',
  'node-canvas',
  'sn-badge',
  'sn-data-table',
  'sn-description-list',
  'sn-metric',
  'sn-scroll-area',
  'sn-tree-panel',
  'source-editor',
  'source-viewer',
]);

export const SPATIAL_ICON_SELECTOR = '.material-symbols-outlined, .sn-tree-icon, .sn-tree-toggle';

export const SPATIAL_BORDER_MAX_WIDTH_PX = 2;

export const SPATIAL_TREE_CONTROLS = Object.freeze([
  Object.freeze({ selector: '.sn-tree-panel-collapse', actionId: 'collapse-all', intent: 'sn-tree-panel-collapse' }),
]);

const UNSUPPORTED_TAG_FEATURES = Object.freeze({
  canvas: 'canvas',
  svg: 'svg',
  video: 'media',
  iframe: 'iframe',
  img: 'media',
});

const SURFACE_STYLE_KEYS = Object.freeze(['background-color']);
const CONTROL_STYLE_KEYS = Object.freeze(['background-color', 'color']);
const BADGE_STYLE_KEYS = Object.freeze(['background-color', 'color', 'font-size', 'font-weight', 'line-height']);
const FIELD_STYLE_KEYS = Object.freeze(['background-color', 'color', 'font-family', 'font-size', 'line-height']);
const BORDER_SIDES = Object.freeze(['top', 'right', 'bottom', 'left']);
const TEXT_STYLE_KEYS = Object.freeze([
  'color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'direction',
  'white-space',
  'overflow',
  'text-overflow',
]);
const ICON_STYLE_KEYS = Object.freeze(['color', 'font-family', 'font-size', 'font-weight', 'font-style']);
const COLOR_STYLE_KEYS = Object.freeze(['background-color', 'color']);
const CANVAS_COLOR_SENTINELS = Object.freeze(['#010203', '#040506']);

/**
 * Creates a browser-native color normalizer that converts any browser-resolved CSS
 * color (including CSS Color 4 forms such as `oklch()`, `lab()`, or `color(...)`) into
 * a renderer-consumable `rgb()`/`rgba()` string. Conversion rasterizes a 1x1 Canvas 2D
 * tile in the default sRGB color space and reads the unpremultiplied pixels back, so
 * no custom CSS color parser is involved and alpha survives to 8-bit precision.
 * Values already in `rgb()`/`rgba()`/hex form pass through untouched. The factory is
 * evaluation-safe in Node: the canvas is created lazily inside the returned closure,
 * and without a usable document/2D context unconvertible values report `null`.
 *
 * @param {Document} doc - Document that owns the measured subtree.
 * @returns {(value: *) => (string|null)} Normalizer; `null` marks unconvertible input.
 */
export function createCanvasColorNormalizer(doc) {
  let context = null;
  let contextFailed = false;
  function resolveContext() {
    if (context || contextFailed) return context;
    let canvas = typeof doc?.createElement === 'function' ? doc.createElement('canvas') : null;
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
      context = canvas.getContext?.('2d', { willReadFrequently: true }) || null;
    }
    contextFailed = !context;
    return context;
  }
  return (value) => {
    if (typeof value !== 'string') return null;
    let trimmed = value.trim();
    if (!trimmed) return null;
    if (/^(#|rgba?\()/i.test(trimmed)) return trimmed;
    let ctx2d = resolveContext();
    if (!ctx2d) return null;
    let parsed = false;
    for (let sentinel of CANVAS_COLOR_SENTINELS) {
      ctx2d.fillStyle = sentinel;
      ctx2d.fillStyle = trimmed;
      if (ctx2d.fillStyle !== sentinel) {
        parsed = true;
        break;
      }
    }
    if (!parsed) return null;
    ctx2d.clearRect(0, 0, 1, 1);
    ctx2d.fillRect(0, 0, 1, 1);
    let [r, g, b, a] = ctx2d.getImageData(0, 0, 1, 1).data;
    if (a === 255) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${Math.round((a / 255) * 1000) / 1000})`;
  };
}

function isElement(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.tagName === 'string'
    && typeof value.getBoundingClientRect === 'function';
}

function createCaptureContext(root, options) {
  let rootRect = root.getBoundingClientRect();
  return {
    doc: root.ownerDocument,
    rootRect,
    viewport: {
      width: rootRect.width,
      height: rootRect.height,
    },
    route: options.route,
    themeScope: options.themeScope,
    textSelectors: Array.isArray(options.textSelectors) ? [...options.textSelectors] : [],
    surfaceSelectors: Array.isArray(options.surfaceSelectors) ? [...options.surfaceSelectors] : [],
    surfaceTextDepth: 0,
    clipRect: null,
    colorNormalizer: createCanvasColorNormalizer(root.ownerDocument),
    nodes: [],
    unsupported: [],
    unknownVisible: [],
    counters: new Map(),
    iconIds: new Set(),
    capturedIconElements: new Set(),
  };
}

function nextSequence(ctx, prefix) {
  let value = (ctx.counters.get(prefix) || 0) + 1;
  ctx.counters.set(prefix, value);
  return value;
}

function measureRect(ctx, element) {
  let rect = element.getBoundingClientRect();
  let width = rect.width;
  let height = rect.height;
  if (!(width > 0) || !(height > 0)) return null;
  let measured = {
    x: rect.left - ctx.rootRect.left,
    y: rect.top - ctx.rootRect.top,
    width,
    height,
  };
  if (!ctx.clipRect) return measured;
  let left = Math.max(measured.x, ctx.clipRect.x);
  let top = Math.max(measured.y, ctx.clipRect.y);
  let right = Math.min(measured.x + measured.width, ctx.clipRect.x + ctx.clipRect.width);
  let bottom = Math.min(measured.y + measured.height, ctx.clipRect.y + ctx.clipRect.height);
  if (!(right > left) || !(bottom > top)) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function intersectRects(first, second) {
  if (!first) return second ? { ...second } : null;
  if (!second) return first ? { ...first } : null;
  let left = Math.max(first.x, second.x);
  let top = Math.max(first.y, second.y);
  let right = Math.min(first.x + first.width, second.x + second.width);
  let bottom = Math.min(first.y + first.height, second.y + second.height);
  if (!(right > left) || !(bottom > top)) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function computedStyleOf(ctx, element) {
  let view = ctx.doc?.defaultView;
  return typeof view?.getComputedStyle === 'function' ? view.getComputedStyle(element) : null;
}

function readStyle(ctx, element, keys) {
  let computed = computedStyleOf(ctx, element);
  if (!computed) return undefined;
  let style = {};
  for (let key of keys) {
    let value = computed.getPropertyValue(key).trim();
    if (!value) continue;
    if (COLOR_STYLE_KEYS.includes(key)) {
      let normalized = ctx.colorNormalizer(value);
      if (normalized === null) {
        addUnsupported(ctx, 'unconvertible-color', element,
          `${key} "${value}" could not be converted to rgb()/rgba()`);
        continue;
      }
      value = normalized;
    }
    style[key] = value;
  }
  return Object.keys(style).length ? style : undefined;
}

function withStyle(node, style) {
  if (style !== undefined) node.style = style;
  return node;
}

function readSolidBorder(ctx, element, nodeId) {
  let computed = computedStyleOf(ctx, element);
  if (!computed) return undefined;
  let widths = [];
  let styles = [];
  let colors = [];
  for (let side of BORDER_SIDES) {
    widths.push(computed.getPropertyValue(`border-${side}-width`).trim());
    styles.push(computed.getPropertyValue(`border-${side}-style`).trim());
    colors.push(computed.getPropertyValue(`border-${side}-color`).trim());
  }
  let edges = [];
  let invalid = false;
  for (let index = 0; index < BORDER_SIDES.length; index += 1) {
    let width = Number.parseFloat(widths[index]);
    if (!(Number.isFinite(width) && width > 0)) continue;
    if (styles[index] !== 'solid' || width > SPATIAL_BORDER_MAX_WIDTH_PX || !colors[index]) {
      invalid = true;
      continue;
    }
    let color = ctx.colorNormalizer(colors[index]);
    if (color === null) {
      addUnsupported(ctx, 'unconvertible-color', element,
        `border-${BORDER_SIDES[index]}-color "${colors[index]}" could not be converted to rgb()/rgba()`);
      invalid = true;
      continue;
    }
    edges.push({ side: BORDER_SIDES[index], width, color });
  }
  if (!edges.length && !invalid) return undefined;
  if (invalid) {
    ctx.unsupported.push({
      feature: 'partial-border',
      ...(nodeId ? { nodeId } : {}),
      detail: 'partial-side, non-solid, or over-threshold borders are not reproduced natively',
    });
    return undefined;
  }
  if (edges.length === BORDER_SIDES.length
    && edges.every((edge) => edge.width === edges[0].width && edge.color === edges[0].color)) {
    return {
      'border-width': `${edges[0].width}px`,
      'border-style': 'solid',
      'border-color': edges[0].color,
    };
  }
  return Object.fromEntries(edges.flatMap((edge) => [
    [`border-${edge.side}-width`, `${edge.width}px`],
    [`border-${edge.side}-style`, 'solid'],
    [`border-${edge.side}-color`, edge.color],
  ]));
}

function readChromeStyle(ctx, element, nodeId, keys = SURFACE_STYLE_KEYS) {
  let style = readStyle(ctx, element, keys) || {};
  let border = readSolidBorder(ctx, element, nodeId);
  if (border) style = { ...style, ...border };
  return Object.keys(style).length ? style : undefined;
}

function addNode(ctx, node) {
  ctx.nodes.push(node);
  return node;
}

function addUnsupported(ctx, feature, element, detail) {
  ctx.unsupported.push({
    feature,
    ...(element?.id || element?.dataset?.panelId || element?.dataset?.treeId
      ? { nodeId: element.id || element.dataset.panelId || element.dataset.treeId }
      : {}),
    ...(detail ? { detail } : {}),
  });
}

function signatureOf(element) {
  let tag = element.tagName.toLowerCase();
  let className = typeof element.className === 'string' && element.className.trim()
    ? `.${element.className.trim().split(/\s+/)[0]}`
    : '';
  return `${tag}${className}`;
}

function recordUnknownVisible(ctx, element, detail) {
  ctx.unknownVisible.push({
    signature: signatureOf(element),
    ...(detail ? { detail } : {}),
  });
}

function hasOwnVisibleChrome(ctx, element) {
  let computed = computedStyleOf(ctx, element);
  if (!computed) return false;
  let background = computed.getPropertyValue('background-color').trim();
  if (background && background !== 'transparent' && background !== 'rgba(0, 0, 0, 0)') return true;
  let borderWidth = Number.parseFloat(computed.getPropertyValue('border-top-width'));
  return Number.isFinite(borderWidth) && borderWidth > 0;
}

function directTextOf(element) {
  let text = '';
  for (let child of element.childNodes) {
    if (child.nodeType === 3) text += child.textContent;
  }
  return text.trim();
}

function checkMotionDiagnostics(ctx, element) {
  let computed = computedStyleOf(ctx, element);
  if (!computed) return;
  let animation = computed.getPropertyValue('animation-name').trim();
  if (animation && animation !== 'none') {
    addUnsupported(ctx, 'animations/transitions', element, `animation "${animation}" is not reproduced`);
  }
}

function checkScrollDiagnostics(ctx, element, nodeId) {
  if (element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1) {
    ctx.unsupported.push({
      feature: 'native-scrollbars',
      nodeId,
      detail: 'scrollable region; scroll position and native scrollbars are not reproduced',
    });
  }
}

function matchesSelectorList(selectors, element) {
  return selectors.some((selector) => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}

function matchesIconSelector(element) {
  try {
    return typeof element.matches === 'function' && element.matches(SPATIAL_ICON_SELECTOR);
  } catch {
    return false;
  }
}

function textExcludingIcons(element) {
  let text = '';
  for (let child of element.childNodes || []) {
    if (child.nodeType === 3) {
      text += child.textContent;
      continue;
    }
    if (child.nodeType !== 1 || matchesIconSelector(child)) continue;
    text += textExcludingIcons(child);
  }
  return text.replace(/\s+/g, ' ').trim();
}

function uniqueChildId(ctx, parentId, key) {
  let base = `${parentId}/${key}`;
  let id = base;
  let suffix = 2;
  while (ctx.iconIds.has(id)) {
    id = `${base}:${suffix}`;
    suffix += 1;
  }
  ctx.iconIds.add(id);
  return id;
}

function iconNodeId(ctx, parentId, name) {
  return uniqueChildId(ctx, parentId, `icon:${name}`);
}

function captureIconElement(ctx, element, parentId, component) {
  if (ctx.capturedIconElements.has(element)) return;
  let rect = measureRect(ctx, element);
  let name = String(element.textContent || '').trim();
  if (!rect) return;
  if (!SPATIAL_ICON_NAME_PATTERN.test(name)) {
    addUnsupported(ctx, 'icon-glyph', element, `icon glyph "${name}" is not a Material Symbols ligature name`);
    return;
  }
  ctx.capturedIconElements.add(element);
  addNode(ctx, withStyle({
    id: iconNodeId(ctx, parentId, name),
    parentId,
    component,
    part: 'icon',
    rect,
    icon: { name },
  }, readStyle(ctx, element, ICON_STYLE_KEYS)));
}

function captureIconDescendants(ctx, container, parentId, component) {
  if (typeof container.querySelectorAll !== 'function') return;
  for (let icon of container.querySelectorAll(SPATIAL_ICON_SELECTOR)) {
    captureIconElement(ctx, icon, parentId, component);
  }
}

function captureTextElement(ctx, element, parentId) {
  let rect = measureRect(ctx, element);
  let text = textExcludingIcons(element);
  let textId = null;
  if (rect && text) {
    textId = `${parentId}/text:${nextSequence(ctx, `${parentId}/text`)}`;
    addNode(ctx, withStyle({
      id: textId,
      parentId,
      component: 'text',
      part: 'text',
      rect,
      text,
    }, readStyle(ctx, element, TEXT_STYLE_KEYS)));
  }
  captureIconDescendants(ctx, element, textId || parentId, 'icon');
}

function captureDirectSurfaceText(ctx, element, parentId) {
  let rect = measureRect(ctx, element);
  let text = directTextOf(element);
  if (!rect || !text) return;
  addNode(ctx, withStyle({
    id: `${parentId}/text:${nextSequence(ctx, `${parentId}/text`)}`,
    parentId,
    component: 'text',
    part: 'text',
    rect,
    text,
  }, readStyle(ctx, element, TEXT_STYLE_KEYS)));
}

function walkChildren(ctx, element, parentId) {
  for (let child of element.children) {
    walkElement(ctx, child, parentId);
  }
}

function captureSurfaceElement(ctx, element, parentId) {
  let rect = measureRect(ctx, element);
  if (!rect) return;
  checkMotionDiagnostics(ctx, element);
  let surfaceId = `${parentId}/surface:${nextSequence(ctx, `${parentId}/surface`)}`;
  addNode(ctx, withStyle({
    id: surfaceId,
    parentId,
    component: 'surface',
    part: 'surface',
    rect,
  }, readChromeStyle(ctx, element, surfaceId)));
  ctx.surfaceTextDepth += 1;
  // A number of ordinary HTML surfaces (notably chat bubbles) carry their
  // message as a direct text node rather than a nested <p> or <span>. Surface
  // capture must preserve that text without recapturing descendant labels.
  captureDirectSurfaceText(ctx, element, surfaceId);
  walkChildren(ctx, element, surfaceId);
  ctx.surfaceTextDepth -= 1;
}

function captureScrollChrome(ctx, element, parentId, id, part, component) {
  let rect = measureRect(ctx, element);
  if (!rect) return;
  addNode(ctx, withStyle({
    id: `${parentId}/${id}`,
    parentId,
    component,
    part,
    rect,
  }, readChromeStyle(ctx, element, `${parentId}/${id}`)));
}

// A bounded transcript or scroll area is a viewport, not a panel that grows
// along with its feed. Its native snapshot keeps only the visible slice of
// content. Interaction is relayed separately by the XR input layer; the
// capture contract stays purely measured and renderer-neutral.
function captureBoundedScrollViewport(element, ctx, parentId, options) {
  let component = options.component;
  let idSegment = options.idSegment;
  let hostRect = measureRect(ctx, element);
  if (!hostRect) return;
  let sequenceKey = `${parentId}/${idSegment}`;
  let scrollId = `${sequenceKey}:${nextSequence(ctx, sequenceKey)}`;
  let viewport = element.querySelector(options.viewportSelector) || element;
  let viewportRect = measureRect(ctx, viewport);
  if (!viewportRect) return;
  let scrollHeight = Number(viewport.scrollHeight) || viewportRect.height;
  let scrollWidth = Number(viewport.scrollWidth) || viewportRect.width;
  let clientHeight = Number(viewport.clientHeight) || viewportRect.height;
  let clientWidth = Number(viewport.clientWidth) || viewportRect.width;
  addNode(ctx, withStyle({
    id: scrollId,
    parentId,
    component,
    part: 'surface',
    rect: hostRect,
    state: {
      overflowX: scrollWidth > clientWidth + 1,
      overflowY: scrollHeight > clientHeight + 1,
      scrollLeft: Number(viewport.scrollLeft) || 0,
      scrollTop: Number(viewport.scrollTop) || 0,
    },
  }, readChromeStyle(ctx, element, scrollId)));
  // A transparent hit region is intentionally separate from the visible
  // track/thumb. Wheel and hand-scroll input land on the measured viewport,
  // while the product's relay resolves the target back to this scroll area.
  addNode(ctx, {
    id: `${scrollId}/viewport`,
    parentId: scrollId,
    component,
    part: 'control',
    rect: viewportRect,
    actions: [{ id: 'scroll-area', targetId: scrollId, intent: 'scroll-area' }],
  });

  let previousClip = ctx.clipRect;
  ctx.clipRect = intersectRects(previousClip, viewportRect);
  walkChildren(ctx, viewport, scrollId);
  ctx.clipRect = previousClip;

  if (!options.captureChrome) return;
  let vertical = element.querySelector('.sn-scrollbar-vertical');
  if (vertical) {
    captureScrollChrome(ctx, vertical, scrollId, 'vertical-track', 'surface', component);
    let thumb = vertical.querySelector?.('.sn-scrollbar-thumb');
    if (thumb) captureScrollChrome(ctx, thumb, scrollId, 'vertical-thumb', 'surface', component);
  }
  let horizontal = element.querySelector('.sn-scrollbar-horizontal');
  if (horizontal) {
    captureScrollChrome(ctx, horizontal, scrollId, 'horizontal-track', 'surface', component);
    let thumb = horizontal.querySelector?.('.sn-scrollbar-thumb');
    if (thumb) captureScrollChrome(ctx, thumb, scrollId, 'horizontal-thumb', 'surface', component);
  }
}

function captureScrollArea(element, ctx, parentId) {
  captureBoundedScrollViewport(element, ctx, parentId, {
    component: 'sn-scroll-area',
    idSegment: 'scroll-area',
    viewportSelector: '.sn-scroll-viewport',
    captureChrome: true,
  });
}

function captureChatTranscript(element, ctx, parentId) {
  captureBoundedScrollViewport(element, ctx, parentId, {
    component: 'chat-transcript',
    idSegment: 'chat-transcript',
    viewportSelector: '.chat-messages',
    captureChrome: false,
  });
}

function graphLayoutBounds(hostRect, element, nodes, index) {
  let width = Math.max(52, Math.min(hostRect.width * 0.26, 184));
  let height = Math.max(24, Math.min(hostRect.height * 0.13, 56));
  let positions = element?.nodePositions instanceof Map ? element.nodePositions : null;
  let positioned = nodes
    .map((node) => ({ node, point: positions?.get?.(node.id) || null }))
    .filter((entry) => Number.isFinite(Number(entry.point?.x)) && Number.isFinite(Number(entry.point?.y)));
  if (positioned.length === nodes.length && positioned.length > 1) {
    let xs = positioned.map((entry) => Number(entry.point.x));
    let ys = positioned.map((entry) => Number(entry.point.y));
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);
    let point = positioned[index]?.point;
    let ratioX = maxX === minX ? 0.5 : (Number(point.x) - minX) / (maxX - minX);
    let ratioY = maxY === minY ? 0.5 : (Number(point.y) - minY) / (maxY - minY);
    return {
      x: hostRect.x + Math.max(8, (hostRect.width - width - 16) * ratioX),
      y: hostRect.y + Math.max(8, (hostRect.height - height - 16) * ratioY),
      width,
      height,
    };
  }
  let columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length || 1)));
  let row = Math.floor(index / columns);
  let column = index % columns;
  let gap = 10;
  return {
    x: hostRect.x + gap + column * ((hostRect.width - gap * 2) / columns),
    y: hostRect.y + gap + row * (height + gap),
    width: Math.min(width, Math.max(1, (hostRect.width - gap * (columns + 1)) / columns)),
    height,
  };
}

// CanvasGraph owns its drawing surface, but its public nodes/edges model is
// semantic data rather than an image. Capture that model as measured native
// cards so XR never needs to sample the canvas itself.
function captureCanvasGraph(element, ctx, parentId) {
  let rect = measureRect(ctx, element);
  if (!rect) return;
  let graphId = `${parentId}/canvas-graph:${nextSequence(ctx, `${parentId}/canvas-graph`)}`;
  addNode(ctx, withStyle({
    id: graphId,
    parentId,
    component: 'canvas-graph',
    part: 'surface',
    rect,
  }, readChromeStyle(ctx, element, graphId)));
  let nodes = Array.isArray(element.nodes) ? element.nodes.filter((node) => node?.id) : [];
  let edges = Array.isArray(element.edges) ? element.edges : [];
  let summary = `${nodes.length} node${nodes.length === 1 ? '' : 's'} · ${edges.length} link${edges.length === 1 ? '' : 's'}`;
  addNode(ctx, withStyle({
    id: `${graphId}/summary`,
    parentId: graphId,
    component: 'canvas-graph',
    part: 'text',
    rect: { x: rect.x + 12, y: rect.y + 10, width: Math.max(1, rect.width - 24), height: Math.min(24, rect.height) },
    text: summary,
  }, readStyle(ctx, element, TEXT_STYLE_KEYS)));
  nodes.forEach((node, index) => {
    let rowId = `${graphId}/node:${String(node.id)}`;
    let nodeRect = graphLayoutBounds(rect, element, nodes, index);
    addNode(ctx, withStyle({
      id: rowId,
      parentId: graphId,
      component: 'canvas-graph',
      part: 'row',
      rect: nodeRect,
      actions: [{ id: 'select-node', targetId: String(node.id), intent: 'canvas-graph-select' }],
    }, readChromeStyle(ctx, element, rowId)));
    if (node.icon && SPATIAL_ICON_NAME_PATTERN.test(String(node.icon))) {
      addNode(ctx, withStyle({
        id: `${rowId}/icon:${node.icon}`,
        parentId: rowId,
        component: 'canvas-graph',
        part: 'icon',
        rect: { x: nodeRect.x + 6, y: nodeRect.y + 4, width: Math.min(20, nodeRect.height), height: Math.min(20, nodeRect.height) },
        icon: { name: String(node.icon) },
      }, readStyle(ctx, element, ICON_STYLE_KEYS)));
    }
    addNode(ctx, withStyle({
      id: `${rowId}/label`,
      parentId: rowId,
      component: 'canvas-graph',
      part: 'row-label',
      rect: {
        x: nodeRect.x + (node.icon ? Math.min(26, nodeRect.width * 0.25) : 7),
        y: nodeRect.y + 3,
        width: Math.max(1, nodeRect.width - (node.icon ? Math.min(30, nodeRect.width * 0.3) : 14)),
        height: Math.max(1, nodeRect.height - 6),
      },
      text: String(node.label || node.id),
    }, readStyle(ctx, element, TEXT_STYLE_KEYS)));
  });
}

// NodeCanvas already lays its graph nodes out as measurable DOM. We preserve
// those positions and semantic labels, while intentionally omitting its SVG
// connector and private media placeholders from the native scene.
function captureNodeCanvas(element, ctx, parentId) {
  let rect = measureRect(ctx, element);
  if (!rect) return;
  let canvasId = `${parentId}/node-canvas:${nextSequence(ctx, `${parentId}/node-canvas`)}`;
  addNode(ctx, withStyle({
    id: canvasId,
    parentId,
    component: 'node-canvas',
    part: 'surface',
    rect,
  }, readChromeStyle(ctx, element, canvasId)));
  let rows = [...element.querySelectorAll?.('graph-node') || []];
  for (let [index, row] of rows.entries()) {
    let rowRect = measureRect(ctx, row);
    if (!rowRect) continue;
    let nodeKey = row.dataset?.nodeId || row.getAttribute?.('data-id') || index;
    let rowId = `${canvasId}/node:${nodeKey}`;
    addNode(ctx, withStyle({
      id: rowId,
      parentId: canvasId,
      component: 'node-canvas',
      part: 'row',
      rect: rowRect,
      actions: [{ id: 'select-node', targetId: String(nodeKey), intent: 'node-canvas-select' }],
    }, readChromeStyle(ctx, row, rowId)));
    let text = textExcludingIcons(row);
    if (text) {
      addNode(ctx, withStyle({
        id: `${rowId}/label`,
        parentId: rowId,
        component: 'node-canvas',
        part: 'row-label',
        rect: rowRect,
        text,
      }, readStyle(ctx, row, TEXT_STYLE_KEYS)));
    }
    captureIconDescendants(ctx, row, rowId, 'node-canvas');
  }
}

function walkElement(ctx, element, parentId) {
  let tag = element.tagName.toLowerCase();
  if (UNSUPPORTED_TAG_FEATURES[tag]) {
    addUnsupported(ctx, UNSUPPORTED_TAG_FEATURES[tag], element, `<${tag}> is not reproduced natively`);
    return;
  }
  let adapter = SPATIAL_CAPTURE_ADAPTERS[tag];
  if (adapter) {
    adapter.capture(element, ctx, parentId);
    return;
  }
  if (matchesIconSelector(element)) {
    captureIconElement(ctx, element, parentId, 'icon');
    return;
  }
  if (ctx.surfaceSelectors.length && matchesSelectorList(ctx.surfaceSelectors, element)) {
    captureSurfaceElement(ctx, element, parentId);
    return;
  }
  if (ctx.textSelectors.length && matchesSelectorList(ctx.textSelectors, element)) {
    captureTextElement(ctx, element, parentId);
    return;
  }
  // Invisible templates routinely retain enter/spin animation declarations.
  // They have no native visual output, so they must not hold an otherwise
  // complete capture in a partial-fidelity state.
  // Some Web Components deliberately make their host a zero-size structural
  // wrapper while their light-DOM children own the visible geometry. The
  // Maximo chat's `chat-message-item` is one such component. A zero-sized
  // wrapper contributes no primitive of its own, but it must not terminate
  // traversal or its visible descendants disappear from the native panel.
  if (!measureRect(ctx, element)) {
    walkChildren(ctx, element, parentId);
    return;
  }
  checkMotionDiagnostics(ctx, element);
  let hasChildren = element.children.length > 0;
  if (ctx.surfaceTextDepth > 0 && directTextOf(element)) {
    captureTextElement(ctx, element, parentId);
    return;
  }
  if (hasOwnVisibleChrome(ctx, element) || (!hasChildren && directTextOf(element))) {
    recordUnknownVisible(ctx, element, directTextOf(element).slice(0, 60) || undefined);
  }
  walkChildren(ctx, element, parentId);
}

function captureLayoutNode(element, ctx, parentId) {
  let nodeType = element.getAttribute('node-type');
  if (nodeType === 'split') {
    let splitView = element.querySelector(':scope > .split-view');
    if (!splitView) return;
    let direction = element.getAttribute('direction') || 'horizontal';
    let resizer = splitView.querySelector(':scope > .split-resizer');
    if (resizer) {
      let rect = measureRect(ctx, resizer);
      if (rect) {
        let id = `split:${direction}/resizer:${nextSequence(ctx, `resizer:${direction}`)}`;
        addNode(ctx, withStyle({
          id,
          parentId,
          component: 'layout-node',
          part: 'resizer',
          rect,
          state: { direction },
          actions: [{ id: 'drag-resizer', targetId: id, intent: 'layout-resize' }],
        }, readChromeStyle(ctx, resizer, id)));
      }
    }
    walkChildren(ctx, splitView, parentId);
    return;
  }
  if (nodeType !== 'panel') {
    walkChildren(ctx, element, parentId);
    return;
  }
  let panelComponent = element.querySelector(':scope > .panel-view > .panel-content > [data-panel-id]');
  let panelKey = panelComponent?.dataset?.panelId
    || panelComponent?.tagName?.toLowerCase()
    || `anonymous-${nextSequence(ctx, 'panel')}`;
  let panelId = `panel:${panelKey}`;
  let rect = measureRect(ctx, element);
  if (!rect) return;
  let collapsed = element.hasAttribute('collapsed') || element.hasAttribute('auto-collapsed');
  addNode(ctx, withStyle({
    id: panelId,
    parentId,
    component: 'layout-node',
    part: 'panel',
    rect,
    state: { collapsed },
  }, readChromeStyle(ctx, element, panelId)));

  let header = element.querySelector(':scope > .panel-view > .panel-header');
  if (header) {
    let headerRect = measureRect(ctx, header);
    if (headerRect) {
      addNode(ctx, withStyle({
        id: `${panelId}/header`,
        parentId: panelId,
        component: 'layout-node',
        part: 'header',
        rect: headerRect,
      }, readChromeStyle(ctx, header, `${panelId}/header`)));
    }
    let title = header.querySelector('.panel-title');
    if (title) {
      let titleRect = measureRect(ctx, title);
      let text = textExcludingIcons(title);
      if (titleRect && text) {
        addNode(ctx, withStyle({
          id: `${panelId}/title`,
          parentId: panelId,
          component: 'layout-node',
          part: 'title',
          rect: titleRect,
          text,
        }, readStyle(ctx, title, TEXT_STYLE_KEYS)));
      }
    }
    captureHeaderButtons(ctx, header, panelId);
  }
  if (collapsed) return;
  let content = element.querySelector(':scope > .panel-view > .panel-content');
  if (content) walkChildren(ctx, content, panelId);
}

export const SPATIAL_HEADER_CONTROLS = Object.freeze([
  Object.freeze({ selector: '.collapse-btn', actionId: 'toggle-collapse', intent: 'panel-collapse-toggle' }),
  Object.freeze({ selector: '.fullscreen-btn', actionId: 'toggle-fullscreen', intent: 'panel-fullscreen' }),
  Object.freeze({ selector: '.panel-menu-toggle', actionId: 'open-panel-menu', intent: 'panel-menu' }),
  Object.freeze({ selector: '.type-btn', actionId: 'open-type-menu', intent: 'panel-type-menu' }),
]);

/**
 * Resolves the live DOM header control selector for a captured header intent, so
 * native activation relays to the exact button the intent was captured from.
 *
 * @param {string} intent - Captured action intent.
 * @returns {string} DOM selector of the matching header control.
 */
export function resolveHeaderControlSelector(intent) {
  let control = SPATIAL_HEADER_CONTROLS.find((entry) => entry.intent === intent);
  if (!control) {
    throw new Error(
      `Unknown header control intent "${intent}". ` +
      `Supported: ${SPATIAL_HEADER_CONTROLS.map((entry) => entry.intent).join(', ')}.`,
    );
  }
  return control.selector;
}

function captureHeaderButtons(ctx, header, panelId) {
  for (let { selector, actionId, intent } of SPATIAL_HEADER_CONTROLS) {
    let button = header.querySelector(selector);
    if (!button) continue;
    let rect = measureRect(ctx, button);
    if (!rect) continue;
    let controlId = `${panelId}/control:${actionId}`;
    addNode(ctx, withStyle({
      id: controlId,
      parentId: panelId,
      component: 'layout-node',
      part: 'control',
      rect,
      actions: [{ id: actionId, targetId: panelId, intent }],
    }, readChromeStyle(ctx, button, controlId, CONTROL_STYLE_KEYS)));
    captureIconDescendants(ctx, button, controlId, 'layout-node');
  }
}

function captureChromeRow(ctx, element, parentId, id) {
  let rect = measureRect(ctx, element);
  if (!rect) return;
  addNode(ctx, withStyle({
    id: `${parentId}/${id}`,
    parentId,
    component: 'sn-tree-panel',
    part: 'surface',
    rect,
  }, readChromeStyle(ctx, element, `${parentId}/${id}`)));
}

function captureTreePanel(element, ctx, parentId) {
  let hostRect = measureRect(ctx, element);
  if (hostRect) {
    addNode(ctx, withStyle({
      id: `${parentId}/tree-host`,
      parentId,
      component: 'sn-tree-panel',
      part: 'surface',
      rect: hostRect,
    }, readChromeStyle(ctx, element, `${parentId}/tree-host`)));
  }
  let titleRow = element.querySelector('.sn-tree-panel-title');
  if (titleRow && !titleRow.hidden) {
    captureChromeRow(ctx, titleRow, parentId, 'tree-title-row');
    let rect = measureRect(ctx, titleRow);
    let text = textExcludingIcons(titleRow);
    if (rect && text) {
      let titleId = `${parentId}/tree-title`;
      addNode(ctx, withStyle({
        id: titleId,
        parentId,
        component: 'sn-tree-panel',
        part: 'title',
        rect,
        text,
      }, readStyle(ctx, titleRow, TEXT_STYLE_KEYS)));
      captureIconDescendants(ctx, titleRow, titleId, 'sn-tree-panel');
    }
  }
  let toolbar = element.querySelector('.sn-tree-panel-toolbar');
  if (toolbar) {
    captureChromeRow(ctx, toolbar, parentId, 'tree-toolbar');
    for (let { selector, actionId, intent } of SPATIAL_TREE_CONTROLS) {
      let button = toolbar.querySelector(selector);
      if (!button) continue;
      let rect = measureRect(ctx, button);
      if (!rect) continue;
      let controlId = `${parentId}/control:${actionId}`;
      addNode(ctx, withStyle({
        id: controlId,
        parentId,
        component: 'sn-tree-panel',
        part: 'control',
        rect,
        actions: [{ id: actionId, targetId: parentId, intent }],
      }, readChromeStyle(ctx, button, controlId, CONTROL_STYLE_KEYS)));
      captureIconDescendants(ctx, button, controlId, 'sn-tree-panel');
    }
    captureIconDescendants(ctx, toolbar, parentId, 'sn-tree-panel');
  }
  let filter = element.querySelector('.sn-tree-panel-filter');
  if (filter && measureRect(ctx, filter)) {
    let fieldId = `${parentId}/field:filter`;
    let proxyText = String(filter.value || '') || String(filter.placeholder || '');
    addNode(ctx, withStyle({
      id: fieldId,
      parentId,
      component: 'sn-tree-panel',
      part: 'field',
      rect: measureRect(ctx, filter),
      ...(proxyText ? { text: proxyText } : {}),
    }, readChromeStyle(ctx, filter, fieldId, FIELD_STYLE_KEYS)));
    ctx.unsupported.push({
      feature: 'text-input',
      nodeId: `${parentId}/filter`,
      detail: 'tree filter input; IME/editing is not reproduced natively',
    });
  }
  let rows = element.querySelectorAll('.sn-tree-row');
  for (let row of rows) {
    captureTreeRow(ctx, row, parentId);
  }
}

function captureTreeRow(ctx, row, parentId) {
  let rect = measureRect(ctx, row);
  if (!rect) return;
  let treeId = row.dataset?.treeId || `row-${nextSequence(ctx, `${parentId}/row`)}`;
  let rowId = `${parentId}/row:${treeId}`;
  addNode(ctx, withStyle({
    id: rowId,
    parentId,
    component: 'sn-tree-panel',
    part: 'row',
    rect,
    state: {
      selected: row.getAttribute('aria-selected') === 'true',
      expanded: row.getAttribute('aria-expanded') === 'true',
    },
    actions: [{ id: 'select-row', targetId: treeId, intent: 'sn-tree-select' }],
  }, readChromeStyle(ctx, row, rowId)));
  let toggle = row.querySelector('.sn-tree-toggle:not([hidden])');
  if (toggle) {
    let toggleRect = measureRect(ctx, toggle);
    if (toggleRect) {
      let controlId = `${rowId}/control:toggle-row`;
      addNode(ctx, withStyle({
        id: controlId,
        parentId: rowId,
        component: 'sn-tree-panel',
        part: 'control',
        rect: toggleRect,
        actions: [{ id: 'toggle-row', targetId: treeId, intent: 'sn-tree-toggle' }],
      }, readChromeStyle(ctx, toggle, controlId, CONTROL_STYLE_KEYS)));
      captureIconElement(ctx, toggle, controlId, 'sn-tree-panel');
    }
  }
  let rowIcon = row.querySelector('.sn-tree-icon');
  if (rowIcon && !rowIcon.hidden) {
    captureIconElement(ctx, rowIcon, rowId, 'sn-tree-panel');
  }
  let label = row.querySelector('.sn-tree-label');
  if (label) {
    let labelRect = measureRect(ctx, label);
    let text = textExcludingIcons(label);
    if (labelRect && text) {
      addNode(ctx, withStyle({
        id: `${rowId}/label`,
        parentId: rowId,
        component: 'sn-tree-panel',
        part: 'row-label',
        rect: labelRect,
        text,
      }, readStyle(ctx, label, TEXT_STYLE_KEYS)));
    }
  }
  if (typeof row.querySelectorAll === 'function') {
    for (let badge of row.querySelectorAll('.sn-tree-badge')) {
      let badgeRect = measureRect(ctx, badge);
      let text = String(badge.textContent || '').trim();
      if (!badgeRect || !text) continue;
      let badgeId = uniqueChildId(ctx, rowId, `badge:${text}`);
      addNode(ctx, withStyle({
        id: badgeId,
        parentId: rowId,
        component: 'sn-tree-panel',
        part: 'badge',
        rect: badgeRect,
        text,
      }, readChromeStyle(ctx, badge, badgeId, BADGE_STYLE_KEYS)));
    }
  }
}

function captureSourceEditor(element, ctx, parentId) {
  let textarea = element.querySelector('textarea');
  if (!textarea) return;
  let rect = measureRect(ctx, textarea);
  if (!rect) return;
  let editorId = `${parentId}/editor`;
  addNode(ctx, withStyle({
    id: editorId,
    parentId,
    component: 'source-editor',
    part: 'editor',
    rect,
    text: textarea.value,
    state: {
      language: element.getAttribute('data-language') || '',
      readOnly: textarea.readOnly,
    },
  }, readChromeStyle(ctx, textarea, editorId, [...TEXT_STYLE_KEYS, ...SURFACE_STYLE_KEYS])));
  ctx.unsupported.push({
    feature: 'ime-editing',
    nodeId: editorId,
    detail: 'caret, selection, and IME editing stay in the live DOM editor',
  });
  checkScrollDiagnostics(ctx, textarea, editorId);
}

// Description items deliberately use `display: contents`, so their own boxes
// cannot be measured. The list adapter captures the rendered dt/dd pair that
// owns the actual geometry instead of relying on a generic DOM walk to happen
// to reach it. This keeps labels and values independently readable in a
// native panel and preserves their distinct computed text styles.
function captureDescriptionList(element, ctx, parentId) {
  let listRect = measureRect(ctx, element);
  if (!listRect) return;
  let listId = `${parentId}/description-list:${nextSequence(ctx, `${parentId}/description-list`)}`;
  addNode(ctx, withStyle({
    id: listId,
    parentId,
    component: 'sn-description-list',
    part: 'surface',
    rect: listRect,
  }, readChromeStyle(ctx, element, listId)));
  for (let [index, item] of [...element.querySelectorAll('sn-description-item')].entries()) {
    let itemId = `${listId}/item:${index}`;
    let label = item.querySelector('.sn-description-label');
    let labelRect = label && measureRect(ctx, label);
    let labelText = label && textExcludingIcons(label);
    if (labelRect && labelText) {
      addNode(ctx, withStyle({
        id: `${itemId}/label`,
        parentId: listId,
        component: 'sn-description-list',
        part: 'row-label',
        rect: labelRect,
        text: labelText,
      }, readStyle(ctx, label, TEXT_STYLE_KEYS)));
      captureIconDescendants(ctx, label, `${itemId}/label`, 'sn-description-list');
    }
    let value = item.querySelector('.sn-description-value');
    let valueRect = value && measureRect(ctx, value);
    let valueText = value && textExcludingIcons(value);
    if (valueRect && valueText) {
      addNode(ctx, withStyle({
        id: `${itemId}/value`,
        parentId: listId,
        component: 'sn-description-list',
        part: 'row-label',
        rect: valueRect,
        text: valueText,
      }, readStyle(ctx, value, TEXT_STYLE_KEYS)));
      captureIconDescendants(ctx, value, `${itemId}/value`, 'sn-description-list');
    }
  }
}

function captureBadge(element, ctx, parentId) {
  let rect = measureRect(ctx, element);
  if (!rect) return;
  let badgeId = `${parentId}/badge:${nextSequence(ctx, `${parentId}/badge`)}`;
  let text = textExcludingIcons(element);
  addNode(ctx, withStyle({
    id: badgeId,
    parentId,
    component: 'sn-badge',
    part: 'badge',
    rect,
    ...(text ? { text } : {}),
  }, readChromeStyle(ctx, element, badgeId, BADGE_STYLE_KEYS)));
  captureIconDescendants(ctx, element, badgeId, 'sn-badge');
}

function captureMetric(element, ctx, parentId) {
  let rect = measureRect(ctx, element);
  if (!rect) return;
  let metricId = `${parentId}/metric:${nextSequence(ctx, `${parentId}/metric`)}`;
  addNode(ctx, withStyle({
    id: metricId,
    parentId,
    component: 'sn-metric',
    part: 'surface',
    rect,
  }, readChromeStyle(ctx, element, metricId)));
  for (let [part, selector] of Object.entries({ label: '.sn-metric-label', value: '.sn-metric-value' })) {
    let child = element.querySelector(selector);
    let childRect = child && measureRect(ctx, child);
    let text = child && textExcludingIcons(child);
    if (!childRect || !text) continue;
    let textId = `${metricId}/${part}`;
    addNode(ctx, withStyle({
      id: textId,
      parentId: metricId,
      component: 'sn-metric',
      part: 'row-label',
      rect: childRect,
      text,
    }, readStyle(ctx, child, TEXT_STYLE_KEYS)));
    captureIconDescendants(ctx, child, textId, 'sn-metric');
  }
}

function sourceViewerText(element, attributes = []) {
  let text = String(element?.textContent || '').trim();
  if (text) return text;
  for (let attribute of attributes) {
    let value = element?.getAttribute?.(attribute);
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
}

function sourceViewerLineHeight(ctx, element) {
  let computed = computedStyleOf(ctx, element);
  let lineHeight = Number.parseFloat(computed?.getPropertyValue?.('line-height'));
  if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
  let fontSize = Number.parseFloat(computed?.getPropertyValue?.('font-size'));
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.35 : 16;
}

function visibleSourceViewerText(ctx, element, viewport) {
  let text = sourceViewerText(element);
  if (!text) return '';
  let lines = text.split('\n');
  let lineHeight = sourceViewerLineHeight(ctx, element);
  let start = Math.max(0, Math.floor((Number(viewport?.scrollTop) || 0) / lineHeight));
  let visibleLines = Math.max(1, Math.ceil((Number(viewport?.clientHeight) || 0) / lineHeight) + 1);
  return lines.slice(start, start + visibleLines).join('\n');
}

function sourceViewerActionId(element, index) {
  let className = String(element?.className || '');
  if (className.includes('sv-save-action')) return 'save';
  if (className.includes('sv-graph-action')) return 'show-graph';
  if (className.includes('sv-toggle-action')) return 'toggle-mode';
  return `action:${index}`;
}

// A source viewer has a real scroll viewport and visible shell controls. It
// cannot be treated as one generic surface: the code block may contain many
// thousands of lines, while only the viewport's current slice belongs in a
// readable native panel.
function captureSourceViewerSyntaxTokens(ctx, code, parentId) {
  if (typeof code?.querySelectorAll !== 'function') return 0;
  let captured = 0;
  for (let token of code.querySelectorAll('*')) {
    // Syntax highlighters conventionally emit leaf spans. Capturing only their
    // direct text prevents a nested scope from duplicating its child tokens.
    if (token.children?.length) continue;
    let text = directTextOf(token);
    let rect = measureRect(ctx, token);
    if (!text || !rect) continue;
    let tokenId = `${parentId}/token:${nextSequence(ctx, `${parentId}/token`)}`;
    addNode(ctx, withStyle({
      id: tokenId,
      parentId,
      component: 'source-viewer',
      part: 'token',
      rect,
      text,
    }, readStyle(ctx, token, TEXT_STYLE_KEYS)));
    captured += 1;
  }
  return captured;
}

function captureSourceViewer(element, ctx, parentId) {
  let hostRect = measureRect(ctx, element);
  if (!hostRect) return;
  let viewerId = `${parentId}/source-viewer:${nextSequence(ctx, `${parentId}/source-viewer`)}`;
  addNode(ctx, withStyle({
    id: viewerId,
    parentId,
    component: 'source-viewer',
    part: 'surface',
    rect: hostRect,
  }, readChromeStyle(ctx, element, viewerId)));

  let header = element.querySelector('.sv-header');
  if (header) {
    let headerRect = measureRect(ctx, header);
    if (headerRect) {
      let headerId = `${viewerId}/header`;
      addNode(ctx, withStyle({
        id: headerId,
        parentId: viewerId,
        component: 'source-viewer',
        part: 'header',
        rect: headerRect,
      }, readChromeStyle(ctx, header, headerId)));
      let filename = header.querySelector('.sv-filename');
      let filenameRect = filename && measureRect(ctx, filename);
      let filenameText = sourceViewerText(filename, ['data-source-text', 'data-label']);
      if (filenameRect && filenameText) {
        addNode(ctx, withStyle({
          id: `${viewerId}/title`,
          parentId: viewerId,
          component: 'source-viewer',
          part: 'title',
          rect: filenameRect,
          text: filenameText,
        }, readStyle(ctx, filename, TEXT_STYLE_KEYS)));
      }
      let stats = header.querySelector('.sv-stats');
      let statsRect = stats && measureRect(ctx, stats);
      let statsText = sourceViewerText(stats, ['data-source-text']);
      if (statsRect && statsText) {
        addNode(ctx, withStyle({
          id: `${viewerId}/stats`,
          parentId: viewerId,
          component: 'source-viewer',
          part: 'row-label',
          rect: statsRect,
          text: statsText,
        }, readStyle(ctx, stats, TEXT_STYLE_KEYS)));
      }
      for (let [index, action] of [...header.querySelectorAll('.sv-action:not([hidden])')].entries()) {
        let actionRect = measureRect(ctx, action);
        if (!actionRect) continue;
        let actionId = sourceViewerActionId(action, index);
        let controlId = `${viewerId}/control:${actionId}`;
        addNode(ctx, withStyle({
          id: controlId,
          parentId: viewerId,
          component: 'source-viewer',
          part: 'control',
          rect: actionRect,
          actions: [{ id: actionId, targetId: viewerId, intent: `source-viewer-${actionId}` }],
        }, readChromeStyle(ctx, action, controlId, CONTROL_STYLE_KEYS)));
        captureIconDescendants(ctx, action, controlId, 'source-viewer');
        let label = action.querySelector('.sv-action-label');
        let labelRect = label && measureRect(ctx, label);
        let labelText = sourceViewerText(label, ['data-label']);
        if (labelRect && labelText) {
          addNode(ctx, withStyle({
            id: `${controlId}/label`,
            parentId: controlId,
            component: 'source-viewer',
            part: 'row-label',
            rect: labelRect,
            text: labelText,
          }, readStyle(ctx, label, TEXT_STYLE_KEYS)));
        }
      }
    }
  }

  let viewport = element.querySelector('.cb-scroll');
  if (!viewport) return;
  let viewportRect = measureRect(ctx, viewport);
  if (!viewportRect) return;
  let scrollId = `${viewerId}/scroll`;
  let scrollHeight = Number(viewport.scrollHeight) || viewportRect.height;
  let scrollWidth = Number(viewport.scrollWidth) || viewportRect.width;
  let clientHeight = Number(viewport.clientHeight) || viewportRect.height;
  let clientWidth = Number(viewport.clientWidth) || viewportRect.width;
  addNode(ctx, withStyle({
    id: scrollId,
    parentId: viewerId,
    component: 'source-viewer',
    part: 'surface',
    rect: viewportRect,
    state: {
      overflowX: scrollWidth > clientWidth + 1,
      overflowY: scrollHeight > clientHeight + 1,
      scrollLeft: Number(viewport.scrollLeft) || 0,
      scrollTop: Number(viewport.scrollTop) || 0,
    },
  }, readChromeStyle(ctx, viewport, scrollId)));
  addNode(ctx, {
    id: `${scrollId}/viewport`,
    parentId: scrollId,
    component: 'source-viewer',
    part: 'control',
    rect: viewportRect,
    actions: [{ id: 'scroll-area', targetId: scrollId, intent: 'scroll-area' }],
  });

  let code = viewport.querySelector('.cb-pre code') || viewport.querySelector('code') || viewport;
  let gutter = viewport.querySelector('.cb-gutter');
  let previousClip = ctx.clipRect;
  ctx.clipRect = intersectRects(previousClip, viewportRect);
  let gutterRect = gutter && measureRect(ctx, gutter);
  let gutterText = gutter && visibleSourceViewerText(ctx, gutter, viewport);
  if (gutterRect && gutterText) {
    addNode(ctx, withStyle({
      id: `${scrollId}/gutter`,
      parentId: scrollId,
      component: 'source-viewer',
      part: 'row-label',
      rect: gutterRect,
      text: gutterText,
    }, readChromeStyle(ctx, gutter, `${scrollId}/gutter`, [...TEXT_STYLE_KEYS, ...SURFACE_STYLE_KEYS])));
  }
  let codeRect = measureRect(ctx, code);
  let codeText = visibleSourceViewerText(ctx, code, viewport);
  if (codeRect && codeText) {
    let editorId = `${scrollId}/editor`;
    addNode(ctx, withStyle({
      id: editorId,
      parentId: scrollId,
      component: 'source-viewer',
      part: 'editor',
      rect: codeRect,
      text: codeText,
      state: {
        language: element.getAttribute('data-language') || '',
        readOnly: true,
      },
      }, readChromeStyle(ctx, code, editorId, [...TEXT_STYLE_KEYS, ...SURFACE_STYLE_KEYS])));
    let syntaxTokenCount = captureSourceViewerSyntaxTokens(ctx, code, editorId);
    if (code.querySelectorAll?.('*').length && !syntaxTokenCount) {
      ctx.unsupported.push({
        feature: 'syntax-highlighting',
        nodeId: editorId,
        detail: 'source syntax tokens have no measurable text bounds for native rendering',
      });
    }
  }
  ctx.clipRect = previousClip;
}

function captureDataTableText(ctx, element, parentId, id, component = 'sn-data-table') {
  let rect = measureRect(ctx, element);
  let text = textExcludingIcons(element);
  if (!rect || !text) return;
  addNode(ctx, withStyle({
    id: `${parentId}/${id}`,
    parentId,
    component,
    part: 'row-label',
    rect,
    text,
  }, readStyle(ctx, element, TEXT_STYLE_KEYS)));
}

function captureDataTableControl(ctx, element, parentId, id, actionId) {
  let rect = measureRect(ctx, element);
  if (!rect) return;
  addNode(ctx, withStyle({
    id: `${parentId}/${id}`,
    parentId,
    component: 'sn-data-table',
    part: 'control',
    rect,
    actions: [{ id: actionId, targetId: parentId, intent: actionId }],
  }, readChromeStyle(ctx, element, `${parentId}/${id}`, CONTROL_STYLE_KEYS)));
  captureIconDescendants(ctx, element, `${parentId}/${id}`, 'sn-data-table');
}

// A data table is a structured visual component, not a generic chrome box:
// capturing its header, rows, cells and selection/sort affordances keeps a
// Maximo dispatch board readable as native primitives even when the source
// table has virtualized DOM rows.
function captureDataTable(element, ctx, parentId) {
  let hostRect = measureRect(ctx, element);
  if (!hostRect) return;
  let tableId = `${parentId}/data-table:${nextSequence(ctx, `${parentId}/data-table`)}`;
  addNode(ctx, withStyle({
    id: tableId,
    parentId,
    component: 'sn-data-table',
    part: 'surface',
    rect: hostRect,
  }, readChromeStyle(ctx, element, tableId)));
  let scroll = element.querySelector('.sn-data-table-scroll');
  if (scroll) checkScrollDiagnostics(ctx, scroll, tableId);
  let table = element.querySelector('table');
  if (!table) {
    let empty = element.querySelector('.sn-data-table-empty:not([hidden])');
    if (empty) captureDataTableText(ctx, empty, tableId, 'empty');
    return;
  }
  for (let [columnIndex, cell] of [...table.querySelectorAll('thead th')].entries()) {
    let rect = measureRect(ctx, cell);
    if (!rect) continue;
    let headerId = `${tableId}/header:${columnIndex}`;
    addNode(ctx, withStyle({
      id: headerId,
      parentId: tableId,
      component: 'sn-data-table',
      part: 'header',
      rect,
    }, readChromeStyle(ctx, cell, headerId)));
    captureDataTableText(ctx, cell, headerId, 'label');
    let sortButton = cell.querySelector('.sn-data-table-sort-btn');
    if (sortButton) captureDataTableControl(ctx, sortButton, headerId, 'control:sort', 'sn-data-table-sort');
    let selectAll = cell.querySelector('.sn-data-table-select-all');
    if (selectAll) captureDataTableControl(ctx, selectAll, headerId, 'control:select-all', 'sn-data-table-select-all');
  }
  for (let [rowIndex, row] of [...table.querySelectorAll('tbody tr:not(.sn-data-table-details-row)')].entries()) {
    let rect = measureRect(ctx, row);
    if (!rect) continue;
    let rowKey = row.dataset?.rowId || rowIndex;
    let rowId = `${tableId}/row:${rowKey}`;
    addNode(ctx, withStyle({
      id: rowId,
      parentId: tableId,
      component: 'sn-data-table',
      part: 'row',
      rect,
      state: { selected: row.getAttribute('aria-selected') === 'true' },
      actions: [{ id: 'sn-data-table-select', targetId: String(rowKey), intent: 'sn-data-table-select' }],
    }, readChromeStyle(ctx, row, rowId)));
    for (let [columnIndex, cell] of [...row.querySelectorAll('td')].entries()) {
      captureDataTableText(ctx, cell, rowId, `cell:${columnIndex}`);
      let selectRow = cell.querySelector('.sn-data-table-select-row');
      if (selectRow) captureDataTableControl(ctx, selectRow, rowId, `control:select:${columnIndex}`, 'sn-data-table-select');
      let expandRow = cell.querySelector('.sn-data-table-expand-btn, .sn-data-table-tree-btn');
      if (expandRow) captureDataTableControl(ctx, expandRow, rowId, `control:expand:${columnIndex}`, 'sn-data-table-expand');
    }
  }
}

const SPATIAL_CAPTURE_ADAPTERS = Object.freeze({
  'canvas-graph': Object.freeze({ capture: captureCanvasGraph }),
  'chat-transcript': Object.freeze({ capture: captureChatTranscript }),
  'layout-node': Object.freeze({ capture: captureLayoutNode }),
  'node-canvas': Object.freeze({ capture: captureNodeCanvas }),
  'sn-badge': Object.freeze({ capture: captureBadge }),
  'sn-data-table': Object.freeze({ capture: captureDataTable }),
  'sn-description-list': Object.freeze({ capture: captureDescriptionList }),
  'sn-metric': Object.freeze({ capture: captureMetric }),
  'sn-scroll-area': Object.freeze({ capture: captureScrollArea }),
  'sn-tree-panel': Object.freeze({ capture: captureTreePanel }),
  'source-editor': Object.freeze({ capture: captureSourceEditor }),
  'source-viewer': Object.freeze({ capture: captureSourceViewer }),
});

/**
 * Resolves the capture adapter registered for a custom element tag.
 *
 * @param {string} component - Custom element tag name.
 * @returns {{capture: Function}} Capture adapter.
 */
export function resolveSpatialAdapter(component) {
  let adapter = SPATIAL_CAPTURE_ADAPTERS[component];
  if (!adapter) {
    throw new Error(
      `Unknown spatial capture adapter "${component}". Supported: ${SPATIAL_CAPTURE_COMPONENTS.join(', ')}.`,
    );
  }
  return adapter;
}

function resolveCaptureRoot(root) {
  if (!isElement(root)) {
    throw new Error(
      'captureSpatialSnapshot requires a root element (the panel-layout element or an ancestor containing one).',
    );
  }
  if (root.tagName.toLowerCase() === 'panel-layout') return root;
  let nested = typeof root.querySelector === 'function' ? root.querySelector('panel-layout') : null;
  if (!nested) {
    throw new Error('captureSpatialSnapshot found no <panel-layout> subtree under the given root element.');
  }
  return nested;
}

/**
 * Captures the bounded `panel-layout` subtree under the given root into a normalized
 * `spatial-snapshot-v1` snapshot. Call only after custom elements, fonts, and two
 * animation frames have settled; settling is the caller's responsibility.
 *
 * @param {Element} root - `panel-layout` element or an ancestor containing one.
 * @param {Object} [options]
 * @param {string} [options.route] - Source route recorded in capture provenance.
 * @param {string} [options.themeScope] - Theme scope label.
 * @param {Array<string>} [options.textSelectors] - Extra explicit structural text selectors.
 * @param {Array<string>} [options.surfaceSelectors] - Explicit structural surface selectors;
 *   matched elements become `surface` nodes and their child text/icons stay captured.
 * @returns {Object} Normalized `spatial-snapshot-v1` snapshot.
 */
export function captureSpatialSnapshot(root, options = {}) {
  let captureRoot = resolveCaptureRoot(root);
  let ctx = createCaptureContext(captureRoot, options);
  walkChildren(ctx, captureRoot, null);
  return createSpatialSnapshot(ctx);
}

function createSpatialSnapshot(ctx) {
  return normalizeSpatialSnapshot({
    version: 'spatial-snapshot-v1',
    unit: 'css-pixel',
    coordinateSpace: 'capture-root-relative',
    capture: {
      viewport: ctx.viewport,
      ...(ctx.route !== undefined ? { route: ctx.route } : {}),
      ...(ctx.themeScope !== undefined ? { themeScope: ctx.themeScope } : {}),
    },
    nodes: ctx.nodes,
    diagnostics: {
      unsupported: ctx.unsupported,
      unknownVisible: ctx.unknownVisible,
    },
  });
}

/**
 * Captures one rendered leaf layout window using the window itself as the
 * root-relative CSS viewport.
 *
 * @param {Element} panel - Leaf `layout-node[node-type="panel"]`.
 * @param {Object} [options] - Same capture provenance and selector options as
 *   `captureSpatialSnapshot`.
 * @returns {Object} Normalized one-window `spatial-snapshot-v1`.
 */
export function captureSpatialWindowSnapshot(panel, options = {}) {
  if (!isElement(panel)
    || panel.tagName.toLowerCase() !== 'layout-node'
    || panel.getAttribute('node-type') !== 'panel') {
    throw new Error(
      'captureSpatialWindowSnapshot requires a leaf layout-node[node-type="panel"].',
    );
  }
  let ctx = createCaptureContext(panel, options);
  captureLayoutNode(panel, ctx, null);
  return createSpatialSnapshot(ctx);
}
