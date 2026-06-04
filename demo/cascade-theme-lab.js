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
]) {
  defineModule(tagName);
}

applyTheme(document.documentElement, DEFAULT_PROVIDER_THEME);

const root = document.documentElement;
const modeButtons = [...document.querySelectorAll('[data-mode]')];
const tuners = document.querySelector('.lab-tuners');
const tuneButton = document.querySelector('.lab-toggle');
const controls = {
  brightness: document.querySelector('[data-control="brightness"]'),
  contrast: document.querySelector('[data-control="contrast"]'),
  chroma: document.querySelector('[data-control="chroma"]'),
  hue: document.querySelector('[data-control="hue"]'),
};
const outputs = {
  brightness: document.querySelector('[data-output="brightness"]'),
  contrast: document.querySelector('[data-output="contrast"]'),
  chroma: document.querySelector('[data-output="chroma"]'),
  hue: document.querySelector('[data-output="hue"]'),
};

let mode = 'dark';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function setToken(name, value) {
  root.style.setProperty(name, value);
}

function updateCascadeTheme() {
  let brightness = clamp(controls.brightness.value, 0, 100);
  let contrast = clamp(controls.contrast.value, 0, 100);
  let chroma = clamp(controls.chroma.value, 0, 100);
  let hue = clamp(controls.hue.value, 0, 360);
  let dark = mode === 'dark';
  let bg = dark
    ? 10 + brightness * 0.18
    : 98 - brightness * 0.32;
  let surface = dark
    ? Math.min(34, bg + 3 + (contrast - 58) * 0.05)
    : Math.max(72, bg - 4 - contrast * 0.10);
  let text = dark
    ? Math.min(98, Math.max(72, 94 + (contrast - 58) * 0.12))
    : Math.max(8, 34 - contrast * 0.26);
  let dim = dark
    ? Math.min(78, Math.max(46, 60 + (contrast - 58) * 0.18))
    : Math.max(24, 66 - contrast * 0.22);
  let border = dark
    ? Math.min(46, Math.max(12, 17 + (contrast - 58) * 0.10))
    : Math.max(50, surface - 5 - contrast * 0.08);
  let hover = dark
    ? Math.min(58, Math.max(18, 27 + (contrast - 58) * 0.10))
    : Math.max(42, surface - 8 - contrast * 0.12);
  let accentLight = dark
    ? Math.min(72, Math.max(48, 63 + (contrast - 58) * 0.12))
    : Math.max(36, 62 - contrast * 0.10);
  let neutralChroma = `${chroma}%`;
  let accent = `hsl(${hue} ${neutralChroma} ${accentLight}%)`;
  let accentSoft = `hsl(${hue} ${neutralChroma} ${accentLight}% / 0.18)`;

  setToken('--sn-theme-hue', String(hue));
  setToken('--sn-theme-chroma', neutralChroma);
  setToken('--sn-theme-bg-lightness', `${bg.toFixed(1)}%`);
  setToken('--sn-theme-surface-lightness', `${surface.toFixed(1)}%`);
  setToken('--sn-theme-text-lightness', `${text.toFixed(1)}%`);
  setToken('--sn-lit-border', `${border.toFixed(1)}%`);
  setToken('--sn-lit-hover', `${hover.toFixed(1)}%`);
  setToken('--sn-lit-text-dim', `${dim.toFixed(1)}%`);
  setToken('--sn-lit-accent', `${accentLight.toFixed(1)}%`);
  setToken('--sn-node-selected', accent);
  setToken('--sn-cat-data', accent);
  setToken('--sn-node-active-border', `color-mix(in srgb, ${accent} 54%, transparent)`);
  setToken('--sn-node-hover', accentSoft);
  setToken('--sn-scrollbar-thumb', `hsl(0 0% ${text.toFixed(1)}% / ${dark ? 0.08 : 0.24})`);
  setToken('--sn-scrollbar-thumb-hover', dark
    ? `hsl(0 0% ${text.toFixed(1)}% / 0.25)`
    : `hsl(${hue} ${neutralChroma} ${accentLight}% / 0.55)`);
  setToken('--sn-scrollbar-track', 'transparent');

  for (const [key, output] of Object.entries(outputs)) {
    output.textContent = controls[key].value;
  }

  document.dispatchEvent(new CustomEvent('cascade-theme-change', {
    detail: { mode, brightness, contrast, chroma, hue },
  }));
}

function setMode(nextMode) {
  mode = nextMode;
  for (const button of modeButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
  }
  controls.brightness.value = mode === 'dark' ? '0' : '0';
  controls.contrast.value = mode === 'dark' ? '58' : '62';
  updateCascadeTheme();
}

tuneButton.addEventListener('click', () => {
  let open = !tuners.hasAttribute('data-open');
  tuners.toggleAttribute('data-open', open);
  tuneButton.setAttribute('aria-expanded', String(open));
});

for (const button of modeButtons) {
  button.addEventListener('click', () => setMode(button.dataset.mode));
}

for (const control of Object.values(controls)) {
  control.addEventListener('input', updateCascadeTheme);
}

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
      '--sn-text',
      '--sn-text-dim',
      '--sn-scrollbar-thumb',
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
layout.$.panelChrome = true;
layout.$.layoutTree = LayoutTree.createSplit(
  'horizontal',
  LayoutTree.createPanel('graph'),
  LayoutTree.createPanel('ui'),
  0.55
);

setMode('dark');
