import Symbiote, { html } from '@symbiotejs/symbiote';
import { Connection, Input, Node, NodeEditor, Output, Socket } from '../core/index.js';
import * as LayoutTree from '../layout/LayoutTree.js';
import {
  DEFAULT_PROVIDER_THEME,
  CASCADE_THEME_DEFAULTS,
  applyCascadeTheme,
  applyTheme,
  normalizeCascadeThemeOptions,
} from '../themes/Theme.js';
import { configureMaterialSymbols } from '../icons/MaterialSymbols.js';
import '../layout/LayoutShellMenu/LayoutShellMenu.js';
import '../layout/LayoutSidebar/LayoutSidebar.js';
import '../layout/Layout/Layout.js';
import '../layout/LayoutNode/LayoutNode.js';
import '../layout/ProjectTabs/ProjectTabs.js';
import '../canvas/NodeCanvas/NodeCanvas.js';
import '../canvas/GraphExplorerShell/GraphExplorerShell.js';
import '../node/GraphNode/GraphNode.js?v=cascade-demo-node-1';
import '../control/Button/Button.js';
import '../display/Banner/Banner.js';
import '../display/Badge/Badge.js';
import '../display/DataTable/DataTable.js';
import '../display/EmptyState/EmptyState.js';
import '../display/EventFeed/EventFeed.js';
import '../display/LoadingOverlay/LoadingOverlay.js';
import '../display/SourceViewer/SourceViewer.js';
import '../display/SourceEditor/SourceEditor.js';
import '../display/StatusRibbon/StatusRibbon.js';
import '../list/ListDetailShell/ListDetailShell.js';
import '../surface/Card/Card.js';
import '../tree/TreePanel/TreePanel.js';
import '../canvas/CanvasGraph/CanvasGraph.js';
import '../effects/CellBg/CellBg.js';
import '../chat/ChatTranscript/ChatTranscript.js';
import '../chat/ChatComposer/ChatComposer.js?v=cascade-demo-chat-1';
import '../chat/ChatSidebar/ChatSidebar.js?v=cascade-demo-chat-1';
import '../display/CodeBlock/CodeBlock.js';
import '../themes/CascadeThemeEditor/CascadeThemeEditor.js';
import '../themes/CascadeThemeWidget/CascadeThemeWidget.js';

configureMaterialSymbols();

await Promise.all([
  customElements.whenDefined('layout-shell-menu'),
  customElements.whenDefined('layout-sidebar'),
  customElements.whenDefined('panel-layout'),
  customElements.whenDefined('layout-node'),
  customElements.whenDefined('project-tabs'),
  customElements.whenDefined('graph-explorer-shell'),
  customElements.whenDefined('sn-data-table'),
  customElements.whenDefined('sn-empty-state'),
  customElements.whenDefined('sn-event-feed'),
  customElements.whenDefined('sn-list-detail-shell'),
  customElements.whenDefined('sn-loading-overlay'),
  customElements.whenDefined('source-viewer'),
  customElements.whenDefined('source-editor'),
  customElements.whenDefined('sn-status-ribbon'),
  customElements.whenDefined('canvas-graph'),
  customElements.whenDefined('chat-composer'),
  customElements.whenDefined('chat-sidebar-shell'),
  customElements.whenDefined('cascade-theme-widget'),
]);

const CASCADE_THEME_STORAGE_KEY = 'symbiote-ui:cascade-theme-lab';
const CASCADE_THEME_QUERY_KEYS = [
  'mode',
  'brightness',
  'contrast',
  'chroma',
  'hue',
  'outline',
  'type',
  'heading',
  'density',
];
const urlParams = new URLSearchParams(location.search);

function readStoredCascadeTheme() {
  if (typeof localStorage === 'undefined') return CASCADE_THEME_DEFAULTS;
  try {
    let stored = JSON.parse(localStorage.getItem(CASCADE_THEME_STORAGE_KEY) || 'null');
    return stored && typeof stored === 'object'
      ? normalizeCascadeThemeOptions(stored)
      : CASCADE_THEME_DEFAULTS;
  } catch (error) {
    void error;
    return CASCADE_THEME_DEFAULTS;
  }
}

function readUrlCascadeTheme() {
  let options = {};
  let hasOverride = false;
  for (let key of CASCADE_THEME_QUERY_KEYS) {
    if (!urlParams.has(key)) continue;
    hasOverride = true;
    options[key] = key === 'mode' ? urlParams.get(key) : Number(urlParams.get(key));
  }
  return hasOverride ? normalizeCascadeThemeOptions(options) : null;
}

function readInitialCascadeTheme() {
  return readUrlCascadeTheme() || readStoredCascadeTheme();
}

applyTheme(document.documentElement, DEFAULT_PROVIDER_THEME);
applyCascadeTheme(document.documentElement, readInitialCascadeTheme(), {
  source: 'cascade-lab-init',
  targetSelector: ':root',
});

const chatSmokeWidth = Number(urlParams.get('chatSmokeWidth') || 0);

const CIRCLE_SAMPLE_IMAGE = [
  'data:image/svg+xml;utf8,',
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8bd3ff"/>
          <stop offset="0.48" stop-color="#72f0bd"/>
          <stop offset="1" stop-color="#f8c96a"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="#161816"/>
      <circle cx="60" cy="60" r="47" fill="url(#g)"/>
      <path d="M36 66 55 41l29 42H43z" fill="#121512" opacity=".82"/>
      <circle cx="82" cy="38" r="9" fill="#fff" opacity=".72"/>
    </svg>
  `),
].join('');

const SVG_NODE_SAMPLE_IMAGE = [
  'data:image/svg+xml;utf8,',
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#8bd3ff"/>
          <stop offset="0.55" stop-color="#79e6c4"/>
          <stop offset="1" stop-color="#d6b5ff"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" fill="none"/>
      <path d="M60 10 103 35v50L60 110 17 85V35Z" fill="url(#g)" opacity=".92"/>
      <path d="M39 44h42M39 60h42M39 76h42" stroke="#101417" stroke-width="8" stroke-linecap="round"/>
      <circle cx="39" cy="44" r="7" fill="#101417"/>
      <circle cx="81" cy="60" r="7" fill="#101417"/>
      <circle cx="39" cy="76" r="7" fill="#101417"/>
    </svg>
  `),
].join('');

class CascadeOverviewPanel extends Symbiote {
  renderCallback() {
    this.$.projects = showcaseProjects.map((project) => ({
      icon: project.icon,
      name: project.name,
      summary: project.overview || project.sidebarLabel,
    }));
  }
}

CascadeOverviewPanel.template = html`
  <section class="showcase-overview">
    <header class="showcase-overview-hero">
      <span class="material-symbols-outlined">hub</span>
      <div>
        <p>symbiote-ui</p>
        <h1>Agent UI construction library</h1>
        <span>
          Components, layouts, theme cascade, graph surfaces, chat, and WebMCP
          metadata are packaged as reusable building blocks for runtime UI
          construction.
        </span>
      </div>
    </header>

    <div class="showcase-overview-grid">
      <article>
        <span class="material-symbols-outlined">view_quilt</span>
        <strong>Layout first</strong>
        <p>Top tabs switch project-type layout groups. The left sidebar belongs only to the active project type.</p>
      </article>
      <article>
        <span class="material-symbols-outlined">smart_toy</span>
        <strong>One page agent</strong>
        <p>The right agent chat is one standard collapsed layout panel, shared across every view.</p>
      </article>
      <article>
        <span class="material-symbols-outlined">settings_suggest</span>
        <strong>Engine boundary</strong>
        <p>symbiote-ui owns UI composition. symbiote-engine owns execution, workflows, persistence, and server runtime.</p>
      </article>
      <article>
        <span class="material-symbols-outlined">api</span>
        <strong>Agent-readable</strong>
        <p>WebMCP descriptors explain what components do and which inputs, state, and actions agents can use.</p>
      </article>
    </div>

    <section class="showcase-project-map" aria-label="Project type tabs">
      <div class="showcase-project-map-header">
        <span class="material-symbols-outlined">folder_open</span>
        <strong>Project types shown by the demo</strong>
      </div>
      <div class="showcase-project-list" itemize="projects">
        <template>
          <div class="showcase-project-pill">
            <span class="material-symbols-outlined">{{icon}}</span>
            <strong>{{name}}</strong>
            <small>{{summary}}</small>
          </div>
        </template>
      </div>
    </section>
  </section>
`;

