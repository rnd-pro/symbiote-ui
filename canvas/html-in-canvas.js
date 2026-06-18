export const HTML_IN_CANVAS_RENDERER_NAME = 'html-in-canvas';

export const HTML_IN_CANVAS_APIS = Object.freeze({
  layoutSubtreeAttribute: 'layoutsubtree',
  paintEvent: 'paint',
  canvas2dDraw: 'drawElementImage',
  elementCapture: 'captureElementImage',
  webglTextureUpload: 'texElementImage2D',
  webgpuTextureCopy: 'copyElementImageToTexture',
  elementTransform: 'getElementTransform',
  requestPaint: 'requestPaint',
});

export const HTML_IN_CANVAS_RENDERER = Object.freeze({
  name: HTML_IN_CANVAS_RENDERER_NAME,
  status: 'experimental',
  specifier: 'symbiote-ui/ui',
  description: 'Experimental DOM-to-canvas renderer adapter for packaged Chromium hosts and origin-trial browsers.',
  modes: ['canvas2d', 'offscreen2d', 'webgl', 'webgpu'],
  fallback: 'dom-overlay',
  requiredCanvasAttribute: HTML_IN_CANVAS_APIS.layoutSubtreeAttribute,
  capabilities: [
    'dom-content-in-canvas',
    'interactive-canvas-ui',
    'accessible-canvas-ui',
    'text-selection',
    'native-form-controls',
    'offscreen-worker-snapshots',
    'canvas-texture-upload',
    'feature-detected-fallback',
  ],
  apis: HTML_IN_CANVAS_APIS,
});

function hasFn(source, name) {
  return typeof source?.[name] === 'function';
}

function getPrototype(target, name) {
  return target?.[name]?.prototype || null;
}

function supportsLayoutSubtree(target) {
  let canvasProto = getPrototype(target, 'HTMLCanvasElement');
  if (canvasProto && 'layoutSubtree' in canvasProto) return true;
  let canvas = target?.document?.createElement?.('canvas');
  return Boolean(canvas && 'layoutSubtree' in canvas);
}

export function getHtmlInCanvasSupport(target = globalThis) {
  let canvas2dProto = getPrototype(target, 'CanvasRenderingContext2D');
  let offscreen2dProto = getPrototype(target, 'OffscreenCanvasRenderingContext2D');
  let webglProto = getPrototype(target, 'WebGLRenderingContext');
  let webgl2Proto = getPrototype(target, 'WebGL2RenderingContext');
  let gpuQueueProto = getPrototype(target, 'GPUQueue');
  let canvasProto = getPrototype(target, 'HTMLCanvasElement');
  let offscreenCanvasProto = getPrototype(target, 'OffscreenCanvas');

  let canvas2d = hasFn(canvas2dProto, HTML_IN_CANVAS_APIS.canvas2dDraw);
  let offscreen2d = hasFn(offscreen2dProto, HTML_IN_CANVAS_APIS.canvas2dDraw);
  let webgl = hasFn(webglProto, HTML_IN_CANVAS_APIS.webglTextureUpload) ||
    hasFn(webgl2Proto, HTML_IN_CANVAS_APIS.webglTextureUpload);
  let webgpu = hasFn(gpuQueueProto, HTML_IN_CANVAS_APIS.webgpuTextureCopy);
  let elementCapture = hasFn(canvasProto, HTML_IN_CANVAS_APIS.elementCapture);
  let elementTransform = hasFn(canvasProto, HTML_IN_CANVAS_APIS.elementTransform) ||
    hasFn(offscreenCanvasProto, HTML_IN_CANVAS_APIS.elementTransform);
  let requestPaint = hasFn(canvasProto, HTML_IN_CANVAS_APIS.requestPaint);

  return {
    name: HTML_IN_CANVAS_RENDERER_NAME,
    status: 'experimental',
    supported: canvas2d || offscreen2d || webgl || webgpu,
    fallback: HTML_IN_CANVAS_RENDERER.fallback,
    modes: {
      canvas2d,
      offscreen2d,
      webgl,
      webgpu,
    },
    apis: {
      ...HTML_IN_CANVAS_APIS,
      canvas2dDrawAvailable: canvas2d,
      offscreen2dDrawAvailable: offscreen2d,
      webglTextureUploadAvailable: webgl,
      webgpuTextureCopyAvailable: webgpu,
      elementCaptureAvailable: elementCapture,
      elementTransformAvailable: elementTransform,
      requestPaintAvailable: requestPaint,
      layoutSubtreeAvailable: supportsLayoutSubtree(target),
    },
  };
}

