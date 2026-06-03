/**
 * Browser/UI API for symbiote-ui.
 *
 * Import this entrypoint in applications that need Web Components, layout
 * widgets, router helpers, panels, and browser canvas modules.
 */

export * from '../core/index.js';
export * from '../graph/index.js';
export * from '../locale/index.js';
export { configureBrowserLocalization, detectBrowserLocale } from './locale.js';

import { getComponent, listComponents } from '../manifest/component-registry.js';
import { configureBrowserLocalization } from './locale.js';

export { Drag } from '../interactions/Drag.js';
export { Zoom } from '../interactions/Zoom.js';
export { Selector } from '../interactions/Selector.js';
export { SnapGrid } from '../interactions/SnapGrid.js';
export { ConnectFlow } from '../interactions/ConnectFlow.js';

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
} from '../shapes/index.js';

export {
  applyTheme,
  extractTheme,
  DEFAULT_PROVIDER_THEME,
  DEFAULT_THEME,
} from '../themes/Theme.js';

export {
  applyPalette,
  DEFAULT_PROVIDER_PALETTE,
  DEFAULT_PALETTE,
} from '../themes/Palette.js';

export { applySkin, MODERN_SKIN, COMPACT_SKIN, ROUNDED_SKIN } from '../themes/Skin.js';
export { CARBON, CARBON_PALETTE } from '../themes/carbon.js';
export { PCB_DARK } from '../themes/pcb.js';
export { EBOOK, EBOOK_PALETTE } from '../themes/ebook.js';
export { NEON_PALETTE } from '../themes/neon.js';
export { configureMaterialSymbols, ensureMaterialSymbols } from '../icons/MaterialSymbols.js';

export { FocusController, GraphHistory } from 'symbiote-engine';
export { Readonly } from '../plugins/Readonly.js';
export { History } from '../plugins/History.js';

export { FlowSimulator } from '../canvas/FlowSimulator.js';
export * as LayoutTree from '../layout/LayoutTree.js';
export { matchesSection } from '../layout/LayoutTree.js';
export {
  SECTION_SCOPES,
  SectionRegistry,
  createSectionRegistry,
  normalizeSectionScope,
  sectionMatchesScope,
  withGlobalPanel,
  registerSection,
  getSection,
  getSections,
  getHomeSections,
  getProjectSections,
  getSectionsForScope,
  getLayout,
  hasSection,
  clearSections,
} from '../layout/LayoutRouter/SectionRegistry.js';
export {
  updateHashParam,
  getGraphSearchString,
  getGraphUrlParams,
  parseGraphHash,
} from '../layout/LayoutRouter/LayoutRouter.js';
export { computeAutoLayout, computeTreeLayout } from '../canvas/AutoLayout.js';
export { SubgraphManager } from '../canvas/SubgraphManager.js';
export { SubgraphRouter } from '../canvas/SubgraphRouter.js';
export { LODManager } from '../canvas/LODManager.js';
export { PinExpansion } from '../canvas/PinExpansion.js';
export { ForceLayout } from '../canvas/ForceLayout.js';
export {
  createCanvasGraphStore,
  normalizeCanvasGraphModel,
} from '../canvas/graph-model.js';
export {
  computeInitialGraphPositions,
  createForceLayoutPayload,
  findForceNodeGroup,
  getDrillableFiles,
  getForceLayoutOptions,
  getGraphCacheKey,
  getOrBuildGraph,
} from '../canvas/graph-layout.js';
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
  renderGraphPathStyleButton,
  renderGraphViewModeButton,
  resolveFlatHashChange,
  resolveInitialGraphViewMode,
  selectGraphLabelMode,
  setGraphLayerVisible,
  shouldClearFocusOnSelection,
  shouldFitForceLayoutInitialTick,
  shouldRestoreFlatFocus,
  toggleGraphLayerButtonState,
  resolveGraphNodeClick,
  resolveToolbarAction,
  renderClusterPanel,
  renderGraphStats,
} from '../canvas/graph-explorer.js';
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
} from '../canvas/html-in-canvas.js';
export * from '../xr/index.js';

