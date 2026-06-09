/**
 * symbiote-ui — Node-safe provider UI API.
 *
 * Browser components live in the explicit `symbiote-ui/ui` entrypoint.
 */

export * from './core/index.js';
export * from './graph/index.js';
export * from './locale/index.js';
export * from './runtime/index.js';
export {
  buildResourceTreeFromEntries,
  createMemoryPersistenceAdapter,
  createPersistenceAdapter,
  createSourceDocument,
  normalizeResourceTree,
  normalizeResourceTreeItem,
  normalizeSourceDocument,
} from 'symbiote-engine/contracts';

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
  applyCascadeTheme,
  CASCADE_THEME_DEFAULTS,
  CASCADE_THEME_DESCRIPTOR,
  CASCADE_THEME_TOKEN_TARGETS,
  createCascadeTheme,
  DEFAULT_PROVIDER_THEME,
  DEFAULT_THEME,
  getCascadeThemeControls,
  getReadableTextForHsl,
  normalizeCascadeThemeOptions,
  applyMotion,
  ScopedAnimationScope,
  animateSpring,
  stagger,
  makeDraggable,
  applyTailwindBridge,
  hasTailwind,
  applyThemePresets,
  resolveThemePresets,
  resolveThemePresetsForTask,
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
export { Readonly } from './plugins/Readonly.js';
export { History } from './plugins/History.js';
export { computeAutoLayout, computeTreeLayout } from './canvas/AutoLayout.js';
export {
  createCanvasGraphStore,
  normalizeCanvasGraphGroups,
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
  normalizeForceGroups,
} from './canvas/graph-layout.js';
export {
  GRAPH_DIRECTORY_FRAME_COLORS,
  GRAPH_PATH_STYLES,
  GRAPH_VIEW_MODES,
  addGraphDirectoryFrames,
  applyGraphExplorerViewMode,
  buildFlatPathHash,
  createGraphExplorerViewController,
  createGraphViewModeController,
  getFileSelectionNodeId,
  getFlatFocusRestoreKey,
  getGraphHashNavigationState,
  getGraphPathStyleDisplay,
  getNextGraphPathStyle,
  normalizeGraphExplorerViewMode,
  normalizeGraphViewMode,
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
export {
  CHAT_TITLE_MAX_LENGTH,
  CHAT_TITLE_MAX_WORDS,
  extractChatTitleFromAgentText,
  sanitizeChatTitle,
} from './chat/chat-title.js';

export {
  buildChatNavTree,
  cleanChatName,
  normalizeChatNavItem,
} from './chat/ChatWorkspace/chat-nav-tree.js';

export {
  DEFAULT_VOICE_ACTION_COMMANDS,
  DEFAULT_VOICE_SEND_COMMANDS,
  DEFAULT_VOICE_WAKE_COMMAND,
  DEFAULT_VOICE_WAKE_COMMANDS,
  LEGACY_VOICE_WAKE_COMMANDS,
  defaultSendCommandPhrases,
  defaultVoiceActionCommandPhrases,
  defaultWakeCommandPhrases,
  formatVoiceCommandList,
  matchVoiceCommandAtEnd,
  matchVoiceCommandInText,
  normalizeWakeCommandPhrase,
  parseVoiceCommandList,
  wakeCommandCandidates,
} from './chat/voice-input-defaults.js';

export {
  DEFAULT_VOICE_SETTINGS,
  loadVoiceSettings,
  saveVoiceSettings,
  mergeServerVoiceSettings,
  normalizeVoiceCommandSettings,
  normalizeVoiceLanguageMode,
} from './chat/voice-settings.js';