CascadeOverviewPanel.rootStyles = `
  cascade-overview-panel {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--sn-panel-bg);
    color: var(--sn-text);
  }

  cascade-overview-panel .showcase-overview {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: var(--sn-lab-panel-gap, 14px);
    height: 100%;
    min-height: 0;
    padding: var(--sn-lab-panel-padding, 16px);
    overflow: auto;
    scrollbar-color: var(--sn-scrollbar-thumb) var(--sn-scrollbar-track);
  }

  cascade-overview-panel .showcase-overview-hero {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: clamp(14px, 2vw, 24px);
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
    background:
      radial-gradient(circle at 10% 0%, color-mix(in oklab, var(--sn-node-selected) 24%, transparent), transparent 38%),
      color-mix(in oklab, var(--sn-node-bg) 90%, var(--sn-bg));
  }

  cascade-overview-panel .showcase-overview-hero > .material-symbols-outlined {
    display: grid;
    place-items: center;
    width: calc(58px * var(--sn-theme-density, 1));
    aspect-ratio: 1;
    border-radius: 50%;
    background: var(--sn-node-bg);
    color: var(--sn-node-selected);
    font-size: calc(30px * var(--sn-theme-icon-scale, 1));
  }

  cascade-overview-panel .showcase-overview-hero p,
  cascade-overview-panel .showcase-overview-hero h1,
  cascade-overview-panel .showcase-overview-hero span {
    margin: 0;
  }

  cascade-overview-panel .showcase-overview-hero p {
    color: var(--sn-node-selected);
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
    font-weight: 700;
    text-transform: uppercase;
  }

  cascade-overview-panel .showcase-overview-hero h1 {
    margin-top: 4px;
    color: var(--sn-text);
    font-size: calc(26px * var(--sn-theme-heading-scale, 1));
    line-height: 1.08;
  }

  cascade-overview-panel .showcase-overview-hero span {
    display: block;
    margin-top: 8px;
    max-width: 760px;
    color: var(--sn-text-dim);
    font-size: calc(14px * var(--sn-theme-type-scale, 1));
    line-height: 1.45;
  }

  cascade-overview-panel .showcase-overview-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sn-lab-panel-gap, 10px);
  }

  cascade-overview-panel .showcase-overview-grid article,
  cascade-overview-panel .showcase-project-map {
    min-width: 0;
    padding: var(--sn-lab-panel-padding, 12px);
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
    background: var(--sn-node-bg);
  }

  cascade-overview-panel article .material-symbols-outlined {
    color: var(--sn-node-selected);
    font-size: calc(21px * var(--sn-theme-icon-scale, 1));
  }

  cascade-overview-panel article strong {
    display: block;
    margin-top: 8px;
    font-size: calc(14px * var(--sn-theme-type-scale, 1));
  }

  cascade-overview-panel article p {
    margin: 6px 0 0;
    color: var(--sn-text-dim);
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
    line-height: 1.4;
  }

  cascade-overview-panel .showcase-project-map {
    display: grid;
    gap: 10px;
  }

  cascade-overview-panel .showcase-project-map-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--sn-text);
  }

  cascade-overview-panel .showcase-project-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  cascade-overview-panel .showcase-project-pill {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 3px 8px;
    align-items: center;
    min-width: 0;
    padding: 9px 10px;
    border: 1px solid color-mix(in oklab, var(--sn-node-border) 72%, transparent);
    border-radius: var(--sn-node-radius);
    background: color-mix(in oklab, var(--sn-bg) 72%, var(--sn-node-bg));
  }

  cascade-overview-panel .showcase-project-pill .material-symbols-outlined {
    grid-row: span 2;
    color: var(--sn-node-selected);
    font-size: calc(18px * var(--sn-theme-icon-scale, 1));
  }

  cascade-overview-panel .showcase-project-pill strong,
  cascade-overview-panel .showcase-project-pill small {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  cascade-overview-panel .showcase-project-pill strong {
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
  }

  cascade-overview-panel .showcase-project-pill small {
    color: var(--sn-text-dim);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
  }

  @media (max-width: 900px) {
    cascade-overview-panel .showcase-overview-grid,
    cascade-overview-panel .showcase-project-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 620px) {
    cascade-overview-panel .showcase-overview-hero,
    cascade-overview-panel .showcase-overview-grid,
    cascade-overview-panel .showcase-project-list {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;

CascadeOverviewPanel.reg('cascade-overview-panel');

class CascadeGraphPanel extends Symbiote {
  initCallback() {
    this._pathStyle = 'pcb';
    this.addEventListener('panel-menu-action', (event) => {
      if (event.detail?.actionId?.startsWith('path:')) {
        this._pathStyle = event.detail.actionId.slice(5);
        this.ref.canvas?.setPathStyle(this._pathStyle);
        this._syncGraphShell();
        this.dispatchEvent(new CustomEvent('panel-menu-actions', {
          bubbles: true,
          composed: true,
          detail: { actions: this._panelActions() },
        }));
        return;
      }
      if (event.detail?.actionId?.startsWith('graph:')) {
        this._handleGraphShellAction(event.detail.actionId.slice(6));
      }
    });
    this.addEventListener('graph-shell-path-style-change', (event) => {
      this._pathStyle = event.detail?.style || 'pcb';
      this.ref.canvas?.setPathStyle(this._pathStyle);
      this._syncGraphShell();
      this.dispatchEvent(new CustomEvent('panel-menu-actions', {
        bubbles: true,
        composed: true,
        detail: { actions: this._panelActions() },
      }));
    });
    this.addEventListener('graph-shell-action', (event) => {
      this._handleGraphShellAction(event.detail?.action);
    });
  }

  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    const canvas = this.ref.canvas;
    const socket = new Socket('flow', {
      color: 'var(--sn-node-selected)',
    });
    const editor = new NodeEditor();
    this._editor = editor;
    this._socket = socket;
    this._generatedNodeCount = 0;

    let source = new Node('Theme source', {
      id: 'theme-source',
      type: 'source',
      category: 'server',
      shape: 'disc',
      icon: 'tune',
    });
    source.params = {
      summary: ':root owns source tokens. Components only inherit.',
      size: 112,
    };
    source.addOutput('tokens', new Output(socket, 'tokens'));
    editor.addNode(source);

    let canvasNode = new Node('Node canvas', {
      id: 'node-canvas-sample',
      type: 'canvas',
      category: 'module',
      shape: 'rect',
      icon: 'hub',
    });
    canvasNode.params = {
      summary: 'Connection colors, sockets, node surfaces, and scrollbars update from the same cascade.',
    };
    canvasNode.addInput('in', new Input(socket, 'in'));
    canvasNode.addOutput('next', new Output(socket, 'next'));
    editor.addNode(canvasNode);

    let layoutNode = new Node('Layout shell', {
      id: 'layout-shell-sample',
      type: 'layout',
      category: 'data',
      shape: 'rect',
      icon: 'view_quilt',
    });
    layoutNode.params = {
      summary: 'Panel headers, borders, hover states, and bridge traces consume the same provider tokens.',
    };
    layoutNode.addInput('in', new Input(socket, 'in'));
    layoutNode.addOutput('next', new Output(socket, 'next'));
    editor.addNode(layoutNode);

    let controlsNode = new Node('Controls', {
      id: 'controls-sample',
      type: 'controls',
      category: 'control',
      shape: 'rect',
      icon: 'tune',
    });
    controlsNode.params = {
      summary: 'Buttons, banners, cards, and tree rows follow brightness, contrast, and accent chroma.',
    };
    controlsNode.addInput('in', new Input(socket, 'in'));
    controlsNode.addOutput('next', new Output(socket, 'next'));
    editor.addNode(controlsNode);

    let circleIconNode = new Node('Circle icon', {
      id: 'circle-icon-sample',
      type: 'agent',
      category: 'control',
      shape: 'circle',
      icon: 'schema',
    });
    circleIconNode.addInput('in', new Input(socket, 'in'));
    circleIconNode.addOutput('next', new Output(socket, 'next'));
    editor.addNode(circleIconNode);

    let circleImageNode = new Node('Circle image', {
      id: 'circle-image-sample',
      type: 'media',
      category: 'data',
      shape: 'circle',
      icon: 'image',
    });
    circleImageNode.params = {
      image: CIRCLE_SAMPLE_IMAGE,
      imageAlt: 'Circular media sample',
    };
    circleImageNode.addInput('in', new Input(socket, 'in'));
    circleImageNode.addOutput('next', new Output(socket, 'next'));
    editor.addNode(circleImageNode);

    let pillNode = new Node('Pill route', {
      id: 'pill-sample',
      type: 'route',
      category: 'instance',
      shape: 'pill',
      icon: 'route',
    });
    pillNode.addInput('in', new Input(socket, 'in'));
    pillNode.addOutput('next', new Output(socket, 'next'));
    editor.addNode(pillNode);

    let svgNode = new Node('SVG shape', {
      id: 'svg-shape-sample',
      type: 'svg',
      category: 'function',
      shape: 'hexagon',
      icon: 'schema',
    });
    svgNode.params = {
      media: SVG_NODE_SAMPLE_IMAGE,
      mediaAlt: 'Hexagonal SVG node sample',
      size: 118,
    };
    svgNode.addInput('in', new Input(socket, 'in'));
    svgNode.addOutput('next', new Output(socket, 'next'));
    editor.addNode(svgNode);

    let commentNode = new Node('Comment', {
      id: 'comment-sample',
      type: 'note',
      category: 'default',
      shape: 'comment',
      icon: 'sticky_note_2',
    });
    commentNode.params = {
      summary: 'Comment surfaces follow the same text, spacing, and outline cascade.',
    };
    commentNode.addInput('in', new Input(socket, 'in'));
    commentNode.addOutput('next', new Output(socket, 'next'));
    editor.addNode(commentNode);

    editor.addConnection(new Connection(source, 'tokens', canvasNode, 'in'));
    editor.addConnection(new Connection(canvasNode, 'next', layoutNode, 'in'));
    editor.addConnection(new Connection(layoutNode, 'next', controlsNode, 'in'));
    editor.addConnection(new Connection(controlsNode, 'next', circleIconNode, 'in'));
    editor.addConnection(new Connection(circleIconNode, 'next', circleImageNode, 'in'));
    editor.addConnection(new Connection(circleImageNode, 'next', pillNode, 'in'));
    editor.addConnection(new Connection(pillNode, 'next', svgNode, 'in'));
    editor.addConnection(new Connection(svgNode, 'next', commentNode, 'in'));

    canvas.setEditor(editor);
    canvas.setReadonly(true);
    canvas.setReadonlyNodeDragging(true);
    canvas.setPanels(false);
    canvas.setViewportLocked(false);
    canvas.setPathStyle(this._pathStyle);
    this._syncGraphShell();
    canvas.$.zoom = 1;
    canvas.$.panX = 0;
    canvas.$.panY = 0;

    this._flowNodeIds = [
      source.id,
      canvasNode.id,
      layoutNode.id,
      controlsNode.id,
      circleIconNode.id,
      circleImageNode.id,
      pillNode.id,
      svgNode.id,
      commentNode.id,
    ];
    this._lastFlowNode = commentNode;

    const place = () => this._applyGraphFlowLayout();

    place();
    this._resizeObserver = new ResizeObserver(place);
    this._resizeObserver.observe(canvas);
  }

  _pathActions() {
    return [
      { id: 'path:pcb', label: 'PCB', icon: 'conversion_path', active: this._pathStyle === 'pcb', group: 'path', groupLabel: 'Links' },
      { id: 'path:bezier', label: 'Bezier', icon: 'gesture', active: this._pathStyle === 'bezier', group: 'path', groupLabel: 'Links' },
      { id: 'path:straight', label: 'Straight', icon: 'horizontal_rule', active: this._pathStyle === 'straight', group: 'path', groupLabel: 'Links' },
    ];
  }

  _graphActions() {
    return [
      { id: 'graph:insert-node', label: 'Add node', icon: 'add_circle', group: 'graph', groupLabel: 'Graph' },
      { id: 'graph:insert-edge', label: 'Add edge', icon: 'add_link', group: 'graph', groupLabel: 'Graph' },
      { id: 'graph:fit-view', label: 'Fit', icon: 'fit_screen', group: 'graph', groupLabel: 'Graph' },
      { id: 'graph:reset-view', label: 'Reset view', icon: 'center_focus_strong', group: 'graph', groupLabel: 'Graph' },
    ];
  }

  _panelActions() {
    return [...this._pathActions(), ...this._graphActions()];
  }

  _syncGraphShell() {
    this.ref.shell?.setPathStyle?.(this._pathStyle);
    this.ref.shell?.setStats?.([
      { value: this._flowNodeIds?.length || 0, label: 'nodes' },
      { value: this._editor?.connections?.size || 0, label: 'links' },
      { value: this._pathStyle.toUpperCase(), label: 'routes' },
    ]);
  }

  _handleGraphShellAction(action) {
    if (action === 'insert-node') {
      this._insertDemoNode();
    } else if (action === 'insert-edge') {
      this._insertDemoEdge();
    } else if (action === 'fit-view') {
      this.ref.canvas?.fitView?.();
    } else if (action === 'reset-view') {
      this.ref.canvas.$.zoom = 1;
      this.ref.canvas.$.panX = 0;
      this.ref.canvas.$.panY = 0;
      this._applyGraphFlowLayout();
    }
  }

  _applyGraphFlowLayout() {
    const canvas = this.ref.canvas;
    if (!canvas || !this._flowNodeIds?.length) return;
    requestAnimationFrame(() => {
      canvas.setFlowLayout({
        nodeIds: this._flowNodeIds,
        direction: 'vertical',
        gap: 76,
        padding: { top: 42, right: 28, bottom: 42, left: 28 },
        align: 'center',
        scroll: false,
      });
      canvas.fitView?.();
      this._syncGraphShell();
    });
  }

  _insertDemoNode() {
    if (!this._editor || !this._socket) return;
    this._generatedNodeCount += 1;
    const node = new Node(`Generated ${this._generatedNodeCount}`, {
      id: `generated-node-${this._generatedNodeCount}`,
      type: 'agent',
      category: 'function',
      shape: this._generatedNodeCount % 2 === 0 ? 'pill' : 'rect',
      icon: 'auto_awesome',
    });
    node.params = {
      summary: 'Inserted at runtime by the graph explorer shell action.',
    };
    node.addInput('in', new Input(this._socket, 'in'));
    node.addOutput('next', new Output(this._socket, 'next'));
    this._editor.addNode(node);
    if (this._lastFlowNode?.outputs?.next) {
      this._editor.addConnection(new Connection(this._lastFlowNode, 'next', node, 'in'));
    }
    this._lastFlowNode = node;
    this._flowNodeIds.push(node.id);
    this._applyGraphFlowLayout();
  }

  _insertDemoEdge() {
    if (!this._editor || this._flowNodeIds.length < 2) return;
    const source = this._editor.getNode(this._flowNodeIds.at(-2));
    const target = this._editor.getNode(this._flowNodeIds.at(-1));
    if (!source || !target || !source.outputs?.next || !target.inputs?.in) return;
    const exists = this._editor.getConnections().some((connection) => (
      connection.from === source.id
      && connection.to === target.id
      && connection.out === 'next'
      && connection.in === 'in'
    ));
    if (!exists) {
      this._editor.addConnection(new Connection(source, 'next', target, 'in'));
    }
    this._applyGraphFlowLayout();
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    super.disconnectedCallback?.();
  }
}

CascadeGraphPanel.template = html`
  <graph-explorer-shell class="lab-graph-explorer" ${{ ref: 'shell' }}>
    <node-canvas class="lab-canvas" slot="canvas" ${{ ref: 'canvas' }}></node-canvas>
    <div class="graph-explorer-stats lab-graph-stats" slot="stats"></div>
  </graph-explorer-shell>
