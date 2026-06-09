function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  let result = [];
  let seen = new Set();
  for (const item of value) {
    const id = String(item || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function normalizeNode(rawNode) {
  if (!rawNode || typeof rawNode !== 'object') return null;
  const id = String(rawNode.id || '').trim();
  if (!id) return null;
  const children = normalizeIdList(rawNode.children);
  return {
    ...rawNode,
    id,
    label: rawNode.label == null ? id : String(rawNode.label),
    type: rawNode.type || 'data',
    parentId: rawNode.parentId == null ? null : String(rawNode.parentId),
    group: rawNode.group == null ? null : String(rawNode.group),
    isGroup: Boolean(rawNode.isGroup || children.length > 0),
    children,
  };
}

function normalizeEdge(rawEdge) {
  if (!rawEdge || typeof rawEdge !== 'object') return null;
  const rawFrom = rawEdge.from ?? rawEdge.source?.node ?? rawEdge.source?.id ?? rawEdge.source;
  const rawTo = rawEdge.to ?? rawEdge.target?.node ?? rawEdge.target?.id ?? rawEdge.target;
  const from = String(rawFrom || '').trim();
  const to = String(rawTo || '').trim();
  if (!from || !to) return null;
  return { ...rawEdge, from, to };
}

function normalizeGroupMemberList(rawGroup) {
  if (Array.isArray(rawGroup)) return normalizeIdList(rawGroup);
  if (!rawGroup || typeof rawGroup !== 'object') return [];
  return normalizeIdList(
    rawGroup.nodeIds
    || rawGroup.nodes
    || rawGroup.children
    || rawGroup.members
    || []
  );
}

function getRawGroupEntries(rawGroups) {
  if (Array.isArray(rawGroups)) {
    return rawGroups
      .map((group) => [String(group?.id || '').trim(), normalizeGroupMemberList(group)])
      .filter(([id]) => id);
  }
  if (rawGroups && typeof rawGroups === 'object') {
    return Object.entries(rawGroups)
      .map(([id, group]) => [String(id || '').trim(), normalizeGroupMemberList(group)])
      .filter(([id]) => id);
  }
  return [];
}

function addGroupMembers(groups, nodesById, groupId, memberIds, { includeGroupNode = true } = {}) {
  const id = String(groupId || '').trim();
  if (!id) return;
  let members = groups[id] || [];
  let seen = new Set(members);

  if (includeGroupNode && nodesById.has(id) && !seen.has(id)) {
    members.push(id);
    seen.add(id);
  }

  for (const rawMemberId of memberIds || []) {
    const memberId = String(rawMemberId || '').trim();
    if (!memberId || !nodesById.has(memberId) || seen.has(memberId)) continue;
    members.push(memberId);
    seen.add(memberId);
  }

  if (members.length > 0) groups[id] = members;
}

export function normalizeCanvasGraphGroups({ model = {}, nodes = [], nodesById = new Map() } = {}) {
  const groups = {};

  for (const [groupId, memberIds] of getRawGroupEntries(model.groups)) {
    addGroupMembers(groups, nodesById, groupId, memberIds);
  }

  for (const view of Object.values(model.views || {})) {
    for (const [groupId, memberIds] of getRawGroupEntries(view?.groups)) {
      addGroupMembers(groups, nodesById, groupId, memberIds);
    }
  }

  for (const node of nodes) {
    if (node.children.length > 0) {
      addGroupMembers(groups, nodesById, node.id, node.children);
    }
    if (node.parentId && nodesById.has(node.parentId)) {
      addGroupMembers(groups, nodesById, node.parentId, [node.id]);
    }
    if (node.group) {
      addGroupMembers(groups, nodesById, node.group, [node.id]);
    }
  }

  return groups;
}

export function normalizeCanvasGraphModel(model = {}) {
  const nodes = [];
  const nodesById = new Map();
  const edges = [];
  const rootNodes = [];

  for (const rawNode of model.nodes || []) {
    const node = normalizeNode(rawNode);
    if (!node || nodesById.has(node.id)) continue;
    nodes.push(node);
    nodesById.set(node.id, node);
  }

  for (const node of nodes) {
    node.children = node.children.filter((childId) => nodesById.has(childId));
    if (node.children.length > 0) node.isGroup = true;
  }

  const parentChildren = new Map();
  for (const node of nodes) {
    if (!node.parentId || !nodesById.has(node.parentId)) continue;
    if (!parentChildren.has(node.parentId)) parentChildren.set(node.parentId, []);
    parentChildren.get(node.parentId).push(node.id);
  }
  for (const [parentId, childIds] of parentChildren) {
    const parent = nodesById.get(parentId);
    let merged = normalizeIdList([...(parent.children || []), ...childIds]);
    parent.children = merged;
    parent.isGroup = true;
  }

  const rawEdges = Array.isArray(model.connections) ? model.connections : model.edges || [];
  for (const rawEdge of rawEdges) {
    const edge = normalizeEdge(rawEdge);
    if (!edge || !nodesById.has(edge.from) || !nodesById.has(edge.to)) continue;
    edges.push(edge);
  }

  const explicitRoots = Array.isArray(model.rootNodes) ? model.rootNodes.map(String) : [];
  for (const id of explicitRoots) {
    if (nodesById.has(id) && !rootNodes.includes(id)) rootNodes.push(id);
  }

  if (rootNodes.length === 0) {
    for (const node of nodes) {
      if (!node.parentId || !nodesById.has(node.parentId)) rootNodes.push(node.id);
    }
  }

  return {
    nodes,
    edges,
    rootNodes,
    groups: normalizeCanvasGraphGroups({ model, nodes, nodesById }),
  };
}

export function createCanvasGraphStore(model = {}) {
  const normalized = normalizeCanvasGraphModel(model);
  return {
    nodes: new Map(normalized.nodes.map((node) => [node.id, node])),
    edges: normalized.edges,
    rootNodes: normalized.rootNodes,
    groups: normalized.groups,
  };
}
