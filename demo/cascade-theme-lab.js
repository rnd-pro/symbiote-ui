import Symbiote, { html } from '@symbiotejs/symbiote';
import {
  Connection,
  DEFAULT_PROVIDER_THEME,
  Input,
  LayoutTree,
  Node,
  NodeEditor,
  Output,
  Socket,
  applyTheme,
  configureMaterialSymbols,
  defineModule,
} from '../ui/index.js';

configureMaterialSymbols();

for (const tagName of [
  'panel-layout',
  'node-canvas',
  'sn-button',
  'sn-banner',
  'sn-badge',
  'sn-card',
  'sn-tree-panel',
  'cell-bg',
  'chat-transcript',
  'chat-composer',
  'code-block',
  'cascade-theme-editor',
]) {
  defineModule(tagName);
}

applyTheme(document.documentElement, DEFAULT_PROVIDER_THEME);

class CascadeGraphPanel extends Symbiote {
  renderCallback() {
    if (this._ready) return;
    this._ready = true;
    const canvas = this.ref.canvas;
    const socket = new Socket('flow', {
      color: 'var(--sn-node-selected)',
    });
    const editor = new NodeEditor();

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
    editor.addNode(controlsNode);

    editor.addConnection(new Connection(source, 'tokens', canvasNode, 'in'));
    editor.addConnection(new Connection(canvasNode, 'next', layoutNode, 'in'));
    editor.addConnection(new Connection(layoutNode, 'next', controlsNode, 'in'));

    canvas.setEditor(editor);
    canvas.setReadonly(true);
    canvas.setReadonlyNodeDragging(true);
    canvas.setPanels(false);
    canvas.setViewportLocked(false);
    canvas.setPathStyle('pcb');
    canvas.$.zoom = 1;
    canvas.$.panX = 0;
    canvas.$.panY = 0;

    const place = () => {
      requestAnimationFrame(() => {
        canvas.setFlowLayout({
          nodeIds: [source.id, canvasNode.id, layoutNode.id, controlsNode.id],
          direction: 'vertical',
          gap: 76,
          padding: { top: 42, right: 28, bottom: 42, left: 28 },
          align: 'center',
          scroll: true,
        });
      });
    };

    place();
    this._resizeObserver = new ResizeObserver(place);
    this._resizeObserver.observe(canvas);
  }

  disconnectedCallback() {
    this._resizeObserver?.disconnect();
    super.disconnectedCallback?.();
  }
}

CascadeGraphPanel.template = html`
  <node-canvas class="lab-canvas" ${{ ref: 'canvas' }}></node-canvas>
`;

CascadeGraphPanel.rootStyles = `
  cascade-graph-panel {
    display: block;
    width: 100%;
    height: 100%;
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
      '--sn-syntax-keyword',
      '--sn-cell-dot',
      '--sn-node-icon-size',
      '--sn-shape-icon-size',
      '--sn-port-label-size',
      '--sn-layout-header-icon-size',
      '--sn-action-zone-size',
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
`;

CascadeUiPanel.reg('cascade-ui-panel');

class CascadeChatPanel extends Symbiote {
  renderCallback() {
    if (this._ready) return;
    this._ready = true;

    this.ref.bg.$.active = true;
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
    this.ref.composer.setFooterHtml(`
      <button class="composer-footer-btn composer-priority-1" type="button">
        <span class="material-symbols-outlined">palette</span><span class="composer-footer-label">theme</span>
      </button>
      <button class="composer-footer-btn composer-priority-2" type="button">
        <span class="material-symbols-outlined">data_object</span><span class="composer-footer-label">web mcp</span>
      </button>
    `);
  }
}

CascadeChatPanel.template = html`
  <section class="chat-lab-panel">
    <cell-bg ${{ ref: 'bg' }}></cell-bg>
    <div class="chat-lab-content">
      <chat-transcript ${{ ref: 'transcript' }}></chat-transcript>
      <div class="chat-code-sample">
        <code-block ${{ ref: 'code' }}></code-block>
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

  cascade-chat-panel .chat-lab-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 0;
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
`;

CascadeChatPanel.reg('cascade-chat-panel');

const layout = document.querySelector('.lab-layout');
layout.registerPanelType('graph', {
  title: 'Graph',
  icon: 'hub',
  component: 'cascade-graph-panel',
});
layout.registerPanelType('ui', {
  title: 'UI',
  icon: 'widgets',
  component: 'cascade-ui-panel',
});
layout.registerPanelType('chat', {
  title: 'Chat',
  icon: 'forum',
  component: 'cascade-chat-panel',
});
layout.registerPanelType('theme', {
  title: 'Theme',
  icon: 'palette',
  component: 'cascade-theme-editor',
  attributes: {
    'storage-key': 'symbiote-ui:cascade-theme-lab',
  },
});
layout.$.panelChrome = true;
layout.$.layoutTree = LayoutTree.createSplit(
  'horizontal',
  LayoutTree.createPanel('theme'),
  LayoutTree.createSplit(
    'horizontal',
    LayoutTree.createPanel('graph'),
    LayoutTree.createSplit(
      'vertical',
      LayoutTree.createPanel('ui'),
      LayoutTree.createPanel('chat'),
      0.48
    ),
    0.52
  ),
  0.28
);
