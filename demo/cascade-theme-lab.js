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
import '../display/StatusRibbon/StatusRibbon.js';
import '../list/ListDetailShell/ListDetailShell.js';
import '../surface/Card/Card.js';
import '../tree/TreePanel/TreePanel.js';
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
  customElements.whenDefined('sn-status-ribbon'),
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
      this.ref.sidebar.setCollapsed(false);
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
    this.ref.code.setContent([
      'const theme = createCascadeTheme({',
      '  mode: "dark",',
      '  hue: 218,',
      '  density: 100,',
      '});',
      '',
      'applyCascadeTheme(root, theme.state);',
    ].join('\n'), 'js');
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
  <section class="chat-lab-panel">
    <chat-sidebar-shell class="chat-lab-sidebar" auto-collapse="false" ${{ ref: 'sidebar' }}></chat-sidebar-shell>
    <div class="chat-lab-content">
      <chat-transcript ${{ ref: 'transcript' }}>
        <cell-bg slot="background" ${{ ref: 'bg' }}></cell-bg>
      </chat-transcript>
      <div class="chat-code-sample">
        <code-block ${{ ref: 'code' }}></code-block>
      </div>
      <div class="chat-voice-state-strip" aria-label="Voice state examples">
        <button class="voice-state-chip idle" type="button" data-voice-state="idle">
          <span class="material-symbols-outlined">mic</span><span>idle</span>
        </button>
        <button class="voice-state-chip listening" type="button" data-voice-state="listening">
          <span class="material-symbols-outlined">hearing</span><span>listening</span>
        </button>
        <button class="voice-state-chip transcribing" type="button" data-voice-state="transcribing">
          <span class="material-symbols-outlined">hourglass_top</span><span>transcribing</span>
        </button>
        <button class="voice-state-chip speaking" type="button" data-voice-state="speaking">
          <span class="material-symbols-outlined">record_voice_over</span><span>speaking</span>
        </button>
        <button class="voice-state-chip disabled" type="button" data-voice-state="disabled" disabled>
          <span class="material-symbols-outlined">mic_off</span><span>disabled</span>
        </button>
      </div>
      <div class="chat-bg-control-strip" aria-label="Animated background controls">
        <button class="chat-bg-control" type="button" data-bg-action="trigger">
          <span class="material-symbols-outlined">play_circle</span><span>trigger</span>
        </button>
        <button class="chat-bg-control" type="button" data-bg-action="start">
          <span class="material-symbols-outlined">motion_play</span><span>run</span>
        </button>
        <button class="chat-bg-control" type="button" data-bg-action="stop">
          <span class="material-symbols-outlined">motion_photos_paused</span><span>slow stop</span>
        </button>
      </div>
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

  cascade-chat-panel .chat-code-sample {
    flex: 0 0 min(22%, 96px);
    min-height: 72px;
    margin: 0 var(--sn-lab-content-padding, 12px);
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: var(--sn-node-radius);
    overflow: hidden;
    background: var(--sn-bg);
  }

  cascade-chat-panel .chat-voice-state-strip {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sn-composer-footer-gap, 4px);
    padding: var(--sn-composer-footer-padding, 6px 16px 0);
    margin: 0 var(--sn-lab-content-padding, 12px);
    border-top: 1px solid color-mix(in oklab, var(--sn-node-border) 64%, transparent);
    background: color-mix(in oklab, var(--sn-chat-bg) 88%, transparent);
  }

  cascade-chat-panel .voice-state-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--sn-composer-footer-gap, 4px);
    min-height: var(--sn-composer-footer-btn-min-height, 24px);
    max-width: 100%;
    padding: var(--sn-composer-footer-btn-padding, 3px 8px);
    border: 0;
    border-radius: 999px;
    background: var(--sn-node-bg);
    color: var(--sn-text-dim);
    font: inherit;
    font-size: var(--sn-composer-footer-size, 11px);
    cursor: pointer;
  }

  cascade-chat-panel .voice-state-chip .material-symbols-outlined {
    font-size: var(--sn-composer-footer-icon-size);
  }

  cascade-chat-panel .voice-state-chip.listening,
  cascade-chat-panel .voice-state-chip.speaking {
    color: var(--sn-node-selected);
    background: var(--sn-node-hover);
  }

  cascade-chat-panel .voice-state-chip.transcribing .material-symbols-outlined {
    animation: lab-spin var(--sn-animation-duration-normal) linear infinite;
    animation-play-state: var(--sn-animation-play-state);
  }

  cascade-chat-panel .voice-state-chip:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  cascade-chat-panel .chat-bg-control-strip {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sn-composer-footer-gap, 4px);
    padding: var(--sn-composer-footer-padding, 6px 16px 0);
    margin: 0 var(--sn-lab-content-padding, 12px);
    background: color-mix(in oklab, var(--sn-chat-bg) 84%, transparent);
  }

  cascade-chat-panel .chat-bg-control {
    display: inline-flex;
    align-items: center;
    gap: var(--sn-composer-footer-gap, 4px);
    min-height: var(--sn-composer-footer-btn-min-height, 24px);
    max-width: 100%;
    padding: var(--sn-composer-footer-btn-padding, 3px 8px);
    border: var(--sn-node-border-width, 1px) solid var(--sn-node-border);
    border-radius: 999px;
    background: var(--sn-control-bg, var(--sn-node-bg));
    color: var(--sn-control-fg, var(--sn-text));
    font: inherit;
    font-size: var(--sn-composer-footer-size, 11px);
    cursor: pointer;
  }

  cascade-chat-panel .chat-bg-control:hover {
    border-color: var(--sn-node-selected);
    background: var(--sn-node-hover);
  }

  cascade-chat-panel .chat-bg-control .material-symbols-outlined {
    font-size: var(--sn-composer-footer-icon-size);
  }

  @keyframes lab-spin {
    100% { transform: rotate(360deg); }
  }