export let NodeCanvas;
export let CanvasGraph;
export let GraphExplorerShell;
export let ContextMenu;
export let GraphNode;
export let NodeCallout;
export let GraphFrame;
export let NodeSocket;
export let QuickToolbar;
export let InspectorPanel;
export let Minimap;
export let NodeSearch;
export let Layout;
export let LayoutNode;
export let LayoutSidebar;
export let CrossLayoutPortalBridge;
export let ProjectTabs;
export let CodeBlock;
export let SourceViewer;
export let SourceEditor;
export let LoadingOverlay;
export let StatusBadge;
export let StatusBanner;
export let EmptyState;
export let MetricItem;
export let DataTable;
export let EventFeed;
export let getSourceLanguage;
export let isDirectoryLikePath;
export let buildDirectoryInfo;
export let QuickOpen;
export let navigate;
export let updateParams;
export let parseQuery;
export let buildHash;
export let buildQuery;
export let getRoute;
export let setDefaultPanel;
export let registerGlobalParam;
export let setGlobalParam;
export let syncWithRouter;
export let setupPanelRouting;
export let PaletteBrowser;
export let GraphTabs;
export let Breadcrumb;
export let CellBg;
export let ChatMessageItem;
export let ChatTranscript;
export let ChatComposer;
export let ChatList;
export let ChatListItem;
export let ChatSidebarShell;
export let ChatSidebarItem;
export let ChatSidebarSubItem;
export let ListItem;
export let ListDetailShell;
export let TreeView;
export let TreePanel;
export let ActionButton;
export let FormField;
export let SurfaceCard;
export let OutputListPreview;
export let OutputGraphPreview;
export let StatusRibbon;
export let stringifyBlock;
export let truncateResult;
export { sharedUiStyles } from './shared-styles.js';
export { bringOverlayToFront, nextOverlayZIndex, resetOverlayStack } from './overlay-stack.js';
export { escapeHtml } from '../display/markdown-formatter.js';
export { normalizeOutputList, normalizePreviewGraph } from '../display/output-preview.js';
export { createNetworkApprovalPageStyles, renderNetworkApprovalPage } from '../display/network-approval-page.js';
export { uiAlert, uiConfirm, uiPrompt } from './dialogs.js';
export {
  bindListItemSelect,
  collapseTree,
  highlightTreePath,
  setTreeItems,
  setupTreePanel,
  showTree,
  showTreePlaceholder,
  syncListItem,
  syncTreeFilter,
} from './host-adapters.js';
export {
  buildChatMessageItems,
  buildSessionMetaHtml,
  buildWorkMetaHtml,
  buildWorkSummaryHtml,
  findPreviousAgentText,
  toChatMessageItem,
} from '../chat/message-model.js';
export { collectQuickOpenFilesFromSkeleton, fuzzyScore, searchQuickOpenItems } from '../navigation/quick-open-utils.js';

const runtimeModules = new Map();
const runtimeModuleAliases = new Map();

const hasDOMGlobals =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  typeof HTMLElement !== 'undefined' &&
  typeof customElements !== 'undefined';

function normalizeModuleName(name) {
  return String(name || '').trim();
}

function canUseCustomElements() {
  return typeof customElements !== 'undefined' && typeof customElements.get === 'function';
}

function findCatalogComponent(name) {
  let normalized = normalizeModuleName(name);
  if (!normalized) return null;
  let byTag = getComponent(normalized);
  if (byTag) return byTag;
  return listComponents({ includeInternal: true, includeExperimental: true }).find((component) => {
    return component.exportName === normalized || component.className === normalized;
  }) || null;
}

function resolveModuleRecord(name) {
  let normalized = normalizeModuleName(name);
  if (!normalized) return null;
  let tagName = runtimeModuleAliases.get(normalized) || normalized;
  return runtimeModules.get(tagName) || null;
}

function toModuleDescriptor(record, component = null) {
  let tagName = record?.tagName || component?.tagName;
  let ComponentClass = record?.ComponentClass;
  let defined = Boolean(tagName && canUseCustomElements() && customElements.get(tagName));
  return {
    name: tagName,
    tagName,
    exportName: record?.exportName ?? component?.exportName ?? null,
    className: record?.className ?? component?.className ?? ComponentClass?.name ?? null,
    category: record?.category ?? component?.category ?? null,
    visibility: record?.visibility ?? component?.visibility ?? 'public',
    internal: Boolean(record?.internal ?? component?.internal),
    experimental: (record?.visibility ?? component?.visibility) === 'experimental',
    specifier: record?.specifier ?? component?.specifier ?? 'symbiote-ui/ui',
    module: record?.module ?? component?.module ?? null,
    defined,
    registered: Boolean(record?.ComponentClass),
  };
}

function registerModuleAlias(alias, tagName) {
  if (alias) runtimeModuleAliases.set(alias, tagName);
}