`;

CascadeGraphPanel.rootStyles = `
  cascade-graph-panel {
    display: block;
    width: 100%;
    height: 100%;
  }

  cascade-graph-panel .lab-graph-explorer {
    width: 100%;
    height: 100%;
  }

  cascade-graph-panel .lab-graph-stats {
    color: var(--sn-text-muted, var(--sn-text-dim, currentColor));
    font-size: var(--sn-small-size, 0.78rem);
    white-space: nowrap;
  }
`;

CascadeGraphPanel.reg('cascade-graph-panel');

class CascadeUiPanel extends Symbiote {
  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    const grid = this.ref.grid;
    const tree = this.ref.tree;
    const tokenNames = [
      '--sn-bg',
      '--sn-panel-bg',
      '--sn-node-bg',
      '--sn-node-border',
      '--sn-node-selected',
      '--sn-cat-server',
      '--sn-cat-control',
      '--sn-cat-data',
      '--sn-type-source',
      '--sn-type-canvas',
      '--sn-type-layout',
      '--sn-type-controls',
      '--sn-type-action',
      '--sn-tab-accent-0',
      '--sn-tab-accent-1',
      '--sn-tab-accent-2',
      '--sn-text',
      '--sn-text-dim',
      '--sn-scrollbar-thumb',
      '--sn-theme-outline-strength',
      '--sn-theme-type-scale',
      '--sn-theme-heading-scale',
      '--sn-theme-density',
      '--sn-shape-stroke',
      '--sn-shape-stroke-width',
      '--sn-node-label-size',
      '--sn-markdown-h1-size',
      '--sn-chat-markdown-h1-size',
      '--sn-chat-bg',
      '--sn-chat-user-message-bg',
      '--sn-composer-bg',
      '--sn-chat-list-header-padding',
      '--sn-chat-list-item-padding',
      '--sn-chat-sidebar-header-padding',
      '--sn-chat-sidebar-row-padding',
      '--sn-syntax-keyword',
      '--sn-cell-dot',
      '--sn-cell-noise',
      '--sn-node-icon-size',
      '--sn-node-pill-body-padding',
      '--sn-node-circle-body-padding',
      '--sn-node-comment-body-padding',
      '--sn-shape-icon-size',
      '--sn-port-label-size',
      '--sn-layout-header-icon-size',
    ];
    const renderTokens = () => {
      const computed = getComputedStyle(document.documentElement);
      grid.innerHTML = tokenNames.map((name) => `
        <div class="token-chip">
          <strong>${name}</strong>
          <span>${computed.getPropertyValue(name).trim()}</span>
        </div>
      `).join('');
    };

    tree.setItems([
      { id: 'theme', label: 'Theme', icon: 'palette', children: [
        { id: 'source', label: 'Source tokens', icon: 'tune' },
        { id: 'cascade', label: 'Cascade output', icon: 'waterfall_chart' },
      ] },
      { id: 'components', label: 'Components', icon: 'widgets', children: [
        { id: 'layout', label: 'Layout', icon: 'view_quilt' },
        { id: 'graph', label: 'Graph canvas', icon: 'hub' },
        { id: 'chat', label: 'Chat', icon: 'forum' },
        { id: 'controls', label: 'Controls', icon: 'smart_button' },
      ] },
    ]);
    tree.showTree?.();
    tree.selectedId = 'cascade';
    this.ref.loading.setProgress(64, 'Composing UI', 'Hydrating reusable surfaces');
    this.ref.status.$.fadeTimeout = 60000;
    this.ref.status.$.statusText = 'Constructor surfaces ready';
    this.ref.status.$.visible = true;
    this.ref.events.setEvents([
      {
        direction: 'call',
        tool: 'component.describe',
        args: { tagName: 'sn-data-table' },
        timeText: 'now',
      },
      {
        direction: 'result',
        tool: 'component.describe',
        success: true,
        durationText: '24ms',
        preview: {
          type: 'list',
          title: 'Descriptor fields',
          value: ['componentDescription', 'contract.webmcp', 'contract.ssr'],
        },
      },
      {
        direction: 'result',
        tool: 'component.render',
        success: true,
        durationText: '41ms',
        preview: {
          type: 'code',
          lang: 'js',
          value: 'layout.openPanel("source", { uiInvoked: true });',
        },
      },
    ]);
    this.ref.table.setData({
      columns: [
        { key: 'component', label: 'Component' },
        { key: 'role', label: 'Role' },
        { key: 'state', label: 'State', align: 'center' },
      ],
      rows: [
        {
          id: 'table',
          component: 'sn-data-table',
          role: 'tabular data',
          cells: { state: { badge: { label: 'ready', variant: 'success' } } },
        },
        {
          id: 'feed',
          component: 'sn-event-feed',
          role: 'tool trace',
          cells: { state: { badge: { label: 'live', variant: 'info' } } },
        },
        {
          id: 'source',
          component: 'source-viewer',
          role: 'source panel',
          cells: { state: { badge: { label: 'agent', variant: 'warning' } } },
        },
      ],
      emptyText: 'No constructor surfaces',
    });
    this.ref.source.showFile({
      path: 'agent-ui/constructor.js',
      lang: 'js',
      raw: [
        'let descriptor = catalog.find((item) => item.tagName === "sn-event-feed");',
        'layout.openPanel("events", { uiInvoked: true, source: "agent" });',
        'events.setEvents(toolTrace);',
      ].join('\n'),
      statsText: '3 agent-visible steps',
    });
    this._renderTokens = renderTokens;
    renderTokens();
    document.addEventListener('cascade-theme-change', renderTokens);
  }

  disconnectedCallback() {
    if (this._renderTokens) {
      document.removeEventListener('cascade-theme-change', this._renderTokens);
    }
    super.disconnectedCallback?.();
  }
}

CascadeUiPanel.template = html`
      <section class="sample-panel">
        <sn-banner variant="info">Cascade tokens update this banner without component-local theme calls.</sn-banner>
        <div class="sample-row">
          <sn-button variant="primary">primary</sn-button>
          <sn-button>default</sn-button>
          <sn-button variant="icon" title="Icon button"><span class="material-symbols-outlined">bolt</span></sn-button>
          <sn-badge>agent</sn-badge>
          <sn-badge variant="success">live</sn-badge>
        </div>
        <div class="sample-scroll">
          <div class="sample-stack">
            <sn-card>
              <strong>Provider surface</strong>
              <p>Cards, controls, graph nodes, and scrollbars read the same inherited variables.</p>
            </sn-card>
            <div class="constructor-surface-grid">
              <div class="constructor-overlay-sample">
                <sn-loading-overlay ${{ ref: 'loading' }}></sn-loading-overlay>
              </div>
              <sn-status-ribbon ${{ ref: 'status' }}></sn-status-ribbon>
              <sn-empty-state>
                <strong>No host data</strong>
                <span>Agents can mount an empty state while a host-owned query resolves.</span>
              </sn-empty-state>
              <sn-event-feed ${{ ref: 'events' }}></sn-event-feed>
              <sn-list-detail-shell
                has-detail
                sidebar-title="Surfaces"
                sidebar-icon="view_sidebar"
                detail-title="Source viewer"
                detail-icon="code"
                detail-description="Host-owned file data"
              >
                <div slot="list" class="constructor-list">
                  <button type="button" class="constructor-list-item" data-active>source-viewer</button>
                  <button type="button" class="constructor-list-item">sn-data-table</button>
                  <button type="button" class="constructor-list-item">sn-event-feed</button>
                </div>
                <source-viewer slot="detail" ${{ ref: 'source' }}></source-viewer>
              </sn-list-detail-shell>
              <sn-data-table ${{ ref: 'table' }}></sn-data-table>
            </div>
            <div class="token-grid" data-token-grid ${{ ref: 'grid' }}></div>
            <sn-tree-panel title="Cascade tree" title-icon="account_tree" ${{ ref: 'tree' }}></sn-tree-panel>
          </div>
        </div>
      </section>