`;

CascadeChatPanel.reg('cascade-chat-panel');

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
layout.registerPanelType('chat', {
  title: 'Chat',
  icon: 'forum',
  component: 'cascade-chat-panel',
  behavior: {
    importance: 25,
    minInlineSize: 300,
    minBlockSize: 220,
    collapse: 'auto',
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
layout.$.panelChrome = true;
const createPanel = (panelType, behavior) => LayoutTree.createPanel(panelType, {}, behavior);
const createOverviewLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('graph', { importance: 95 }),
  createPanel('chat', { importance: 25 }),
  0.52
);

const createGraphLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('graph', { importance: 100, minInlineSize: 520, minBlockSize: 360 }),
  createPanel('ui', { importance: 45 }),
  0.62
);

const createChatLayout = () => LayoutTree.createSplit(
  'horizontal',
  createPanel('chat', { importance: 100, minInlineSize: 420, minBlockSize: 360 }),
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

const layoutGroups = [
  {
    id: 'overview',
    name: 'Overview',
    icon: 'view_quilt',
    sidebarLabel: 'Agent Chat',
    sidebarIcon: 'smart_toy',
    color: 'var(--sn-tab-accent-0)',
    closeable: false,
    tabsVisible: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 760, overflow: 'collapse' },
  },
  {
    id: 'graph',
    name: 'Graph',
    icon: 'hub',
    sidebarLabel: 'Explorer',
    sidebarIcon: 'folder_open',
    color: 'var(--sn-tab-accent-1)',
    closeable: false,
    behavior: { responsiveMode: 'scroll-inline', responsiveBreakpoint: 860, overflow: 'collapse' },
  },
  {
    id: 'chat',
    name: 'Chat',
    icon: 'forum',
    sidebarLabel: 'Follow',
    sidebarIcon: 'smart_toy',
    color: 'var(--sn-tab-accent-2)',
    closeable: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 780, overflow: 'collapse' },
  },
  {
    id: 'theme',
    name: 'Theme',
    icon: 'palette',
    sidebarLabel: 'Skills',
    sidebarIcon: 'school',
    color: 'var(--sn-tab-accent-4)',
    closeable: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 820, overflow: 'collapse' },
  },
  {
    id: 'responsive',
    name: 'Responsive',
    icon: 'view_agenda',
    sidebarLabel: 'Graph',
    sidebarIcon: 'developer_board',
    color: 'var(--sn-tab-accent-3)',
    closeable: false,
    behavior: { responsiveMode: 'stack', responsiveBreakpoint: 980, overflow: 'scroll-inline' },
  },
  { id: 'analysis', name: 'Analysis', icon: 'analytics', tabsVisible: false, disabled: true },
  { id: 'monitor', name: 'Live Monitor', icon: 'monitor_heart', tabsVisible: false, disabled: true },
  { id: 'runtime', name: 'Runtime', icon: 'memory', tabsVisible: false, disabled: true },
  { id: 'spatial', name: 'Spatial', icon: 'view_in_ar', tabsVisible: false, disabled: true },
  { id: 'settings', name: 'Settings', icon: 'settings', tabsVisible: false, disabled: true },
];

const layoutFactories = new Map([
  ['overview', createOverviewLayout],
  ['graph', createGraphLayout],
  ['chat', createChatLayout],
  ['theme', createThemeLayout],
  ['responsive', createResponsiveLayout],
]);

let activeLayoutGroupId = 'overview';

function canApplyLayoutGroup(group) {
  return Boolean(group && !group.disabled && layoutFactories.has(group.id));
}

function getActiveLayoutGroup() {
  let group = layoutGroups.find((item) => item.id === activeLayoutGroupId);
  return canApplyLayoutGroup(group) ? group : layoutGroups[0];
}

function getHashLayoutGroupId() {
  let id = String(location.hash || '').replace(/^#\/?/, '').split(/[/?#]/)[0];
  return layoutGroups.some((group) => group.id === id) ? id : '';
}

function applyLayoutGroup(id = activeLayoutGroupId) {
  let nextGroup = layoutGroups.find((group) => group.id === id);
  activeLayoutGroupId = canApplyLayoutGroup(nextGroup) ? nextGroup.id : 'overview';
  let group = getActiveLayoutGroup();
  layout.setLayoutBehavior({
    minInlineSize: 240,
    minBlockSize: 180,
    ...group.behavior,
  });
  layout.setLayout(layoutFactories.get(group.id)());
  shellMenu?.setActiveGroup?.(activeLayoutGroupId);
}

activeLayoutGroupId = getHashLayoutGroupId() || activeLayoutGroupId;
shellMenu?.setGroups?.(layoutGroups, activeLayoutGroupId);
if (sidebar) sidebar.$.collapsed = true;
shellMenu?.addEventListener('layout-group-change', (event) => applyLayoutGroup(event.detail?.id));
shellMenu?.addEventListener('layout-group-add', () => applyLayoutGroup('responsive'));
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
  let id = getHashLayoutGroupId();
  if (id) applyLayoutGroup(id);
});
shellMenu?.addEventListener('click', (event) => {
  let commandButton = event.target.closest('[data-layout-command]');
  if (!commandButton) return;
  if (commandButton.dataset.layoutCommand === 'reset') {
    applyLayoutGroup(activeLayoutGroupId);
  }
});

applyLayoutGroup(activeLayoutGroupId);
