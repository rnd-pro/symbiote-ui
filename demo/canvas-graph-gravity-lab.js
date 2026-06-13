import '../canvas/CanvasGraph/CanvasGraph.js';

const graph = document.getElementById('graph');
const controls = document.getElementById('controls');
const diagnostics = document.getElementById('diagnostics');

const forceControls = [
  ['chargeStrength', -360, -40, -170, 1],
  ['linkDistance', 60, 260, 150, 1],
  ['linkStrength', 0.02, 0.8, 0.25, 0.01],
  ['groupDistance', 70, 320, 150, 1],
  ['groupStrength', 0.01, 0.25, 0.08, 0.01],
  ['wellStrength', 0.1, 1.8, 0.85, 0.01],
  ['centerPull', 0, 0.5, 0.18, 0.01],
  ['wellRepulsion', 0, 22, 8.5, 0.1],
  ['crossLinkScale', 0.02, 0.7, 0.22, 0.01],
];

const viewControls = [
  ['fitPadding', 0, 160, 72, 1],
  ['focusMaxZoom', 0.4, 2.5, 1.35, 0.01],
  ['appearanceMs', 120, 1800, 700, 10],
  ['staggerMs', 0, 80, 12, 1],
];

let state = Object.fromEntries([...forceControls, ...viewControls].map(([key, , , value]) => [key, value]));
state.scenario = 'process';
let currentModel = null;

function makeProcessModel() {
  const groups = [
    { id: 'orchestrator', label: 'Orchestrator', type: 'data', color: '#4c8bf5' },
    { id: 'delegation', label: 'Delegation', type: 'action', color: '#34a853' },
    { id: 'tools', label: 'Tools', type: 'config', color: '#ff6d01' },
    { id: 'files', label: 'Files', type: 'docs', color: '#fbbc04' },
  ];
  const nodes = [];
  const edges = [];
  const groupModels = [];
  for (const group of groups) {
    const ids = [];
    const count = group.id === 'orchestrator' ? 5 : 9;
    for (let index = 0; index < count; index += 1) {
      const id = `${group.id}-${index}`;
      ids.push(id);
      nodes.push({
        id,
        label: `${group.label} ${index}`,
        type: group.type,
        color: group.color,
        group: group.id,
      });
      if (index > 0) edges.push({ from: `${group.id}-0`, to: id });
      if (index > 1) edges.push({ from: `${group.id}-${index - 1}`, to: id });
    }
    groupModels.push({ id: group.id, label: group.label, nodeIds: ids });
  }
  edges.push(
    { from: 'orchestrator-0', to: 'delegation-0' },
    { from: 'orchestrator-1', to: 'tools-0' },
    { from: 'delegation-2', to: 'files-0' },
    { from: 'tools-3', to: 'files-3' },
    { from: 'files-4', to: 'orchestrator-2' }
  );
  return { nodes, edges, groups: groupModels, rootNodes: nodes.map((node) => node.id) };
}

function makeDenseModel() {
  const model = makeProcessModel();
  for (let index = 0; index < model.nodes.length - 4; index += 3) {
    model.edges.push({ from: model.nodes[index].id, to: model.nodes[index + 4].id });
  }
  return model;
}

function makeSingleModel() {
  return {
    nodes: [{ id: 'orchestrator', label: 'Orchestrator', type: 'data', color: '#4c8bf5' }],
    edges: [],
    groups: [],
    rootNodes: ['orchestrator'],
  };
}

function makeStarModel() {
  const nodes = [{ id: 'hub', label: 'Hub', type: 'data', color: '#4c8bf5' }];
  const edges = [];
  for (let index = 0; index < 18; index += 1) {
    const id = `leaf-${index}`;
    nodes.push({ id, label: `Leaf ${index}`, type: index % 2 ? 'docs' : 'action' });
    edges.push({ from: 'hub', to: id });
  }
  return {
    nodes,
    edges,
    groups: [{ id: 'star', label: 'Star', nodeIds: nodes.map((node) => node.id) }],
    rootNodes: nodes.map((node) => node.id),
  };
}

function buildModel() {
  if (state.scenario === 'single') return makeSingleModel();
  if (state.scenario === 'dense') return makeDenseModel();
  if (state.scenario === 'star') return makeStarModel();
  return makeProcessModel();
}

function readForceOptions() {
  return Object.fromEntries(forceControls.map(([key]) => [key, Number(state[key])]));
}