function moduleVisible(record, options = {}) {
  let visibility = record?.visibility ?? 'public';
  let internal = Boolean(record?.internal ?? visibility === 'internal');
  let experimental = Boolean(record?.experimental ?? visibility === 'experimental');
  if (internal && !options.includeInternal) return false;
  if (experimental && !options.includeExperimental) return false;
  return true;
}

export function registerModule(name, ComponentClass, options = {}) {
  let normalized = normalizeModuleName(name);
  if (!normalized) {
    throw new TypeError('registerModule(name, ComponentClass) requires a module name.');
  }
  if (typeof ComponentClass !== 'function') {
    throw new TypeError(`registerModule("${normalized}") requires a component class.`);
  }

  let component = findCatalogComponent(normalized);
  let tagName = normalizeModuleName(options.tagName || component?.tagName || normalized);
  let exportName = options.exportName ?? component?.exportName ?? ComponentClass.name ?? null;
  let visibility = options.visibility ?? component?.visibility ?? 'public';
  let record = {
    tagName,
    exportName,
    className: options.className ?? component?.className ?? ComponentClass.name ?? null,
    category: options.category ?? component?.category ?? null,
    visibility,
    internal: Boolean(options.internal ?? component?.internal ?? visibility === 'internal'),
    specifier: options.specifier ?? component?.specifier ?? 'symbiote-ui/ui',
    module: options.module ?? component?.module ?? null,
    ComponentClass,
  };

  runtimeModules.set(tagName, record);
  registerModuleAlias(normalized, tagName);
  registerModuleAlias(tagName, tagName);
  registerModuleAlias(exportName, tagName);
  registerModuleAlias(record.className, tagName);
  return toModuleDescriptor(record, component);
}

export function getModule(name, options = {}) {
  let record = resolveModuleRecord(name);
  if (record?.ComponentClass) {
    return moduleVisible(record, options) ? record.ComponentClass : undefined;
  }

  let component = findCatalogComponent(name);
  if (!moduleVisible(component, options)) return undefined;
  if (component?.tagName && canUseCustomElements()) {
    return customElements.get(component.tagName);
  }
  return undefined;
}

export function listModules(options = {}) {
  let { includeInternal = false, includeExperimental = false } = options;
  let descriptors = [];
  let seen = new Set();

  for (let component of listComponents({ includeInternal: true, includeExperimental: true })) {
    if (!includeInternal && component.internal) continue;
    if (!includeExperimental && component.visibility === 'experimental') continue;
    let record = runtimeModules.get(component.tagName);
    descriptors.push(toModuleDescriptor(record, component));
    seen.add(component.tagName);
  }

  for (let record of runtimeModules.values()) {
    if (seen.has(record.tagName)) continue;
    if (!includeInternal && record.internal) continue;
    if (!includeExperimental && record.visibility === 'experimental') continue;
    descriptors.push(toModuleDescriptor(record));
    seen.add(record.tagName);
  }

  return descriptors;
}

export function defineModule(name, options = {}) {
  if (!canUseCustomElements()) return undefined;

  let component = findCatalogComponent(name);
  let record = resolveModuleRecord(name);
  let visibility = options.visibility ?? record?.visibility ?? component?.visibility ?? 'public';
  let internal = Boolean(record?.internal ?? component?.internal ?? visibility === 'internal');
  let experimental = visibility === 'experimental';
  let tagName = normalizeModuleName(options.tagName || record?.tagName || component?.tagName || name);

  if (internal && !options.includeInternal) {
    throw new Error(`UI module "${tagName}" is internal. Pass includeInternal: true to define it.`);
  }
  if (experimental && !options.includeExperimental) {
    throw new Error(`UI module "${tagName}" is experimental. Pass includeExperimental: true to define it.`);
  }

  let existing = customElements.get(tagName);
  if (existing) return existing;

  let ComponentClass = record?.ComponentClass || getModule(name, options);
  if (!ComponentClass) {
    throw new Error(`UI module "${tagName}" is not registered.`);
  }

  customElements.define(tagName, ComponentClass, options.defineOptions);
  return customElements.get(tagName) || ComponentClass;
}

function registerCatalogModules(exportsByName) {
  for (let component of listComponents({ includeInternal: true, includeExperimental: true })) {
    if (!component.exportName) continue;
    let ComponentClass = exportsByName[component.exportName];
    if (!ComponentClass) continue;
    registerModule(component.tagName, ComponentClass, {
      tagName: component.tagName,
      exportName: component.exportName,
      className: component.className,
      category: component.category,
      visibility: component.visibility,
      internal: component.internal,
      specifier: component.specifier,
      module: component.module,
    });
  }
}