`;

CascadeUiPanel.rootStyles = `
  cascade-ui-panel {
    display: block;
    width: 100%;
    height: 100%;
  }

  cascade-ui-panel .constructor-surface-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
    gap: calc(var(--sn-space, 1rem) * 0.7);
    min-width: 0;
  }

  cascade-ui-panel .constructor-overlay-sample,
  cascade-ui-panel sn-status-ribbon,
  cascade-ui-panel sn-empty-state {
    min-height: 84px;
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius, 8px);
    background: var(--sn-panel-bg, var(--sn-bg));
  }

  cascade-ui-panel .constructor-overlay-sample {
    position: relative;
    overflow: hidden;
  }

  cascade-ui-panel sn-status-ribbon {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: calc(var(--sn-space, 1rem) * 0.55);
  }

  cascade-ui-panel sn-empty-state {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: calc(var(--sn-space, 1rem) * 0.28);
    padding: calc(var(--sn-space, 1rem) * 0.65);
    color: var(--sn-text-dim, currentColor);
  }

  cascade-ui-panel sn-empty-state strong {
    color: var(--sn-text, currentColor);
  }

  cascade-ui-panel sn-event-feed,
  cascade-ui-panel sn-list-detail-shell,
  cascade-ui-panel sn-data-table {
    min-height: 180px;
    min-width: 0;
  }

  cascade-ui-panel sn-list-detail-shell,
  cascade-ui-panel sn-data-table {
    grid-column: 1 / -1;
  }

  cascade-ui-panel source-viewer {
    min-height: 220px;
    min-width: 0;
  }

  cascade-ui-panel .constructor-list {
    display: grid;
    gap: calc(var(--sn-space, 1rem) * 0.35);
    padding: calc(var(--sn-space, 1rem) * 0.45);
  }

  cascade-ui-panel .constructor-list-item {
    min-width: 0;
    min-height: calc(var(--sn-control-height, 2rem) * 0.9);
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-control-radius, 0.45rem);
    background: var(--sn-control-bg, var(--sn-node-bg));
    color: var(--sn-control-fg, var(--sn-text));
    font: inherit;
    text-align: left;
    padding: 0 calc(var(--sn-space, 1rem) * 0.55);
  }

  cascade-ui-panel .constructor-list-item[data-active] {
    border-color: var(--sn-node-selected);
    background: var(--sn-node-selected-bg, var(--sn-accent-bg-subtle));
  }

  @media (max-width: 760px) {
    cascade-ui-panel .constructor-surface-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
`;

CascadeUiPanel.reg('cascade-ui-panel');

const PROJECT_TREE_ITEMS = [
  {
    id: 'src',
    label: 'src',
    icon: 'folder',
    children: [
      {
        id: 'src/components',
        label: 'components',
        icon: 'folder',
        children: [
          { id: 'src/components/chat-composer.js', label: 'chat-composer.js', icon: 'forum', badges: ['voice'] },
          { id: 'src/components/node-canvas.js', label: 'node-canvas.js', icon: 'hub', badges: ['graph'] },
          { id: 'src/components/source-viewer.js', label: 'source-viewer.js', icon: 'article', badges: ['md'] },
        ],
      },
      {
        id: 'src/runtime',
        label: 'runtime',
        icon: 'folder',
        children: [
          { id: 'src/runtime/intent-router.js', label: 'intent-router.js', icon: 'alt_route', badges: ['WebMCP'] },
          { id: 'src/runtime/layout-state.js', label: 'layout-state.js', icon: 'view_quilt', badges: ['SSR'] },
        ],
      },
    ],
  },
  {
    id: 'docs',
    label: 'docs',
    icon: 'folder',
    children: [
      { id: 'docs/agent-workspace.md', label: 'agent-workspace.md', icon: 'description', badges: ['rendered'] },
      { id: 'docs/webmcp.md', label: 'webmcp.md', icon: 'api', badges: ['agent'] },
    ],
  },
  {
    id: 'layouts',
    label: 'layouts',
    icon: 'folder',
    children: [
      { id: 'layouts/default.layout.json', label: 'default.layout.json', icon: 'data_object', badges: ['live'] },
      { id: 'layouts/chat.layout.json', label: 'chat.layout.json', icon: 'forum', badges: ['chat'] },
    ],
  },
];

const PROJECT_GRAPH_MODEL = {
  nodes: [
    { id: 'src', label: 'src', type: 'data', isGroup: true, children: ['chat', 'canvas', 'viewer', 'runtime'] },
    { id: 'docs', label: 'docs', type: 'docs', isGroup: true, children: ['readme', 'webmcp'] },
    { id: 'layouts', label: 'layouts', type: 'config', isGroup: true, children: ['layout-default', 'layout-chat'] },
    { id: 'chat', label: 'chat-composer.js', type: 'action', parentId: 'src' },
    { id: 'canvas', label: 'node-canvas.js', type: 'output', parentId: 'src' },
    { id: 'viewer', label: 'source-viewer.js', type: 'docs', parentId: 'src' },
    { id: 'runtime', label: 'intent-router.js', type: 'action', parentId: 'src' },
    { id: 'readme', label: 'agent-workspace.md', type: 'docs', parentId: 'docs' },
    { id: 'webmcp', label: 'webmcp.md', type: 'docs', parentId: 'docs' },
    { id: 'layout-default', label: 'default.layout.json', type: 'config', parentId: 'layouts' },
    { id: 'layout-chat', label: 'chat.layout.json', type: 'config', parentId: 'layouts' },
  ],
  edges: [
    { from: 'runtime', to: 'chat' },
    { from: 'runtime', to: 'canvas' },
    { from: 'viewer', to: 'readme' },
    { from: 'webmcp', to: 'runtime' },
    { from: 'layout-default', to: 'canvas' },
    { from: 'layout-chat', to: 'chat' },
  ],
  rootNodes: ['src', 'docs', 'layouts'],
};

class CascadeProjectPanel extends Symbiote {
  initCallback() {
    this.addEventListener('sn-tree-select', (event) => {
      this._selectProjectFile(event.detail?.item);
    });
  }

  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    this.ref.tree.setItems(PROJECT_TREE_ITEMS);
    this.ref.tree.showTree?.();
    this.ref.tree.defaultExpandedIds = ['src', 'src/components', 'src/runtime', 'docs', 'layouts'];
    this.ref.tree.selectedId = 'docs/agent-workspace.md';
  }

  _selectProjectFile(item) {
    if (!item || Array.isArray(item.children)) return;
    this.ref.tree.selectedId = item.id;
    this.dispatchEvent(new CustomEvent('cascade-project-file-select', {
      detail: { item },
      bubbles: true,
      composed: true,
    }));
  }
}

CascadeProjectPanel.template = html`
  <section class="project-files-panel">
    <sn-tree-panel
      class="project-file-tree"
      title="Project files"
      title-icon="account_tree"
      filter-placeholder="Filter project files"
      ${{ ref: 'tree' }}
    ></sn-tree-panel>
    <footer class="project-files-contract">
      <span class="material-symbols-outlined" aria-hidden="true">sync_alt</span>
      <span>Tree selection emits file intent. Source, docs, and graph render in separate layout panels.</span>
    </footer>
  </section>
`;

const PROJECT_SOURCE_SAMPLE = [
  'import { createRuntimeUiController } from "symbiote-ui/runtime";',
  '',
  'const controller = createRuntimeUiController({ root, layout });',
  '',
  'controller.create({',
  '  id: "chat-surface",',
  '  tagName: "chat-composer",',
  '  state: {',
  '    methods: {',
  '      setVoiceControls: [{ input: { visible: true }, wakeListen: { visible: true } }]',
  '    }',
  '  }',
  '});',
  '',
  'layout.openPanel("chat", { uiInvoked: true, source: "agent" });',
].join('\n');

const PROJECT_MARKDOWN_SAMPLE = [
  '# Agent workspace',
  '',
  'The same library renders project navigation, source editing, markdown previews, chat controls, graph construction, and live layout panels.',
  '',
  '- `sn-tree-panel` owns project/file navigation.',
  '- `source-editor` edits host-owned source text.',
  '- `source-viewer` renders code, markdown, images, and diagnostics.',
  '- `canvas-graph` shows a project overview graph distinct from editable `node-canvas`.',
].join('\n');

class CascadeSourcePanel extends Symbiote {
  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    this.ref.editor.setLanguage('js');
    this.ref.editor.setContent(PROJECT_SOURCE_SAMPLE);
  }
}

CascadeSourcePanel.template = html`
  <section class="project-source-panel">
    <header class="project-panel-intro">
      <span class="material-symbols-outlined" aria-hidden="true">code</span>
      <div>
        <strong>Source editor</strong>
        <span>One focused panel for agent-authored code and runtime intents.</span>
      </div>
    </header>
    <source-editor
      class="project-source-editor"
      aria-label="Agent-authored source editor"
      ${{ ref: 'editor' }}
    ></source-editor>
  </section>
`;

class CascadeDocsPanel extends Symbiote {
  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    this.ref.viewer.showFile({
      path: 'docs/agent-workspace.md',
      lang: 'md',
      raw: PROJECT_MARKDOWN_SAMPLE,
      statsText: 'rendered markdown',
    });
  }
}

CascadeDocsPanel.template = html`
  <section class="project-docs-panel">
    <source-viewer class="project-markdown-viewer" ${{ ref: 'viewer' }}></source-viewer>
  </section>
`;

class CascadeProjectMapPanel extends Symbiote {
  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    this.ref.graph.setGraphModel(PROJECT_GRAPH_MODEL);
    setTimeout(() => {
      this.ref.graph.fitView?.(46, false);
      this.ref.graph.pulseNode?.('runtime', 1800);
    }, 120);
  }
}

CascadeProjectMapPanel.template = html`
  <graph-explorer-shell class="project-canvas-graph-shell">
    <canvas-graph slot="canvas" ${{ ref: 'graph' }}></canvas-graph>
    <div class="graph-explorer-stats project-graph-stats" slot="stats">
      <span>canvas-graph</span><span>project overview</span>
    </div>
  </graph-explorer-shell>
`;

const PROJECT_WORKSPACE_STYLES = `
  cascade-project-panel,
  cascade-source-panel,
  cascade-docs-panel,
  cascade-project-map-panel {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  cascade-project-panel .project-files-panel,
  cascade-source-panel .project-source-panel,
  cascade-docs-panel .project-docs-panel {
    display: flex;
    flex-direction: column;
    gap: var(--sn-lab-panel-gap, 12px);
    height: 100%;
    min-height: 0;
    padding: var(--sn-lab-panel-padding, 12px);
    overflow: hidden;
    background: var(--sn-panel-bg);
    color: var(--sn-text);
  }

  cascade-project-panel .project-file-tree {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
    background: var(--sn-bg);
  }

  cascade-project-panel .project-files-contract,
  cascade-source-panel .project-panel-intro {
    display: flex;
    align-items: center;
    gap: var(--sn-lab-panel-gap, 12px);
    min-height: calc(var(--sn-layout-header-height, 32px) * 1.4);
    padding: 8px 10px;
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
    background: var(--sn-node-bg);
    color: var(--sn-text-dim);
    font-size: var(--sn-small-size, 0.78rem);
    line-height: 1.35;
  }

  cascade-source-panel .project-panel-intro strong {
    display: block;
    color: var(--sn-text);
    font-size: calc(var(--sn-body-size, 1rem) * 0.96);
  }

  cascade-source-panel .project-panel-intro span:not(.material-symbols-outlined) {
    display: block;
  }

  cascade-project-panel .project-files-contract .material-symbols-outlined,
  cascade-source-panel .project-panel-intro .material-symbols-outlined {
    color: var(--sn-primary);
    font-size: calc(20px * var(--sn-theme-type-scale, 1));
  }

  cascade-source-panel .project-source-editor,
  cascade-docs-panel .project-markdown-viewer,
  cascade-project-map-panel .project-canvas-graph-shell {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 0;
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
    background: var(--sn-bg);
    overflow: hidden;
  }

  cascade-project-map-panel .project-canvas-graph-shell {
    width: 100%;
    height: 100%;
  }

  cascade-project-map-panel canvas-graph {
    width: 100%;
    height: 100%;
  }

  cascade-project-map-panel .project-graph-stats {
    display: inline-flex;
    gap: 8px;
    color: var(--sn-text-dim);
    font-size: var(--sn-small-size, 0.78rem);
  }

  @media (max-width: 900px) {
    cascade-project-panel .project-files-panel,
    cascade-source-panel .project-source-panel,
    cascade-docs-panel .project-docs-panel {
      padding: 10px;
    }
  }
`;

CascadeProjectPanel.rootStyles = PROJECT_WORKSPACE_STYLES;
CascadeProjectPanel.reg('cascade-project-panel');
CascadeSourcePanel.rootStyles = PROJECT_WORKSPACE_STYLES;
CascadeSourcePanel.reg('cascade-source-panel');
CascadeDocsPanel.rootStyles = PROJECT_WORKSPACE_STYLES;
CascadeDocsPanel.reg('cascade-docs-panel');
CascadeProjectMapPanel.rootStyles = PROJECT_WORKSPACE_STYLES;
CascadeProjectMapPanel.reg('cascade-project-map-panel');

class CascadeChatPanel extends Symbiote {
  initCallback() {
    this.addEventListener('click', (event) => {
      let button = event.target.closest?.('[data-bg-action]');
      if (button) {
        this._applyBgAction(button.dataset.bgAction);
        return;
      }

      let voiceButton = event.target.closest?.('[data-voice-state]');
      if (voiceButton && !voiceButton.disabled) {
        this._setVoiceDemoState(voiceButton.dataset.voiceState);
      }
    });

    this.addEventListener('chat-composer-input', () => this._triggerBg(1600));
    this.addEventListener('chat-composer-submit', () => this._triggerBg(4200));
    this.addEventListener('chat-composer-send', () => this._triggerBg(4200));
    this.addEventListener('chat-composer-voice-input', () => this._setVoiceDemoState('listening'));
    this.addEventListener('chat-composer-wake-listen', () => this._setVoiceDemoState('listening'));
    this.addEventListener('chat-composer-voice-response-toggle', () => this._setVoiceDemoState('speaking'));
    this.addEventListener('chat-composer-voice-command-toggle', () => this._triggerBg(3600));
    this.addEventListener('chat-composer-voice-language-change', () => this._triggerBg(2600));
    this.addEventListener('chat-composer-voice-approve', () => this._setVoiceDemoState('transcribing'));
    this.addEventListener('chat-composer-voice-cancel', () => this._setVoiceDemoState('idle'));
    this.addEventListener('chat-composer-voice-send', () => {
      this._triggerBg(5200);
      this._queueBgStop(5600);
    });
  }

  _applyBgAction(action) {
    if (action === 'trigger') {
      this._triggerBg(9000);
    } else if (action === 'start') {
      this._startBg();
    } else if (action === 'stop') {
      this._stopBg();
    }
  }

  _triggerBg(duration = 3000) {
    if (this._bgStopTimer) clearTimeout(this._bgStopTimer);
    this._bgStopTimer = null;
    this.ref.bg?.trigger?.(duration);
  }

  _startBg() {
    if (this._bgStopTimer) clearTimeout(this._bgStopTimer);
    this._bgStopTimer = null;
    this.ref.bg?.start?.();
  }

  _stopBg() {
    if (this._bgStopTimer) clearTimeout(this._bgStopTimer);
    this._bgStopTimer = null;
    this.ref.bg?.stop?.();
  }

  _queueBgStop(delay = 3600) {
    if (this._bgStopTimer) clearTimeout(this._bgStopTimer);
    this._bgStopTimer = setTimeout(() => {
      this._bgStopTimer = null;
      this.ref.bg?.stop?.();
    }, delay);
  }

  _setVoiceDemoState(state = 'idle') {
    let normalized = ['idle', 'listening', 'transcribing', 'speaking', 'disabled'].includes(state)
      ? state
      : 'idle';
    this._voiceDemoState = normalized;
    this.querySelectorAll?.('[data-voice-state]')?.forEach((button) => {
      button.toggleAttribute('data-active', button.dataset.voiceState === normalized);
    });
    this.ref.composer?.setVoiceInputState?.(
      normalized === 'speaking' ? 'idle' : normalized,
      { enabled: normalized !== 'disabled' }
    );
    this.ref.composer?.setVoiceControls?.({
      input: {
        visible: true,
        state: normalized === 'speaking' ? 'idle' : normalized,
        enabled: normalized !== 'disabled',
      },
      wakeListen: { visible: true, active: normalized === 'listening', commandText: 'OK Agent' },
      response: { visible: true, enabled: normalized !== 'disabled', speaking: normalized === 'speaking' },
      command: { visible: true, active: normalized === 'listening', text: 'voice command' },
      language: {
        visible: true,
        mode: 'ru',
        options: [
          { mode: 'auto', label: 'auto' },
          { mode: 'ru', label: 'RU' },
          { mode: 'en', label: 'EN' },
        ],
      },
    });

    if (normalized === 'listening') {
      this.ref.composer?.setVoicePreview?.({
        mode: 'recording',
        status: 'listening',
        text: 'Voice input is streamed by the host recorder.',
        elapsed: true,
        commandHints: ['OK Agent', 'build layout', 'change theme'],
      });
      this._startBg();
    } else if (normalized === 'transcribing') {
      this.ref.composer?.setVoicePreview?.({
        mode: 'processing',
        status: 'transcribing',
        text: 'Host transcription resolves into editable text.',
      });
      this._triggerBg(6200);
      this._queueBgStop(6600);
    } else if (normalized === 'speaking') {
      this.ref.composer?.setVoicePreview?.({
        mode: 'result',
        status: 'speaking',
        text: 'The host speech output keeps the ambient activity running.',
      });
      this._startBg();
    } else {
      this.ref.composer?.clearVoicePreview?.();
      this._stopBg();
    }
  }

  renderCallback() {
    if (this._ready) return;
    this._ready = true;

    if (Number.isFinite(chatSmokeWidth) && chatSmokeWidth >= 220) {
      this.toggleAttribute('data-chat-smoke', true);
      this.style.setProperty('--stage7-chat-smoke-width', `${chatSmokeWidth}px`);
    }

    let syncSidebar = () => {
      this.ref.sidebar.setAutoCollapse?.(false);
      this.ref.sidebar.setCollapsed(true);
      this.ref.sidebar.setChats([
        {
          id: 'agent-chat',
          title: 'Agent Chat',
          icon: 'smart_toy',
          active: true,
          isRunning: true,
          metaLabel: 'project-graph',
          time: 'now',
          subChats: [
            { id: 'agent-chat-theme', title: 'Theme pass', icon: 'palette', active: true },
            { id: 'agent-chat-layout', title: 'Layout pass', icon: 'view_quilt' },
          ],
        },
        {
          id: 'review',
          title: 'Review',
          icon: 'rate_review',
          metaLabel: 'codex',
          time: '2m',
        },
        {
          id: 'handoff',
          title: 'Handoff',
          icon: 'hub',
          metaLabel: 'webmcp',
          time: '5m',
        },
      ]);
    };
    let raf = globalThis.requestAnimationFrame || ((callback) => setTimeout(callback, 0));
    raf(syncSidebar);
    this.ref.transcript.setMessageItems([
      {
        role: 'user',
        text: 'Can the theme editor change chat surfaces, markdown, code, and the animated background at once?',
      },
      {
        role: 'assistant',
        text: [
          'Yes. The cascade contract reaches chat messages, composer controls, syntax tokens, and canvas background tokens.',
          '',
          '```js',
          'applyCascadeTheme(document.documentElement, {',
          '  mode: "dark",',
          '  contrast: 58,',
          '  chroma: 89',
          '});',
          '```',
        ].join('\n'),
      },
      {
        role: 'tool',
        name: 'theme:compose',
        input: { target: ':root', tokens: ['--sn-chat-bg', '--sn-composer-bg', '--sn-syntax-keyword'] },
        result: { status: 'applied', scope: 'layout subtree' },
        done: true,
      },
    ]);
    this.ref.transcript.scrollToBottom();
    this.ref.composer.setPlaceholder('Ask the agent to build a themed component...');
    this.ref.composer.setValue('Render this response inside the current layout');
    this.ref.composer.setAttachedContext([
      { key: 'theme', name: 'cascade-theme', title: 'Cascade theme contract', icon: 'palette' },
      { key: 'chat', name: 'chat-surface', title: 'Chat components', icon: 'forum' },
    ]);
    this.ref.composer.setVoiceControls({
      input: { visible: true, state: 'idle' },
      wakeListen: { visible: true, active: true, commandText: 'OK Agent' },
      response: { visible: true, enabled: true, speaking: false },
      command: { visible: true, active: true, text: 'voice command' },
      language: {
        visible: true,
        mode: 'ru',
        options: [
          { mode: 'auto', label: 'auto' },
          { mode: 'ru', label: 'RU' },
          { mode: 'en', label: 'EN' },
        ],
      },
    });
    this.ref.composer.setFooterControls([
      {
        id: 'provider',
        kind: 'select',
        label: 'provider',
        icon: 'cloud',
        value: 'codex',
        priority: 1,
        options: [
          { value: 'codex', label: 'codex' },
          { value: 'gemini', label: 'gemini' },
          { value: 'portal', label: 'portal' },
        ],
      },
      {
        id: 'model',
        kind: 'select',
        label: 'model',
        icon: 'memory',
        value: 'gpt-5',
        priority: 2,
        options: [
          { value: 'gpt-5', label: 'gpt-5' },
          { value: 'deepseek-4', label: 'deepseek-4' },
          { value: 'gemini-pro', label: 'gemini-pro' },
        ],
      },
      {
        id: 'agent',
        kind: 'button',
        label: 'agent',
        value: 'orchestrator',
        icon: 'smart_toy',
        priority: 3,
      },
      {
        id: 'resource-group',
        kind: 'button',
        label: 'resource',
        value: 'ui-runtime',
        icon: 'hub',
        priority: 4,
      },
      {
        id: 'settings',
        kind: 'intent',
        label: 'settings',
        icon: 'tune',
        priority: 5,
      },
    ]);
    this._setVoiceDemoState('idle');
    this._triggerBg(9000);
  }

  disconnectedCallback() {
    if (this._bgStopTimer) clearTimeout(this._bgStopTimer);
    this._bgStopTimer = null;
    super.disconnectedCallback?.();
  }
}