function applyModel() {
  currentModel = buildModel();
  graph.setForceLayoutOptions(readForceOptions());
  graph.setLayoutSnapshot(null);
  graph.setGraphModel(currentModel);
  graph.setForceLayoutOptions(readForceOptions(), { restart: true });
  replayAppearance();
  setTimeout(() => fitView(false), 120);
  updateDiagnostics();
}

function fitView(animate = true) {
  graph.fitView({
    padding: Number(state.fitPadding),
    maxZoom: Number(state.focusMaxZoom),
    animate,
  });
  updateDiagnostics();
}

function focusRoot() {
  const id = currentModel?.nodes?.[0]?.id;
  if (!id) return;
  graph.fitNodes([id], {
    padding: Number(state.fitPadding),
    maxZoom: Number(state.focusMaxZoom),
    select: id,
    animate: true,
  });
  graph.pulseNode(id, 1200, { waves: 2 });
  updateDiagnostics();
}

function replayAppearance() {
  graph.animateNodeAppearance(null, {
    durationMs: Number(state.appearanceMs),
    staggerMs: Number(state.staggerMs),
  });
}

function updateForce() {
  graph.setForceLayoutOptions(readForceOptions());
  updateDiagnostics();
}

function makeSlider([key, min, max, , step]) {
  const field = document.createElement('label');
  field.className = 'field';
  field.innerHTML = `
    <span class="field-row"><strong>${key}</strong><span data-value>${state[key]}</span></span>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}">
  `;
  const input = field.querySelector('input');
  const value = field.querySelector('[data-value]');
  input.addEventListener('input', () => {
    state[key] = Number(input.value);
    value.textContent = input.value;
    if (forceControls.some(([controlKey]) => controlKey === key)) updateForce();
  });
  input.addEventListener('change', () => {
    if (forceControls.some(([controlKey]) => controlKey === key)) graph.setForceLayoutOptions(readForceOptions(), { restart: true });
  });
  return field;
}

function renderControls() {
  const scenario = document.createElement('label');
  scenario.className = 'field';
  scenario.innerHTML = `
    <span class="field-row"><strong>scenario</strong></span>
    <select>
      <option value="process">process groups</option>
      <option value="dense">dense cross-links</option>
      <option value="single">single node</option>
      <option value="star">star hub</option>
    </select>
  `;
  const select = scenario.querySelector('select');
  select.value = state.scenario;
  select.addEventListener('change', () => {
    state.scenario = select.value;
    applyModel();
  });

  const actionGrid = document.createElement('div');
  actionGrid.className = 'button-grid';
  const actions = [
    ['Restart layout', applyModel],
    ['Fit view', () => fitView(true)],
    ['Focus root', focusRoot],
    ['Replay appearance', replayAppearance],
  ];
  for (const [label, action] of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', action);
    actionGrid.append(button);
  }

  controls.replaceChildren(
    scenario,
    actionGrid,
    ...forceControls.map(makeSlider),
    ...viewControls.map(makeSlider)
  );
}

function updateDiagnostics() {
  const positions = graph.nodePositions ? [...graph.nodePositions.values()] : [];
  const xs = positions.map((pos) => pos.x);
  const ys = positions.map((pos) => pos.y);
  const data = {
    scenario: state.scenario,
    nodes: currentModel?.nodes?.length || 0,
    edges: currentModel?.edges?.length || 0,
    positions: positions.length,
    zoom: Number(graph.zoom?.toFixed?.(3) || graph.zoom || 0),
    targetZoom: Number(graph._targetZoom?.toFixed?.(3) || graph._targetZoom || 0),
    pan: {
      x: Number(graph.panX?.toFixed?.(1) || graph.panX || 0),
      y: Number(graph.panY?.toFixed?.(1) || graph.panY || 0),
    },
    extents: positions.length
      ? {
          w: Number((Math.max(...xs) - Math.min(...xs)).toFixed(1)),
          h: Number((Math.max(...ys) - Math.min(...ys)).toFixed(1)),
        }
      : null,
    activeNode: graph.activeNode?.id || null,
  };
  diagnostics.textContent = JSON.stringify(data, null, 2);
}

graph.addEventListener('layout-tick', updateDiagnostics);
graph.addEventListener('layout-done', updateDiagnostics);
graph.addEventListener('node-deselected', updateDiagnostics);
window.addEventListener('resize', () => fitView(false));

renderControls();
applyModel();
