export function getGraphCacheKey(isStructured) {
  return isStructured ? 'structured' : 'flat';
}

export function getOrBuildGraph({
  cache,
  skeleton,
  isStructured,
  buildStructuredGraphFn,
  buildFileGraphFn,
}) {
  const cacheKey = getGraphCacheKey(isStructured);
  const cached = cache[cacheKey];

  if (cached?.skeleton === skeleton) {
    return { cacheKey, cached: true, graph: cached };
  }

  const graph = isStructured
    ? buildStructuredGraphFn(skeleton)
    : buildFileGraphFn(skeleton);

  if (!graph.symbolMap) graph.symbolMap = new Map();
  cache[cacheKey] = { skeleton, ...graph };

  return { cacheKey, cached: false, graph: cache[cacheKey] };
}

export function getDrillableFiles(symbolMap = new Map()) {
  return new Set([...symbolMap.values()].map((symbol) => symbol.file));
}

export function findForceNodeGroup(groups = {}, nodeId) {
  return Object.entries(groups).find(([, ids]) => ids.includes(nodeId))?.[0] ?? null;
}

export function getForceLayoutOptions(nodeCount, { continuous = false } = {}) {
  const options = {
    chargeStrength: nodeCount > 500 ? -300 : -150,
    linkDistance: nodeCount > 500 ? 100 : 150,
  };

  if (continuous) {
    options.nodeWidth = 260;
    options.nodeHeight = 40;
    options.mode = 'continuous';
    options.brownian = 0;
  }

  return options;
}

export function createForceLayoutPayload({
  nodes,
  connections,
  positions = {},
  groups = {},
  nodeSizes = {},
  continuous = false,
}) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      x: positions[node.id]?.x ?? 0,
      y: positions[node.id]?.y ?? 0,
      group: findForceNodeGroup(groups, node.id),
      w: nodeSizes[node.id]?.w || node.params?.calculatedWidth || 260,
      h: nodeSizes[node.id]?.h || node.params?.calculatedHeight || 60,
    })),
    edges: connections.map((connection) => ({
      from: connection.from,
      to: connection.to,
    })),
    groups: groups || {},
    options: getForceLayoutOptions(nodes.length, { continuous }),
  };
}

export function computeInitialGraphPositions({
  editor,
  isStructured = false,
  dirFiles = null,
  dirNodeMap = new Map(),
  groups = {},
  computeTreeLayoutFn,
  random = Math.random,
}) {
  if (isStructured && dirFiles) {
    if (typeof computeTreeLayoutFn !== 'function') {
      throw new TypeError('computeTreeLayoutFn is required for structured graph layout');
    }
    const dirPaths = {};
    const rootNodeIds = new Set(editor.getNodes().map((node) => node.id));
    for (const [dir, nodeId] of dirNodeMap.entries()) {
      if (rootNodeIds.has(nodeId)) {
        dirPaths[nodeId] = dir;
      }
    }

    return computeTreeLayoutFn(editor, {
      dirPaths,
      nodeWidth: 250,
      nodeHeight: 100,
      gapX: 40,
      gapY: 60,
      startX: 60,
      startY: 60,
    });
  }

  const allNodes = [...editor.getNodes()];
  const totalNodes = allNodes.length;
  const groupEntries = Object.entries(groups);
  const positions = {};

  if (groupEntries.length > 1) {
    const globalRadius = Math.sqrt(totalNodes) * 80;
    let groupIdx = 0;
    for (const [, memberIds] of groupEntries) {
      const angle = (2 * Math.PI * groupIdx) / groupEntries.length;
      const radius = globalRadius * (0.3 + 0.7 * (groupIdx / groupEntries.length));
      const cx = Math.cos(angle) * radius;
      const cy = Math.sin(angle) * radius;
      const memberRadius = Math.sqrt(memberIds.length) * 60;
      for (let memberIdx = 0; memberIdx < memberIds.length; memberIdx++) {
        const memberAngle = (2 * Math.PI * memberIdx) / memberIds.length;
        positions[memberIds[memberIdx]] = {
          x: cx + Math.cos(memberAngle) * memberRadius + (random() - 0.5) * 20,
          y: cy + Math.sin(memberAngle) * memberRadius + (random() - 0.5) * 20,
        };
      }
      groupIdx++;
    }
  }

  for (const node of allNodes) {
    if (!positions[node.id]) {
      const angle = random() * 2 * Math.PI;
      const radius = Math.sqrt(totalNodes) * 50 + random() * 200;
      positions[node.id] = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    }
  }

  return positions;
}