CascadeChatPanel.template = html`
  <section class="chat-shell chat-lab-panel">
    <chat-sidebar-shell class="chat-lab-sidebar" auto-collapse="false" ${{ ref: 'sidebar' }}></chat-sidebar-shell>
    <div class="chat-view chat-lab-content">
      <chat-transcript ${{ ref: 'transcript' }}>
        <cell-bg slot="background" ${{ ref: 'bg' }}></cell-bg>
      </chat-transcript>
      <chat-composer ${{ ref: 'composer' }}></chat-composer>
    </div>
  </section>
`;

CascadeChatPanel.rootStyles = `
  cascade-chat-panel {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  cascade-chat-panel .chat-lab-panel {
    position: relative;
    display: flex;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--sn-chat-bg, transparent);
  }

  cascade-chat-panel .chat-lab-sidebar {
    position: relative;
    z-index: 2;
    flex: 0 0 auto;
    height: 100%;
  }

  cascade-chat-panel .chat-lab-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    width: auto;
    min-width: 0;
    min-height: 0;
  }

  cascade-chat-panel[data-chat-smoke] .chat-lab-content {
    align-self: flex-start;
    inline-size: min(100%, var(--stage7-chat-smoke-width));
    max-inline-size: min(100%, var(--stage7-chat-smoke-width));
  }

  cascade-chat-panel chat-transcript {
    min-height: 96px;
  }
`;

CascadeChatPanel.reg('cascade-chat-panel');

class CascadeRuntimePanel extends Symbiote {
  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    this.ref.code?.setContent?.([
      'const controller = createRuntimeUiController({ root, layout });',
      '',
      'controller.create({',
      '  id: "agent-panel",',
      '  tagName: "sn-data-table",',
      '  state: { method: "setData", args: [rows] },',
      '  intents: { rowSelect: "inspect-project-node" }',
      '});',
      '',
      'layout.openPanel("agent-panel", {',
      '  uiInvoked: true,',
      '  source: "agent-constructor"',
      '});',
    ].join('\n'), 'js');
    this.ref.events?.setEvents?.([
      { id: 'runtime-create', title: 'ui:create', status: 'done', detail: 'Component mounted with host-owned data.' },
      { id: 'runtime-update', title: 'ui:update', status: 'done', detail: 'State applied through public methods.' },
      { id: 'runtime-layout', title: 'layout:open-panel', status: 'running', detail: 'Panel insertion stays reversible.' },
    ]);
  }
}