if (hasDOMGlobals) {
  configureBrowserLocalization();

  const [
    nodeCanvas,
    canvasGraph,
    graphExplorerShell,
    contextMenu,
    graphNode,
    nodeCallout,
    graphFrame,
    nodeSocket,
    quickToolbar,
    inspectorPanel,
    minimap,
    nodeSearch,
    layout,
    layoutNode,
    layoutSidebar,
    crossLayoutPortalBridge,
    projectTabs,
    codeBlock,
    sourceViewer,
    sourceEditor,
    loadingOverlay,
    statusBadge,
    statusBanner,
    emptyState,
    metricItem,
    dataTable,
    eventFeed,
    quickOpen,
    layoutRouter,
    routerSync,
    paletteBrowser,
    graphTabs,
    breadcrumb,
    cellBg,
    chatMessageItem,
    chatTranscript,
    chatComposer,
    chatList,
    chatListItem,
    chatSidebar,
    chatSidebarItem,
    listItem,
    listDetailShell,
    treeView,
    treePanel,
    actionButton,
    formField,
    surfaceCard,
    outputListPreview,
    outputGraphPreview,
    statusRibbon,
  ] = await Promise.all([
    import('../canvas/NodeCanvas/NodeCanvas.js'),
    import('../canvas/CanvasGraph/CanvasGraph.js'),
    import('../canvas/GraphExplorerShell/GraphExplorerShell.js'),
    import('../menu/ContextMenu/ContextMenu.js'),
    import('../node/GraphNode/GraphNode.js'),
    import('../node/NodeCallout/NodeCallout.js'),
    import('../node/GraphFrame/GraphFrame.js'),
    import('../node/NodeSocket/NodeSocket.js'),
    import('../toolbar/QuickToolbar/QuickToolbar.js'),
    import('../inspector/InspectorPanel/InspectorPanel.js'),
    import('../canvas/Minimap/Minimap.js'),
    import('../canvas/NodeSearch/NodeSearch.js'),
    import('../layout/Layout/Layout.js'),
    import('../layout/LayoutNode/LayoutNode.js'),
    import('../layout/LayoutSidebar/LayoutSidebar.js'),
    import('../layout/CrossLayoutPortalBridge/CrossLayoutPortalBridge.js'),
    import('../layout/ProjectTabs/ProjectTabs.js'),
    import('../display/CodeBlock/CodeBlock.js'),
    import('../display/SourceViewer/SourceViewer.js'),
    import('../display/SourceEditor/SourceEditor.js'),
    import('../display/LoadingOverlay/LoadingOverlay.js'),
    import('../display/Badge/Badge.js'),
    import('../display/Banner/Banner.js'),
    import('../display/EmptyState/EmptyState.js'),
    import('../display/Metric/Metric.js'),
    import('../display/DataTable/DataTable.js'),
    import('../display/EventFeed/EventFeed.js'),
    import('../navigation/QuickOpen/QuickOpen.js'),
    import('../layout/LayoutRouter/LayoutRouter.js'),
    import('../layout/LayoutRouter/routerSync.js'),
    import('../palette/PaletteBrowser/PaletteBrowser.js'),
    import('../canvas/GraphTabs/GraphTabs.js'),
    import('../canvas/Breadcrumb/Breadcrumb.js'),
    import('../effects/CellBg/CellBg.js'),
    import('../chat/ChatMessageItem/ChatMessageItem.js'),
    import('../chat/ChatTranscript/ChatTranscript.js'),
    import('../chat/ChatComposer/ChatComposer.js'),
    import('../chat/ChatList/ChatList.js'),
    import('../chat/ChatListItem/ChatListItem.js'),
    import('../chat/ChatSidebar/ChatSidebar.js'),
    import('../chat/ChatSidebarItem/ChatSidebarItem.js'),
    import('../list/ListItem/ListItem.js'),
    import('../list/ListDetailShell/ListDetailShell.js'),
    import('../tree/TreeView/TreeView.js'),
    import('../tree/TreePanel/TreePanel.js'),
    import('../control/Button/Button.js'),
    import('../control/Field/Field.js'),
    import('../surface/Card/Card.js'),
    import('../display/OutputListPreview/OutputListPreview.js'),
    import('../display/OutputGraphPreview/OutputGraphPreview.js'),
    import('../display/StatusRibbon/StatusRibbon.js'),
  ]);

  ({ NodeCanvas } = nodeCanvas);
  ({ CanvasGraph } = canvasGraph);
  ({ GraphExplorerShell } = graphExplorerShell);
  ({ ContextMenu } = contextMenu);
  ({ GraphNode } = graphNode);
  ({ NodeCallout } = nodeCallout);
  ({ GraphFrame } = graphFrame);
  ({ NodeSocket } = nodeSocket);
  ({ QuickToolbar } = quickToolbar);
  ({ InspectorPanel } = inspectorPanel);
  ({ Minimap } = minimap);
  ({ NodeSearch } = nodeSearch);
  ({ Layout } = layout);
  ({ LayoutNode } = layoutNode);
  ({ LayoutSidebar } = layoutSidebar);
  ({ CrossLayoutPortalBridge } = crossLayoutPortalBridge);
  ({ ProjectTabs } = projectTabs);
  ({ CodeBlock } = codeBlock);
  ({ SourceViewer, getSourceLanguage, isDirectoryLikePath, buildDirectoryInfo } = sourceViewer);
  ({ SourceEditor } = sourceEditor);
  ({ LoadingOverlay } = loadingOverlay);
  ({ StatusBadge } = statusBadge);
  ({ StatusBanner } = statusBanner);
  ({ EmptyState } = emptyState);
  ({ MetricItem } = metricItem);
  ({ DataTable } = dataTable);
  ({ EventFeed } = eventFeed);
  ({ QuickOpen } = quickOpen);
  ({
    navigate,
    updateParams,
    parseQuery,
    buildHash,
    buildQuery,
    getRoute,
    setDefaultPanel,
    registerGlobalParam,
    setGlobalParam,
  } = layoutRouter);
  ({ syncWithRouter, setupPanelRouting } = routerSync);
  ({ PaletteBrowser } = paletteBrowser);
  ({ GraphTabs } = graphTabs);
  ({ Breadcrumb } = breadcrumb);
  ({ CellBg } = cellBg);
  ({ ChatMessageItem, stringifyBlock, truncateResult } = chatMessageItem);
  ({ ChatTranscript } = chatTranscript);
  ({ ChatComposer } = chatComposer);
  ({ ChatList } = chatList);
  ({ ChatListItem } = chatListItem);
  ({ ChatSidebarShell } = chatSidebar);
  ({ ChatSidebarItem, ChatSidebarSubItem } = chatSidebarItem);
  ({ ListItem } = listItem);
  ({ ListDetailShell } = listDetailShell);
  ({ TreeView } = treeView);
  ({ TreePanel } = treePanel);
  ({ ActionButton } = actionButton);
  ({ FormField } = formField);
  ({ SurfaceCard } = surfaceCard);
  ({ OutputListPreview } = outputListPreview);
  ({ OutputGraphPreview } = outputGraphPreview);
  ({ StatusRibbon } = statusRibbon);

  registerCatalogModules({
    NodeCanvas,
    CanvasGraph,
    GraphExplorerShell,
    ContextMenu,
    GraphNode,
    NodeCallout,
    GraphFrame,
    NodeSocket,
    QuickToolbar,
    InspectorPanel,
    Minimap,
    NodeSearch,
    Layout,
    LayoutNode,
    LayoutSidebar,
    CrossLayoutPortalBridge,
    ProjectTabs,
    CodeBlock,
    SourceViewer,
    SourceEditor,
    LoadingOverlay,
    StatusBadge,
    StatusBanner,
    EmptyState,
    MetricItem,
    DataTable,
    EventFeed,
    QuickOpen,
    PaletteBrowser,
    GraphTabs,
    Breadcrumb,
    CellBg,
    ChatMessageItem,
    ChatTranscript,
    ChatComposer,
    ChatList,
    ChatListItem,
    ChatSidebarShell,
    ChatSidebarItem,
    ChatSidebarSubItem,
    ListItem,
    ListDetailShell,
    TreeView,
    TreePanel,
    ActionButton,
    FormField,
    SurfaceCard,
    OutputListPreview,
    OutputGraphPreview,
    StatusRibbon,
  });
}

export {
  DEFAULT_NAV_WIDTH,
  MIN_NAV_WIDTH,
  MAX_NAV_WIDTH,
  COLLAPSED_NAV_WIDTH,
  COLLAPSE_DRAG_THRESHOLD,
  AUTO_COLLAPSE_WIDTH,
  AUTO_UNCOLLAPSE_WIDTH,
  clampChatSidebarWidth,
} from '../chat/ChatSidebar/constants.js';
