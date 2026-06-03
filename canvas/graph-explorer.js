export const GRAPH_PATH_STYLES = ['pcb', 'bezier', 'orthogonal', 'straight'];

export const GRAPH_DIRECTORY_FRAME_COLORS = [
  'var(--sn-graph-cluster-0)',
  'var(--sn-graph-cluster-1)',
  'var(--sn-graph-cluster-2)',
  'var(--sn-graph-cluster-3)',
  'var(--sn-graph-cluster-4)',
  'var(--sn-graph-cluster-5)',
  'var(--sn-graph-cluster-6)',
];

export function resolveInitialGraphViewMode(urlParams) {
  const modeParam = urlParams.get('mode');
  return modeParam === 'flat' ? 'flat' : 'structured';
}

function setGraphButtonVisual(button, icon, label) {
  const iconElement = button.querySelector?.('.material-symbols-outlined');
  if (!iconElement) {
    button.textContent = label;
    return;
  }

  iconElement.textContent = icon;
  const labelNode = [...(button.childNodes || [])]
    .find((node) => node !== iconElement && node.nodeType === 3 && node.textContent.trim());

  if (labelNode) {
    labelNode.textContent = ` ${label}`;
  } else {
    button.append?.(` ${label}`);
  }
}

export function renderGraphViewModeButton(button, viewMode) {
  if (!button) return;
  const label = viewMode === 'flat' ? 'FLAT' : 'TREE';
  const icon = viewMode === 'flat' ? 'account_tree' : 'grid_view';
  setGraphButtonVisual(button, icon, label);
  if (viewMode === 'structured') {
    button.setAttribute('data-active', '');
  } else {
    button.removeAttribute('data-active');
  }
}

export function getNextGraphPathStyle(currentStyle) {
  const index = GRAPH_PATH_STYLES.indexOf(currentStyle);
  return GRAPH_PATH_STYLES[(index + 1) % GRAPH_PATH_STYLES.length] || 'pcb';
}

export function getGraphPathStyleDisplay(style) {
  switch (style) {
    case 'bezier':
      return { icon: 'timeline', text: 'BEZIER', active: false };
    case 'orthogonal':
      return { icon: 'polyline', text: 'ORTHO', active: false };
    case 'straight':
      return { icon: 'horizontal_rule', text: 'STRAIGHT', active: false };
    case 'pcb':
    default:
      return { icon: 'route', text: 'PCB', active: true };
  }
}

export function renderGraphPathStyleButton(button, style) {
  if (!button) return;
  const { icon, text, active } = getGraphPathStyleDisplay(style);
  setGraphButtonVisual(button, icon, text);
  if (active) {
    button.setAttribute('data-active', '');
  } else {
    button.removeAttribute('data-active');
  }
}

export function addGraphDirectoryFrames({
  editor,
  fileMap,
  dirFiles,
  positions,
  FrameClass,
  colors = GRAPH_DIRECTORY_FRAME_COLORS,
}) {
  if (!dirFiles || dirFiles.size < 2) return;

  const padding = 30;
  const nodeWidth = 120;
  const nodeHeight = 80;
  let colorIdx = 0;

  for (const [dir, files] of dirFiles) {
    if (files.length < 2) continue;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let hasPositions = false;

    for (const file of files) {
      const nodeId = fileMap.get(file);
      if (!nodeId) continue;
      const pos = positions[nodeId];
      if (!pos) continue;
      hasPositions = true;

      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x + nodeWidth > maxX) maxX = pos.x + nodeWidth;
      if (pos.y + nodeHeight > maxY) maxY = pos.y + nodeHeight;
    }

    if (!hasPositions) continue;

    const dirLabel = dir.replace(/\/$/, '').split('/').pop() || 'root';
    const color = colors[colorIdx % colors.length];
    colorIdx++;

    try {
      const frame = new FrameClass(dirLabel, {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding * 2,
        color,
      });
      editor.addFrame(frame);
    } catch {
      // Invalid frame geometry should not prevent rendering the graph.
    }
  }
}

export function setGraphLayerVisible(canvas, layer, visible) {
  if (!canvas) return;

  if (layer === 'zones') {
    const frames = canvas.querySelectorAll('graph-frame');
    for (const frame of frames) {
      frame.style.display = visible ? '' : 'none';
      frame.hidden = !visible;
    }
  } else if (layer === 'vias') {
    if (visible) {
      canvas.removeAttribute('data-hide-vias');
    } else {
      canvas.setAttribute('data-hide-vias', '');
    }
  }
}

export function toggleGraphLayerButtonState(button) {
  const isActive = button.hasAttribute('data-active');
  if (isActive) {
    button.removeAttribute('data-active');
    button.setAttribute('data-hidden', '');
  } else {
    button.setAttribute('data-active', '');
    button.removeAttribute('data-hidden');
  }
  return !isActive;
}

export function buildFlatPathHash(path, params = new URLSearchParams()) {
  const nextParams = new URLSearchParams(params);
  const hash = path ? `#graph/${path}` : '#graph';

  if (!path) {
    nextParams.delete('focus');
  }

  const query = nextParams.toString();
  return query ? `${hash}?${query}` : hash;
}