CascadeRuntimePanel.template = html`
  <section class="workspace-showcase-panel runtime-panel">
    <sn-banner variant="info">Agents can construct components, update state, route intents, and open layout panels without a server reload.</sn-banner>
    <div class="workspace-showcase-grid">
      <article class="workspace-feature-card">
        <span class="material-symbols-outlined">memory</span>
        <strong>runtime-ui-v1</strong>
        <p>Node-safe construction helpers create, update, and tear down host-approved UI.</p>
      </article>
      <article class="workspace-feature-card">
        <span class="material-symbols-outlined">extension</span>
        <strong>WebMCP descriptors</strong>
        <p>Agents discover component capabilities, schemas, actions, and permission hints.</p>
      </article>
      <article class="workspace-feature-card">
        <span class="material-symbols-outlined">view_quilt</span>
        <strong>layout actions</strong>
        <p>Open, close, split, duplicate, and remove UI-invoked panels through reusable layout APIs.</p>
      </article>
      <article class="workspace-feature-card">
        <span class="material-symbols-outlined">verified</span>
        <strong>SSR-safe core</strong>
        <p>Root, core, runtime, manifest, and WebMCP entrypoints import without browser globals.</p>
      </article>
    </div>
    <div class="runtime-workbench">
      <code-block ${{ ref: 'code' }}></code-block>
      <sn-event-feed ${{ ref: 'events' }}></sn-event-feed>
    </div>
  </section>
`;

CascadeRuntimePanel.rootStyles = `
  cascade-runtime-panel {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  .workspace-showcase-panel {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    gap: var(--sn-lab-panel-gap, 12px);
    height: 100%;
    min-height: 0;
    padding: var(--sn-lab-panel-padding, 12px);
    overflow: auto;
    background: var(--sn-panel-bg);
    color: var(--sn-text);
    scrollbar-color: var(--sn-scrollbar-thumb) var(--sn-scrollbar-track);
    scrollbar-width: var(--sn-scrollbar-width, thin);
  }

  .workspace-showcase-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--sn-lab-panel-gap, 12px);
  }

  .workspace-feature-card {
    min-width: 0;
    padding: calc(12px * var(--sn-theme-density, 1));
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
    background: var(--sn-node-bg);
  }

  .workspace-feature-card .material-symbols-outlined {
    color: var(--sn-node-selected);
    font-size: calc(24px * var(--sn-theme-icon-scale, 1));
  }

  .workspace-feature-card strong {
    display: block;
    margin-top: 8px;
    color: var(--sn-text);
    font-size: calc(14px * var(--sn-theme-heading-scale, 1));
  }

  .workspace-feature-card p {
    margin: 6px 0 0;
    color: var(--sn-text-dim);
    font-size: calc(12px * var(--sn-theme-type-scale, 1));
    line-height: 1.45;
  }

  .runtime-workbench {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.8fr);
    gap: var(--sn-lab-panel-gap, 12px);
    min-height: 0;
  }

  .runtime-workbench code-block,
  .runtime-workbench sn-event-feed {
    min-height: 0;
    overflow: auto;
  }

  @media (max-width: 860px) {
    .workspace-showcase-grid,
    .runtime-workbench {
      grid-template-columns: 1fr;
    }
  }
`;

CascadeRuntimePanel.reg('cascade-runtime-panel');

class CascadeSpatialPanel extends Symbiote {
  initCallback() {
    this._drag = null;
    this.addEventListener('pointerdown', (event) => {
      let node = event.target.closest?.('.spatial-node');
      if (!node) return;
      event.preventDefault();
      node.setPointerCapture?.(event.pointerId);
      this._drag = {
        node,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        x: Number(node.style.getPropertyValue('--x') || 0),
        y: Number(node.style.getPropertyValue('--y') || 0),
      };
      this._selectNode(node);
    });
    this.addEventListener('pointermove', (event) => {
      if (!this._drag || event.pointerId !== this._drag.pointerId) return;
      let nextX = this._drag.x + event.clientX - this._drag.startX;
      let nextY = this._drag.y + event.clientY - this._drag.startY;
      this._setNodePosition(this._drag.node, nextX, nextY);
    });
    this.addEventListener('pointerup', (event) => this._endDrag(event));
    this.addEventListener('pointercancel', (event) => this._endDrag(event));
  }

  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    [
      ['project', 0, -132, 28],
      ['runtime', 170, -46, -12],
      ['ui', 104, 116, 18],
      ['voice', -112, 118, -24],
      ['xr', -174, -40, 36],
    ].forEach(([id, x, y, z]) => {
      let node = this.querySelector(`[data-node="${id}"]`);
      if (node) {
        node.style.setProperty('--x', x);
        node.style.setProperty('--y', y);
        node.style.setProperty('--z', z);
        node.style.setProperty('--scale', Math.max(0.72, 1 + z / 220).toFixed(3));
      }
    });
    this._selectNode(this.querySelector('[data-node="project"]'));
  }

  _setNodePosition(node, x, y) {
    let stage = this.ref.stage?.getBoundingClientRect?.();
    let maxX = Math.max(120, (stage?.width || 640) / 2 - 58);
    let maxY = Math.max(100, (stage?.height || 420) / 2 - 58);
    let nextX = Math.max(-maxX, Math.min(maxX, x));
    let nextY = Math.max(-maxY, Math.min(maxY, y));
    node.style.setProperty('--x', nextX.toFixed(1));
    node.style.setProperty('--y', nextY.toFixed(1));
    this.ref.position.textContent = `${node.dataset.node}: [${nextX.toFixed(0)}, ${nextY.toFixed(0)}, ${node.style.getPropertyValue('--z') || 0}]`;
  }

  _selectNode(node) {
    if (!node) return;
    this.querySelectorAll('.spatial-node').forEach((item) => item.toggleAttribute('data-active', item === node));
    this.ref.position.textContent = `${node.dataset.node}: [${Number(node.style.getPropertyValue('--x') || 0).toFixed(0)}, ${Number(node.style.getPropertyValue('--y') || 0).toFixed(0)}, ${node.style.getPropertyValue('--z') || 0}]`;
  }

  _endDrag(event) {
    if (!this._drag || event.pointerId !== this._drag.pointerId) return;
    this._drag.node.releasePointerCapture?.(event.pointerId);
    this._drag = null;
  }
}

CascadeSpatialPanel.template = html`
  <section class="spatial-panel">
    <div class="spatial-copy">
      <sn-banner variant="info">Desktop 3D preview: spherical nodes, shared graph data, draggable positions, and XR-ready meter-space contracts.</sn-banner>
      <div class="spatial-contracts">
        <span><span class="material-symbols-outlined">view_in_ar</span> spatial-graph-v1</span>
        <span><span class="material-symbols-outlined">touch_app</span> drag controller</span>
        <span><span class="material-symbols-outlined">account_tree</span> project structure</span>
        <span><span class="material-symbols-outlined">pan_tool_alt</span> grab nodes</span>
      </div>
    </div>
    <div class="spatial-stage" ${{ ref: 'stage' }} aria-label="Draggable spherical project graph preview">
      <div class="spatial-orbit"></div>
      <div class="spatial-link a"></div>
      <div class="spatial-link b"></div>
      <div class="spatial-link c"></div>
      <button class="spatial-node project" type="button" data-node="project">
        <span class="material-symbols-outlined">account_tree</span><strong>Project</strong>
      </button>
      <button class="spatial-node runtime" type="button" data-node="runtime">
        <span class="material-symbols-outlined">memory</span><strong>Runtime</strong>
      </button>
      <button class="spatial-node ui" type="button" data-node="ui">
        <span class="material-symbols-outlined">widgets</span><strong>UI</strong>
      </button>
      <button class="spatial-node voice" type="button" data-node="voice">
        <span class="material-symbols-outlined">record_voice_over</span><strong>Voice</strong>
      </button>
      <button class="spatial-node xr" type="button" data-node="xr">
        <span class="material-symbols-outlined">deployed_code</span><strong>XR</strong>
      </button>
      <output class="spatial-position" ${{ ref: 'position' }}>project: [0, 0, 0]</output>
    </div>
  </section>
`;

CascadeSpatialPanel.rootStyles = `
  cascade-spatial-panel {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  cascade-spatial-panel .spatial-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: var(--sn-lab-panel-gap, 12px);
    height: 100%;
    min-height: 0;
    padding: var(--sn-lab-panel-padding, 12px);
    overflow: hidden;
    background:
      radial-gradient(circle at 50% 42%, color-mix(in oklab, var(--sn-node-selected) 14%, transparent), transparent 44%),
      var(--sn-panel-bg);
    color: var(--sn-text);
  }

  cascade-spatial-panel .spatial-copy {
    display: grid;
    gap: 8px;
  }

  cascade-spatial-panel .spatial-contracts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  cascade-spatial-panel .spatial-contracts span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 8px;
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: 999px;
    background: var(--sn-node-bg);
    color: var(--sn-text-dim);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
  }

  cascade-spatial-panel .spatial-contracts .material-symbols-outlined {
    color: var(--sn-node-selected);
    font-size: calc(16px * var(--sn-theme-icon-scale, 1));
  }

  cascade-spatial-panel .spatial-stage {
    position: relative;
    min-height: 360px;
    overflow: hidden;
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
    background:
      linear-gradient(color-mix(in oklab, var(--sn-text) 5%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in oklab, var(--sn-text) 5%, transparent) 1px, transparent 1px),
      color-mix(in oklab, var(--sn-bg) 86%, var(--sn-node-selected) 6%);
    background-size: 32px 32px;
    perspective: 900px;
    touch-action: none;
  }

  cascade-spatial-panel .spatial-orbit {
    position: absolute;
    inset: 12%;
    border: 1px solid color-mix(in oklab, var(--sn-node-selected) 36%, transparent);
    border-radius: 50%;
    transform: rotateX(68deg);
    opacity: 0.72;
  }

  cascade-spatial-panel .spatial-link {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 38%;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, var(--sn-node-selected), transparent);
    transform-origin: 0 50%;
    opacity: 0.62;
  }

  cascade-spatial-panel .spatial-link.a { transform: rotate(21deg) translateX(-12%); }
  cascade-spatial-panel .spatial-link.b { transform: rotate(122deg) translateX(-16%); }
  cascade-spatial-panel .spatial-link.c { transform: rotate(-45deg) translateX(-18%); }

  cascade-spatial-panel .spatial-node {
    --x: 0;
    --y: 0;
    --z: 0;
    --scale: 1;
    position: absolute;
    left: 50%;
    top: 50%;
    display: grid;
    place-items: center;
    width: calc(82px * var(--sn-theme-density, 1));
    aspect-ratio: 1;
    min-width: 58px;
    border: var(--sn-node-border-width, 1px) solid color-mix(in oklab, var(--node-color, var(--sn-node-selected)) 56%, var(--sn-node-border));
    border-radius: 50%;
    background:
      radial-gradient(circle at 32% 26%, color-mix(in oklab, white 42%, var(--node-color, var(--sn-node-selected))), transparent 0 12%, transparent 13%),
      radial-gradient(circle at 40% 32%, color-mix(in oklab, var(--node-color, var(--sn-node-selected)) 64%, white), var(--node-color, var(--sn-node-selected)) 50%, color-mix(in oklab, var(--sn-bg) 72%, black) 100%);
    color: var(--sn-bg);
    box-shadow: 0 18px 42px color-mix(in oklab, var(--node-color, var(--sn-node-selected)) 24%, transparent);
    transform:
      translate3d(calc(var(--x) * 1px), calc(var(--y) * 1px), calc(var(--z) * 1px))
      translate(-50%, -50%)
      scale(var(--scale));
    cursor: grab;
    user-select: none;
  }

  cascade-spatial-panel .spatial-node:active {
    cursor: grabbing;
  }

  cascade-spatial-panel .spatial-node[data-active] {
    outline: max(2px, calc(2px * var(--sn-theme-outline-strength, 1))) solid var(--sn-focus-ring);
    outline-offset: 4px;
  }

  cascade-spatial-panel .spatial-node.project { --node-color: var(--sn-tab-accent-0); }
  cascade-spatial-panel .spatial-node.runtime { --node-color: var(--sn-tab-accent-1); }
  cascade-spatial-panel .spatial-node.ui { --node-color: var(--sn-tab-accent-2); }
  cascade-spatial-panel .spatial-node.voice { --node-color: var(--sn-tab-accent-3); }
  cascade-spatial-panel .spatial-node.xr { --node-color: var(--sn-tab-accent-4); }

  cascade-spatial-panel .spatial-node .material-symbols-outlined {
    font-size: calc(26px * var(--sn-theme-icon-scale, 1));
  }

  cascade-spatial-panel .spatial-node strong {
    font-size: calc(10px * var(--sn-theme-type-scale, 1));
    line-height: 1;
  }

  cascade-spatial-panel .spatial-position {
    position: absolute;
    left: 10px;
    bottom: 10px;
    max-width: calc(100% - 20px);
    padding: 5px 8px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--sn-bg) 82%, transparent);
    color: var(--sn-text-dim);
    font-size: calc(11px * var(--sn-theme-type-scale, 1));
  }
`;