export function setupHtmlInCanvas(canvas) {
  if (!canvas || typeof canvas.setAttribute !== 'function') return false;
  canvas.setAttribute(HTML_IN_CANVAS_APIS.layoutSubtreeAttribute, '');
  return true;
}

export function requestHtmlInCanvasPaint(canvas) {
  if (hasFn(canvas, HTML_IN_CANVAS_APIS.requestPaint)) {
    canvas.requestPaint();
    return true;
  }
  return false;
}

export function getHtmlInCanvasChangedElements(event) {
  if (!event || !Array.isArray(event.changedElements)) return [];
  return event.changedElements;
}

export function captureHtmlElementImage(canvas, element) {
  if (!hasFn(canvas, HTML_IN_CANVAS_APIS.elementCapture)) {
    return { captured: false, reason: 'unsupported' };
  }
  return {
    captured: true,
    elementImage: canvas[HTML_IN_CANVAS_APIS.elementCapture](element),
  };
}

export function closeHtmlElementImage(elementImage) {
  if (!hasFn(elementImage, 'close')) return false;
  elementImage.close();
  return true;
}

export function drawHtmlElement2d(ctx, element, options = {}) {
  if (!hasFn(ctx, HTML_IN_CANVAS_APIS.canvas2dDraw)) {
    return { rendered: false, mode: 'canvas2d', reason: 'unsupported' };
  }

  let args = Array.isArray(options.rect)
    ? [element, ...options.rect.map((value) => Number(value))]
    : [element, Number(options.x ?? 0), Number(options.y ?? 0)];
  if (options.width != null && options.height != null) {
    args.push(Number(options.width), Number(options.height));
  }

  let transform = ctx[HTML_IN_CANVAS_APIS.canvas2dDraw](...args);
  if (options.syncTransform !== false && transform && element?.style) {
    element.style.transform = transform.toString();
  }

  return { rendered: true, mode: 'canvas2d', transform };
}

export function uploadHtmlElementToWebGLTexture(gl, element, options = {}) {
  if (!hasFn(gl, HTML_IN_CANVAS_APIS.webglTextureUpload)) {
    return { rendered: false, mode: 'webgl', reason: 'unsupported' };
  }

  let target = options.target ?? gl.TEXTURE_2D;
  let level = options.level ?? 0;
  let internalFormat = options.internalFormat ?? gl.RGBA;
  let format = options.format ?? gl.RGBA;
  let type = options.type ?? gl.UNSIGNED_BYTE;
  gl[HTML_IN_CANVAS_APIS.webglTextureUpload](target, level, internalFormat, format, type, element);
  return { rendered: true, mode: 'webgl' };
}

export function copyHtmlElementToWebGPUTexture(queue, element, options = {}) {
  if (!hasFn(queue, HTML_IN_CANVAS_APIS.webgpuTextureCopy)) {
    return { rendered: false, mode: 'webgpu', reason: 'unsupported' };
  }
  if (!options.destination) {
    return { rendered: false, mode: 'webgpu', reason: 'missing-destination' };
  }

  let args = [element, options.destination];
  if (options.copySize) args.push(options.copySize);
  queue[HTML_IN_CANVAS_APIS.webgpuTextureCopy](...args);
  return { rendered: true, mode: 'webgpu' };
}

export function getHtmlElementCanvasTransform(canvas, element, matrix) {
  if (!hasFn(canvas, HTML_IN_CANVAS_APIS.elementTransform)) return null;
  return canvas[HTML_IN_CANVAS_APIS.elementTransform](element, matrix) || null;
}

export function createHtmlInCanvasAdapter(options = {}) {
  let target = options.globalThis || globalThis;
  let support = getHtmlInCanvasSupport(target);

  return {
    ...HTML_IN_CANVAS_RENDERER,
    support,
    canRender(mode = 'canvas2d') {
      return Boolean(support.modes[mode]);
    },
    setupCanvas: setupHtmlInCanvas,
    requestPaint: requestHtmlInCanvasPaint,
    getChangedElements: getHtmlInCanvasChangedElements,
    captureElementImage: captureHtmlElementImage,
    closeElementImage: closeHtmlElementImage,
    draw2d: drawHtmlElement2d,
    uploadWebGLTexture: uploadHtmlElementToWebGLTexture,
    copyWebGPUTexture: copyHtmlElementToWebGPUTexture,
    getElementTransform: getHtmlElementCanvasTransform,
  };
}