export function selectGraphLabelMode(buttons, selectedButton, canvas) {
  for (const button of buttons) {
    button.removeAttribute('data-active');
  }
  selectedButton.setAttribute('data-active', '');

  const mode = selectedButton.getAttribute('data-mode');
  if (mode) canvas?.setAttribute('data-label-mode', mode);

  return mode;
}

export function getFileSelectionNodeId(filePath) {
  return filePath?.endsWith('/') ? filePath.replace(/\/$/, '') : filePath;
}

export function shouldClearFocusOnSelection({ selectedNodes = [], initialViewRestored, hash = '' }) {
  return selectedNodes.length === 0 && Boolean(initialViewRestored) && hash.includes('focus=');
}

export function resolveFlatHashChange(hash) {
  if (!hash.startsWith('#graph')) return null;

  const [hashBase, queryStr] = hash.replace('#', '').split('?');
  const hashParams = hashBase.split('/');
  if (hashParams[0] === 'graph') hashParams.shift();

  const path = hashParams.join('/');
  const params = new URLSearchParams(queryStr || '');
  const focus = params.get('focus');

  return {
    path,
    focus: focus ? decodeURIComponent(focus) : null,
  };
}

export function getFlatFocusRestoreKey({ path = '', focus = null } = {}) {
  return `${path || ''}::${focus || ''}`;
}

export function shouldRestoreFlatFocus({ lastKey = null, path = '', focus = null } = {}) {
  if (!focus) return false;
  return getFlatFocusRestoreKey({ path, focus }) !== lastKey;
}

export function getGraphHashNavigationState(hash = '') {
  const hasPath = /^#graph\//.test(hash);
  const hasParams = hash.includes('?');

  return {
    hasPath,
    hasParams,
    shouldRestore: hasPath || hasParams,
  };
}

export function shouldFitForceLayoutInitialTick(hash = '') {
  return !(hash.includes('?') || hash.includes('focus='));
}

export function resolveGraphNodeClick({ nodeId, path, symbol, depth = 0, hash = '' }) {
  if (symbol) {
    return {
      hashUpdates: [['symbol', symbol.name]],
      fileEvent: symbol.file ? { path: symbol.file, source: 'canvas' } : null,
    }
  }

  if (!path) return null

  if (depth === 0) {
    return {
      hashUpdates: [['focus', path], ['in', null]],
      fileEvent: { path, source: 'canvas' },
    }
  }

  const drillBase = hash.split('?')[0]
  const drillPath = drillBase.replace('#graph/', '')
  const relativeName = path.startsWith(drillPath) ? path.slice(drillPath.length) : path

  return {
    hashUpdates: [['focus', relativeName], ['in', '1']],
    fileEvent: { path, source: 'canvas' },
  }
}

export function resolveToolbarAction({ action, nodeId, viewMode, path, symbol }) {
  if (action === 'explore') {
    return viewMode === 'flat'
      ? { type: 'fly-to-node', nodeId }
      : { type: 'explore-node', nodeId }
  }

  if (action === 'view-code') {
    const file = viewMode === 'flat' ? nodeId : (symbol ? symbol.file : path)
    return file ? { type: 'open-file', hash: `#explorer/${file}` } : null
  }

  if (action === 'enter' && viewMode === 'flat') {
    return { type: 'drill-node', nodeId }
  }

  return null
}

export function renderClusterPanel({
  panel,
  toggle,
  clusters = [],
  viewMode,
  isOpen,
  doc = typeof document !== 'undefined' ? document : null,
}) {
  if (!panel || !doc) return
  let hasFlatLegend = clusters.length > 0 && viewMode === 'flat'

  if (toggle) {
    toggle.hidden = !hasFlatLegend
    toggle.toggleAttribute('data-active', hasFlatLegend && isOpen)
    toggle.setAttribute(
      'title',
      isOpen ? 'Hide semantic color legend' : 'Show semantic color legend',
    )
  }

  if (!hasFlatLegend || !isOpen) {
    panel.hidden = true
    panel.replaceChildren()
    return
  }

  panel.hidden = false
  panel.replaceChildren(...clusters.map((cluster) => {
    let row = doc.createElement('div')
    let swatch = doc.createElement('span')
    let label = doc.createElement('span')
    let pathCount = cluster.paths.length

    row.className = 'pcb-cluster-row'
    row.title = cluster.description || `${cluster.label}: ${pathCount} paths`
    swatch.className = 'pcb-cluster-swatch'
    swatch.style.background = cluster.color
    label.className = 'pcb-cluster-label'
    label.textContent = cluster.label
    row.replaceChildren(swatch, label)
    return row
  }))
}

export function renderGraphStats(statsEl, items, doc = typeof document !== 'undefined' ? document : null) {
  if (!statsEl || !doc) return
  statsEl.replaceChildren(...items.map(([value, label]) => {
    let item = doc.createElement('span')
    let valueEl = doc.createElement('span')
    valueEl.className = 'graph-explorer-stat-val'
    valueEl.textContent = String(value)
    item.append(valueEl, ` ${label}`)
    return item
  }))
}