CascadeSpatialPanel.reg('cascade-spatial-panel');

const shellMenu = document.querySelector('layout-shell-menu');
const sidebar = document.querySelector('#lab-sidebar');
const layout = document.querySelector('.lab-layout');
layout.setLayoutBehavior({
  minInlineSize: 240,
  minBlockSize: 180,
  responsiveMode: 'stack',
  responsiveBreakpoint: 760,
  overflow: 'collapse',
});
layout.registerPanelType('graph', {
  title: 'Graph',
  icon: 'hub',
  component: 'cascade-graph-panel',
  behavior: {
    importance: 95,
    minInlineSize: 360,
    minBlockSize: 260,
    collapse: 'auto',
  },
  menuActions: [
    { id: 'path:pcb', label: 'PCB', icon: 'conversion_path', active: true, group: 'path', groupLabel: 'Links' },
    { id: 'path:bezier', label: 'Bezier', icon: 'gesture', group: 'path', groupLabel: 'Links' },
    { id: 'path:straight', label: 'Straight', icon: 'horizontal_rule', group: 'path', groupLabel: 'Links' },
    { id: 'graph:insert-node', label: 'Add node', icon: 'add_circle', group: 'graph', groupLabel: 'Graph' },
    { id: 'graph:insert-edge', label: 'Add edge', icon: 'add_link', group: 'graph', groupLabel: 'Graph' },
    { id: 'graph:fit-view', label: 'Fit', icon: 'fit_screen', group: 'graph', groupLabel: 'Graph' },
    { id: 'graph:reset-view', label: 'Reset view', icon: 'center_focus_strong', group: 'graph', groupLabel: 'Graph' },
  ],
});
layout.registerPanelType('overview', {
  title: 'Overview',
  icon: 'hub',
  component: 'cascade-overview-panel',
  behavior: {
    importance: 100,
    minInlineSize: 480,
    minBlockSize: 320,
    collapse: 'never',
  },
});
layout.registerPanelType('ui', {
  title: 'UI',
  icon: 'widgets',
  component: 'cascade-ui-panel',
  behavior: {
    importance: 55,
    minInlineSize: 300,
    minBlockSize: 220,
    collapse: 'auto',
  },
});
layout.registerPanelType('project', {
  title: 'Project files',
  icon: 'account_tree',
  component: 'cascade-project-panel',
  behavior: {
    importance: 98,
    minInlineSize: 440,
    minBlockSize: 320,
    collapse: 'auto',
  },
});
layout.registerPanelType('source', {
  title: 'Source',
  icon: 'code',
  component: 'cascade-source-panel',
  behavior: {
    importance: 92,
    minInlineSize: 420,
    minBlockSize: 320,
    collapse: 'auto',
  },
});
layout.registerPanelType('docs', {
  title: 'Documentation',
  icon: 'description',
  component: 'cascade-docs-panel',
  behavior: {
    importance: 70,
    minInlineSize: 340,
    minBlockSize: 280,
    collapse: 'auto',
  },
});
layout.registerPanelType('project-map', {
  title: 'Project map',
  icon: 'schema',
  component: 'cascade-project-map-panel',
  behavior: {
    importance: 82,
    minInlineSize: 420,
    minBlockSize: 300,
    collapse: 'auto',
  },
});
layout.registerPanelType('chat', {
  title: 'Agent Chat',
  icon: 'smart_toy',
  component: 'cascade-chat-panel',
  behavior: {
    importance: 20,
    minInlineSize: 340,
    minBlockSize: 220,
    collapse: 'manual',
  },
});
layout.registerPanelType('theme', {
  title: 'Theme',
  icon: 'palette',
  component: 'cascade-theme-editor',
  behavior: {
    importance: 80,
    minInlineSize: 280,
    minBlockSize: 240,
    collapse: 'manual',
  },
  attributes: {
    'storage-key': CASCADE_THEME_STORAGE_KEY,
  },
});
layout.registerPanelType('runtime', {
  title: 'Runtime',
  icon: 'memory',
  component: 'cascade-runtime-panel',
  behavior: {
    importance: 70,
    minInlineSize: 320,
    minBlockSize: 260,
    collapse: 'auto',
  },
});
layout.registerPanelType('spatial', {
  title: 'Spatial',
  icon: 'view_in_ar',
  component: 'cascade-spatial-panel',
  behavior: {
    importance: 92,
    minInlineSize: 420,
    minBlockSize: 320,
    collapse: 'auto',
  },
});
layout.$.panelChrome = true;
const createPanel = (panelType, behavior) => LayoutTree.createPanel(panelType, {}, behavior);

const createCollapsedAgentChatPanel = () => {
  let panel = createPanel('chat', {
    importance: 20,
    minInlineSize: 340,
    minBlockSize: 220,
    collapse: 'manual',
  });
  panel.collapsed = true;
  panel.panelState = {
    singleton: 'page-agent-chat',
    role: 'assistant',
  };
  return panel;
};

const createShowcaseLayout = (mainLayout) => LayoutTree.createSplit(
  'horizontal',
  mainLayout,
  createCollapsedAgentChatPanel(),
  0.965,
  {
    responsiveMode: 'preserve',
    overflow: 'collapse',
  }
);

const createOverviewLayout = () => createPanel('overview', {
  importance: 100,
  minInlineSize: 520,
  minBlockSize: 360,
  collapse: 'never',
});

const createProjectLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('project', { importance: 100, minInlineSize: 560, minBlockSize: 380 }),
  createPanel('runtime', { importance: 54, minInlineSize: 340, minBlockSize: 260 }),
  0.64
);

const createProjectSourceLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('project', { importance: 92, minInlineSize: 280, minBlockSize: 320 }),
  createPanel('source', { importance: 100, minInlineSize: 480, minBlockSize: 340 }),
  0.32
);

const createProjectDocsLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('project', { importance: 82, minInlineSize: 280, minBlockSize: 320 }),
  createPanel('docs', { importance: 100, minInlineSize: 420, minBlockSize: 320 }),
  0.32
);

const createProjectMapLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('project-map', { importance: 100, minInlineSize: 520, minBlockSize: 340 }),
  createPanel('runtime', { importance: 52, minInlineSize: 320, minBlockSize: 260 }),
  0.64
);

const createGraphLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('graph', { importance: 100, minInlineSize: 520, minBlockSize: 360 }),
  createPanel('ui', { importance: 45 }),
  0.62
);

const createComponentsLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('ui', { importance: 100, minInlineSize: 420, minBlockSize: 320 }),
  createPanel('runtime', { importance: 62, minInlineSize: 340, minBlockSize: 280 }),
  0.56
);

const createChatLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('runtime', { importance: 100, minInlineSize: 420, minBlockSize: 320 }),
  createPanel('theme', { importance: 76, collapse: 'manual' }),
  0.62
);

const createResponsiveLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('graph', {
    importance: 100,
    minInlineSize: 620,
    minBlockSize: 360,
    collapse: 'never',
    overflow: 'scroll-inline',
  }),
  createPanel('ui', {
    importance: 45,
    minInlineSize: 360,
    minBlockSize: 260,
    collapse: 'auto',
  }),
  0.64
);

const createThemeLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('theme', { importance: 100, collapse: 'manual', minInlineSize: 320, minBlockSize: 280 }),
  createPanel('ui', { importance: 48 }),
  0.42
);

const createRuntimeLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('runtime', { importance: 100, minInlineSize: 420, minBlockSize: 320 }),
  createPanel('ui', { importance: 48, minInlineSize: 320, minBlockSize: 260 }),
  0.58
);

const createSpatialLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('spatial', {
    importance: 100,
    minInlineSize: 520,
    minBlockSize: 360,
    collapse: 'never',
    overflow: 'scroll-inline',
  }),
  createPanel('graph', { importance: 70, minInlineSize: 420, minBlockSize: 320 }),
  0.58
);

const view = (id, label, icon, layoutFactory, options = {}) => ({
  id,
  label,
  icon,
  layoutFactory,
  ...options,
});

