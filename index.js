/**
 * symbiote-ui — Node-safe provider UI API.
 *
 * Browser components live in the explicit `symbiote-ui/ui` entrypoint.
 */

export * from './core/index.js';
export * from './graph/index.js';
export * from './locale/index.js';

export {
  NodeShape,
  RectShape,
  PillShape,
  CircleShape,
  DiamondShape,
  CommentShape,
  getShape,
  registerShape,
  SVGShape,
  createSVGShape,
  SVG_PRESETS,
} from './shapes/index.js';

export {
  DEFAULT_PROVIDER_THEME,
  DEFAULT_THEME,
} from './themes/Theme.js';

export {
  DEFAULT_PROVIDER_PALETTE,
  DEFAULT_PALETTE,
} from './themes/Palette.js';

export { MODERN_SKIN, COMPACT_SKIN, ROUNDED_SKIN } from './themes/Skin.js';
export { CARBON, CARBON_PALETTE } from './themes/carbon.js';
export { PCB_DARK } from './themes/pcb.js';
export { EBOOK, EBOOK_PALETTE } from './themes/ebook.js';
export { NEON_PALETTE } from './themes/neon.js';
export { GraphHistory } from 'symbiote-engine';
export { Readonly } from './plugins/Readonly.js';
export { History } from './plugins/History.js';
export { computeAutoLayout, computeTreeLayout } from './canvas/AutoLayout.js';
export {
  createCanvasGraphStore,
  normalizeCanvasGraphModel,
} from './canvas/graph-model.js';
export {
  computeInitialGraphPositions,
  createForceLayoutPayload,
  findForceNodeGroup,
  getDrillableFiles,
  getForceLayoutOptions,
  getGraphCacheKey,
  getOrBuildGraph,
} from './canvas/graph-layout.js';
export {
  GRAPH_DIRECTORY_FRAME_COLORS,
  GRAPH_PATH_STYLES,
  addGraphDirectoryFrames,
  buildFlatPathHash,
  getFileSelectionNodeId,
  getFlatFocusRestoreKey,
  getGraphHashNavigationState,
  getGraphPathStyleDisplay,
  getNextGraphPathStyle,
  resolveFlatHashChange,
  resolveInitialGraphViewMode,
  shouldClearFocusOnSelection,
  shouldFitForceLayoutInitialTick,
  shouldRestoreFlatFocus,
} from './canvas/graph-explorer.js';
export { resolveSymbolFile, findConnectionPath } from './graph/graph-algorithms.js';
export {
  HTML_IN_CANVAS_APIS,
  HTML_IN_CANVAS_RENDERER,
  HTML_IN_CANVAS_RENDERER_NAME,
  captureHtmlElementImage,
  closeHtmlElementImage,
  copyHtmlElementToWebGPUTexture,
  createHtmlInCanvasAdapter,
  drawHtmlElement2d,
  getHtmlInCanvasChangedElements,
  getHtmlElementCanvasTransform,
  getHtmlInCanvasSupport,
  requestHtmlInCanvasPaint,
  setupHtmlInCanvas,
  uploadHtmlElementToWebGLTexture,
} from './canvas/html-in-canvas.js';
export * from './xr/index.js';
export { buildFileGraph, buildStructuredGraph } from './canvas/project-graph-builder.js';
export { buildGraphModelFromSkeleton, buildCanvasGraphModelFromSkeleton } from './canvas/project-graph-model.js';
export { collectQuickOpenFilesFromSkeleton, fuzzyScore, searchQuickOpenItems } from './navigation/quick-open-utils.js';
export { normalizeOutputList, normalizePreviewGraph } from './display/output-preview.js';
export { createNetworkApprovalPageStyles, renderNetworkApprovalPage } from './display/network-approval-page.js';