const showcaseProjects = [
  {
    id: 'symbiote-ui',
    name: 'Symbiote UI',
    icon: 'hub',
    sidebarLabel: 'Symbiote UI',
    sidebarIcon: 'hub',
    color: 'var(--sn-tab-accent-0)',
    closeable: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 820, overflow: 'collapse' },
    views: [
      view('overview', 'Overview', 'map', createOverviewLayout),
      view('component-roles', 'Component roles', 'category', createComponentsLayout),
      view('layout-groups', 'Layout groups', 'view_quilt', createProjectSourceLayout),
      view('cascade-theme', 'Cascade theme', 'palette', createThemeLayout),
      view('manifest-webmcp', 'Manifest & WebMCP', 'api', createComponentsLayout),
      view('runtime-ui', 'Runtime UI', 'memory', createRuntimeLayout),
      view('engine', 'Engine link', 'settings_suggest', createRuntimeLayout),
      view('ssr-registration', 'SSR / browser', 'deployed_code', createProjectDocsLayout),
      view('spatial-bridge', 'Spatial bridge', 'view_in_ar', createSpatialLayout),
    ],
  },
  {
    id: 'chat',
    name: 'Chat',
    icon: 'forum',
    sidebarLabel: 'Chat',
    sidebarIcon: 'forum',
    color: 'var(--sn-tab-accent-2)',
    closeable: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 780, overflow: 'collapse' },
    views: [
      view('conversation', 'Conversation', 'forum', createChatLayout),
      view('voice-controls', 'Voice controls', 'record_voice_over', createChatLayout),
      view('markdown-code', 'Markdown & code', 'code_blocks', createChatLayout),
      view('runtime-panels', 'Runtime panels', 'view_quilt', createRuntimeLayout),
      view('tool-calls', 'Tool calls', 'terminal', createRuntimeLayout),
      view('history', 'Chat history', 'manage_history', createChatLayout),
      view('theme-response', 'Theme response', 'palette', createChatLayout),
    ],
  },
  {
    id: 'multi-agent-dev',
    name: 'Multi-Agent Dev',
    icon: 'account_tree',
    sidebarLabel: 'Development',
    sidebarIcon: 'account_tree',
    color: 'var(--sn-tab-accent-1)',
    closeable: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 860, overflow: 'collapse' },
    views: [
      view('project-overview', 'Project overview', 'dashboard', createProjectLayout),
      view('file-tree', 'File tree', 'folder_open', createProjectLayout),
      view('source-editor', 'Source editor', 'edit_note', createProjectSourceLayout),
      view('markdown-docs', 'Markdown/docs', 'description', createProjectDocsLayout),
      view('dependency-graph', 'Dependency graph', 'hub', createProjectMapLayout),
      view('tests-status', 'Tests & status', 'fact_check', createRuntimeLayout),
      view('review-handoffs', 'Reviews', 'rate_review', createRuntimeLayout),
      view('runtime-actions', 'Runtime actions', 'memory', createRuntimeLayout),
    ],
  },
  {
    id: 'automation',
    name: 'Automation',
    icon: 'automation',
    sidebarLabel: 'Automation',
    sidebarIcon: 'automation',
    color: 'var(--sn-tab-accent-3)',
    closeable: false,
    behavior: { responsiveMode: 'scroll-inline', responsiveBreakpoint: 900, overflow: 'collapse' },
    views: [
      view('workflow-graph', 'Workflow graph', 'schema', createGraphLayout),
      view('form-controls', 'Form controls', 'smart_button', createComponentsLayout),
      view('approvals', 'Approvals', 'approval', createRuntimeLayout),
      view('schedule', 'Schedule', 'calendar_month', createRuntimeLayout),
      view('execution-logs', 'Execution logs', 'receipt_long', createRuntimeLayout),
      view('engine-state', 'Engine state', 'settings_suggest', createRuntimeLayout),
      view('recovery', 'Recovery actions', 'restart_alt', createRuntimeLayout),
    ],
  },
  {
    id: 'media-generation',
    name: 'Media Generation',
    icon: 'auto_awesome',
    sidebarLabel: 'Media',
    sidebarIcon: 'auto_awesome',
    color: 'var(--sn-tab-accent-4)',
    closeable: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 840, overflow: 'collapse' },
    views: [
      view('prompt-builder', 'Prompt builder', 'edit_note', createProjectSourceLayout),
      view('parameters', 'Parameters', 'tune', createThemeLayout),
      view('variants', 'Variants', 'grid_view', createComponentsLayout),
      view('preview', 'Preview', 'preview', createComponentsLayout),
      view('provenance', 'Provenance', 'history_edu', createProjectDocsLayout),
      view('export', 'Export', 'ios_share', createRuntimeLayout),
    ],
  },
  {
    id: 'video-editor',
    name: 'Video Editor',
    icon: 'movie',
    sidebarLabel: 'Video',
    sidebarIcon: 'movie',
    color: 'var(--sn-tab-accent-5)',
    closeable: false,
    behavior: { responsiveMode: 'scroll-inline', responsiveBreakpoint: 960, overflow: 'collapse' },
    views: [
      view('timeline', 'Timeline', 'video_timeline', createResponsiveLayout),
      view('clip-bin', 'Clip bin', 'video_library', createComponentsLayout),
      view('preview-monitor', 'Preview monitor', 'smart_display', createComponentsLayout),
      view('transcript', 'Transcript', 'subtitles', createProjectDocsLayout),
      view('effects', 'Effects inspector', 'video_settings', createThemeLayout),
      view('render-queue', 'Render queue', 'hourglass_top', createRuntimeLayout),
      view('automation-graph', 'Automation graph', 'schema', createGraphLayout),
    ],
  },
  {
    id: 'data-research',
    name: 'Data / Research',
    icon: 'query_stats',
    sidebarLabel: 'Research',
    sidebarIcon: 'query_stats',
    color: 'var(--sn-tab-accent-6)',
    closeable: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 860, overflow: 'collapse' },
    views: [
      view('query', 'Query', 'manage_search', createProjectSourceLayout),
      view('table', 'Table', 'table_chart', createComponentsLayout),
      view('chart', 'Chart', 'insert_chart', createComponentsLayout),
      view('sources', 'Sources', 'source', createProjectLayout),
      view('citations', 'Citations', 'format_quote', createProjectDocsLayout),
      view('report', 'Report', 'article', createProjectDocsLayout),
      view('graph', 'Evidence graph', 'hub', createGraphLayout),
    ],
  },
  {
    id: 'node-studio',
    name: 'Node Studio',
    icon: 'developer_board',
    sidebarLabel: 'Node Studio',
    sidebarIcon: 'developer_board',
    color: 'var(--sn-tab-accent-1)',
    closeable: false,
    behavior: { responsiveMode: 'scroll-inline', responsiveBreakpoint: 920, overflow: 'scroll-inline' },
    views: [
      view('editable-canvas', 'Editable canvas', 'hub', createGraphLayout),
      view('pcb-routing', 'PCB routing', 'conversion_path', createResponsiveLayout),
      view('node-variants', 'Node variants', 'category', createGraphLayout),
      view('inspector', 'Inspector', 'page_info', createGraphLayout),
      view('simulation', 'Simulation', 'play_circle', createRuntimeLayout),
      view('generated-code', 'Generated code', 'code', createProjectSourceLayout),
      view('overview-graph', 'Overview graph', 'account_tree', createGraphLayout),
    ],
  },
  {
    id: 'spatial-xr',
    name: 'Spatial / XR',
    icon: 'view_in_ar',
    sidebarLabel: 'Spatial',
    sidebarIcon: 'view_in_ar',
    color: 'var(--sn-tab-accent-4)',
    closeable: false,
    behavior: { responsiveMode: 'scroll-inline', responsiveBreakpoint: 920, overflow: 'scroll-inline' },
    views: [
      view('3d-graph', '3D graph', 'deployed_code', createSpatialLayout),
      view('spatial-panels', 'Spatial panels', 'view_in_ar', createSpatialLayout),
      view('pointer-drag', 'Pointer & drag', 'open_with', createSpatialLayout),
      view('voice-controls', 'Voice controls', 'record_voice_over', createChatLayout),
      view('theme-bridge', 'Theme bridge', 'palette', createSpatialLayout),
      view('2d-fallback', '2D fallback', 'view_quilt', createProjectSourceLayout),
    ],
  },
];

const showcaseProjectGroups = showcaseProjects.map((project) => ({
  id: project.id,
  name: project.name,
  icon: project.icon,
  sidebarLabel: project.sidebarLabel,
  sidebarIcon: project.sidebarIcon,
  color: project.color,
  closeable: project.closeable,
  behavior: project.behavior,
}));

const defaultProjectId = 'symbiote-ui';
let activeProjectId = defaultProjectId;
const activeViewByProject = new Map(showcaseProjects.map((project) => [project.id, project.views[0]?.id || 'overview']));

function getProject(id = activeProjectId) {
  return showcaseProjects.find((project) => project.id === id) || showcaseProjects[0];
}

function getProjectView(project, viewId) {
  return project.views.find((item) => item.id === viewId) || project.views[0];
}

function viewSectionId(projectId, viewId) {
  return `${projectId}:${viewId}`;
}

function parseViewSectionId(sectionId) {
  let [projectId, ...rest] = String(sectionId || '').split(':');
  return {
    projectId,
    viewId: rest.join(':'),
  };
}

function syncProjectSidebar(project, activeViewId) {
  if (!sidebar) return;
  sidebar.routerSync = false;
  sidebar.setSections?.(project.views.map((item) => ({
    id: viewSectionId(project.id, item.id),
    icon: item.icon,
    label: item.label,
    disabled: item.disabled,
  })));
  sidebar.setActiveSection?.(viewSectionId(project.id, activeViewId));
  sidebar.$.collapsed = true;
}

function syncShellHomeTab() {
  let tabs = shellMenu?.ref?.tabs;
  if (!tabs?.$) return;
  tabs.$.homeIcon = 'hub';
  tabs.$.homeLabel = 'Symbiote UI';
}

function readHashState() {
  let raw = String(location.hash || '').replace(/^#\/?/, '').split(/[?#]/)[0];
  if (!raw) return {};
  let [projectId, viewId] = raw.split('/');
  if (!viewId && showcaseProjects.some((project) => project.id === projectId)) {
    return { projectId };
  }
  let legacyProject = showcaseProjects.find((project) => project.views.some((item) => item.id === projectId));
  if (!viewId && legacyProject) {
    return { projectId: legacyProject.id, viewId: projectId };
  }
  return { projectId, viewId };
}

function writeHashState(projectId, viewId) {
  let nextHash = `#${projectId}/${viewId}`;
  if (location.hash === nextHash) return;
  history.replaceState(null, '', nextHash);
}

function applyShowcaseView(projectId = activeProjectId, viewId = activeViewByProject.get(projectId), options = {}) {
  let project = getProject(projectId);
  let viewConfig = getProjectView(project, viewId);
  activeProjectId = project.id;
  activeViewByProject.set(project.id, viewConfig.id);
  layout.setLayoutBehavior({
    minInlineSize: 240,
    minBlockSize: 180,
    ...project.behavior,
    ...viewConfig.behavior,
  });
  layout.setLayout(createShowcaseLayout(viewConfig.layoutFactory()));
  shellMenu?.setActiveGroup?.(project.id);
  syncShellHomeTab();
  syncProjectSidebar(project, viewConfig.id);
  document.documentElement.dataset.showcaseProject = project.id;
  document.documentElement.dataset.showcaseView = viewConfig.id;
  if (options.writeHash !== false) writeHashState(project.id, viewConfig.id);
}

let initialState = readHashState();
activeProjectId = getProject(initialState.projectId || defaultProjectId).id;
if (initialState.viewId) {
  activeViewByProject.set(activeProjectId, getProjectView(getProject(activeProjectId), initialState.viewId).id);
}
shellMenu?.setGroups?.(showcaseProjectGroups, activeProjectId);
syncShellHomeTab();
if (sidebar) sidebar.$.collapsed = true;
shellMenu?.addEventListener('layout-group-change', (event) => {
  let project = getProject(event.detail?.id);
  applyShowcaseView(project.id, activeViewByProject.get(project.id));
});
shellMenu?.addEventListener('layout-group-add', () => applyShowcaseView('node-studio', 'editable-canvas'));
sidebar?.addEventListener('sidebar-section-select', (event) => {
  let { projectId, viewId } = parseViewSectionId(event.detail?.id || event.detail?.sectionId);
  if (projectId !== activeProjectId) return;
  event.preventDefault?.();
  applyShowcaseView(projectId, viewId);
});
shellMenu?.addEventListener('cascade-theme-open-full', (event) => {
  layout.openPanel('theme', {
    behavior: {
      importance: 100,
      minInlineSize: 320,
      minBlockSize: 280,
      collapse: 'manual',
    },
    direction: 'horizontal',
    panelState: {
      storageKey: event.detail?.storageKey || CASCADE_THEME_STORAGE_KEY,
    },
    ratio: 0.66,
    source: 'theme-widget',
    uiInvoked: true,
  });
});
window.addEventListener('hashchange', () => {
  let state = readHashState();
  if (state.projectId) applyShowcaseView(state.projectId, state.viewId, { writeHash: false });
});
shellMenu?.addEventListener('click', (event) => {
  let commandButton = event.target.closest('[data-layout-command]');
  if (!commandButton) return;
  if (commandButton.dataset.layoutCommand === 'reset') {
    applyShowcaseView(activeProjectId, activeViewByProject.get(activeProjectId));
  }
});

applyShowcaseView(activeProjectId, activeViewByProject.get(activeProjectId));
