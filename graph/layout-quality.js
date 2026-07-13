export const GRAPH_LAYOUT_QUALITY_VERSION = 'graph-layout-quality-v1';
export const GRAPH_LAYOUT_QUALITY_SCHEMA_ID =
  'https://rnd-pro.github.io/symbiote-ui/schemas/graph-layout-quality-v1.json';

export const GRAPH_LAYOUT_QUALITY_DEFAULT_POLICY = Object.freeze({
  maxEdgeLengthRatio: 4,
  maxNearestNeighborDistanceRatio: 4,
  maxParentDistanceRatio: 2.5,
  maxStabilityShiftRatio: 0.75,
  minRenderedNodeSize: 24,
  overlapTolerance: 0,
  maxPairChecks: 100000,
});

const SNAPSHOT_VERSION = 'graph-layout-snapshot-v1';

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeId(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function normalizeBounds(value) {
  if (!value || !isFiniteNumber(value.x) || !isFiniteNumber(value.y)
    || !isFiniteNumber(value.width) || value.width <= 0
    || !isFiniteNumber(value.height) || value.height <= 0) return null;
  return { x: value.x, y: value.y, width: value.width, height: value.height };
}

function normalizePoint(value) {
  return value && isFiniteNumber(value.x) && isFiniteNumber(value.y)
    ? { x: value.x, y: value.y }
    : null;
}

function resolvePolicy(value = {}) {
  let policy = { ...GRAPH_LAYOUT_QUALITY_DEFAULT_POLICY };
  for (let key of Object.keys(policy)) {
    if (isFiniteNumber(value?.[key]) && value[key] >= 0) policy[key] = value[key];
  }
  policy.maxPairChecks = Math.floor(policy.maxPairChecks);
  return policy;
}

function round(value) {
  return isFiniteNumber(value) ? Number(value.toFixed(6)) : null;
}

function median(values) {
  if (!values.length) return 0;
  let sorted = [...values].sort((a, b) => a - b);
  let middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function center(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function overlapArea(a, b, tolerance) {
  let width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) - tolerance;
  let height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) - tolerance;
  return width > 0 && height > 0 ? width * height : 0;
}

function orientation(a, b, c) {
  let value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.abs(value) < 1e-9 ? 0 : Math.sign(value);
}

function onSegment(a, b, point) {
  return point.x >= Math.min(a.x, b.x) - 1e-9
    && point.x <= Math.max(a.x, b.x) + 1e-9
    && point.y >= Math.min(a.y, b.y) - 1e-9
    && point.y <= Math.max(a.y, b.y) + 1e-9;
}

function segmentsIntersect(a, b, c, d) {
  let abC = orientation(a, b, c);
  let abD = orientation(a, b, d);
  let cdA = orientation(c, d, a);
  let cdB = orientation(c, d, b);
  if (abC !== abD && cdA !== cdB) return true;
  return (abC === 0 && onSegment(a, b, c))
    || (abD === 0 && onSegment(a, b, d))
    || (cdA === 0 && onSegment(c, d, a))
    || (cdB === 0 && onSegment(c, d, b));
}

function segmentIntersectsBounds(a, b, bounds) {
  if (a.x > bounds.x && a.x < bounds.x + bounds.width
    && a.y > bounds.y && a.y < bounds.y + bounds.height) return true;
  if (b.x > bounds.x && b.x < bounds.x + bounds.width
    && b.y > bounds.y && b.y < bounds.y + bounds.height) return true;
  let corners = [
    { x: bounds.x, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    { x: bounds.x, y: bounds.y + bounds.height },
  ];
  return corners.some((corner, index) => segmentsIntersect(
    a, b, corner, corners[(index + 1) % corners.length]
  ));
}

function edgeSegments(edge) {
  return edge.points.slice(1).map((point, index) => [edge.points[index], point]);
}

function polylineLength(points) {
  return points.slice(1).reduce(
    (total, point, index) => total + distance(points[index], point),
    0
  );
}

function layoutBounds(nodes) {
  if (!nodes.length) return null;
  let left = Math.min(...nodes.map((node) => node.bounds.x));
  let top = Math.min(...nodes.map((node) => node.bounds.y));
  let right = Math.max(...nodes.map((node) => node.bounds.x + node.bounds.width));
  let bottom = Math.max(...nodes.map((node) => node.bounds.y + node.bounds.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function createFinding(ruleId, severity, ids, actual, limit, message) {
  return { ruleId, severity, ...ids, actual, limit, message };
}

function sortFindings(findings) {
  return findings.sort((left, right) => [
    left.ruleId,
    ...(left.nodeIds || []),
    ...(left.edgeIds || []),
  ].join('\0').localeCompare([
    right.ruleId,
    ...(right.nodeIds || []),
    ...(right.edgeIds || []),
  ].join('\0')));
}

function coverageEntry(required, performed) {
  return { required, performed, complete: required === performed };
}

function baselineEntries(baseline) {
  if (Array.isArray(baseline?.nodes)) return baseline.nodes;
  if (!baseline?.nodes || typeof baseline.nodes !== 'object') return [];
  return Object.entries(baseline.nodes).map(([id, value]) => ({ id, ...(value || {}) }));
}

export function analyzeGraphLayout(snapshot = {}) {
  let policy = resolvePolicy(snapshot?.policy);
  let findings = [];
  let incomplete = false;
  let sourceNodes = Array.isArray(snapshot?.nodes) ? snapshot.nodes : [];
  let sourceEdges = Array.isArray(snapshot?.edges) ? snapshot.edges : [];
  let nodes = [];
  let nodeMap = new Map();
  let skippedNodeIds = [];

  if (snapshot?.version !== SNAPSHOT_VERSION) {
    incomplete = true;
    findings.push(createFinding('input.invalid-version', 'error', {}, snapshot?.version ?? null,
      SNAPSHOT_VERSION, `Expected snapshot version "${SNAPSHOT_VERSION}".`));
  }
  if (!Array.isArray(snapshot?.nodes)) {
    incomplete = true;
    findings.push(createFinding('input.invalid-nodes', 'error', {}, snapshot?.nodes ?? null,
      'array', 'Snapshot nodes must be an array.'));
  }
  if (snapshot?.edges !== undefined && !Array.isArray(snapshot.edges)) {
    incomplete = true;
    findings.push(createFinding('input.invalid-edges', 'error', {}, snapshot.edges,
      'array', 'Snapshot edges must be an array.'));
  }

  for (let [index, source] of sourceNodes.entries()) {
    let id = normalizeId(source?.id);
    let fallbackId = id || `#${index}`;
    let bounds = normalizeBounds(source?.bounds);
    if (!id || nodeMap.has(id)) {
      incomplete = true;
      skippedNodeIds.push(fallbackId);
      findings.push(createFinding(id ? 'node.duplicate-id' : 'node.invalid-id', 'error',
        { nodeIds: id ? [id] : [] }, source?.id ?? null, 'unique non-empty string',
        `Node at index ${index} does not have a unique valid ID.`));
      continue;
    }
    if (!bounds) {
      incomplete = true;
      skippedNodeIds.push(id);
      findings.push(createFinding('node.invalid-geometry', 'error', { nodeIds: [id] },
        source?.bounds ?? null, 'finite x/y and positive width/height',
        `Node "${id}" has invalid geometry.`));
      continue;
    }
    let node = { id, parentId: normalizeId(source?.parentId), bounds };
    nodes.push(node);
    nodeMap.set(id, node);
  }
  nodes.sort((left, right) => left.id.localeCompare(right.id));
  skippedNodeIds.sort((left, right) => left.localeCompare(right));

  for (let node of nodes) {
    if (!node.parentId || nodeMap.has(node.parentId)) continue;
    incomplete = true;
    findings.push(createFinding('parent.invalid', 'error',
      { nodeIds: [node.id, node.parentId].sort() }, node.parentId, 'existing node ID',
      `Node "${node.id}" references a missing parent.`));
  }

  let normalizationUnit = nodes.length
    ? median(nodes.map((node) => Math.hypot(node.bounds.width, node.bounds.height)))
    : 1;
  let normalization = {
    basis: nodes.length ? 'median-node-diagonal' : 'empty-layout-default',
    unit: round(normalizationUnit),
  };

  let edgeIds = new Set();
  let edges = [];
  let skippedEdgeIds = [];
  for (let [index, source] of sourceEdges.entries()) {
    let id = normalizeId(source?.id);
    let fallbackId = id || `#${index}`;
    let sourceId = normalizeId(source?.sourceId);
    let targetId = normalizeId(source?.targetId);
    if (!id || edgeIds.has(id)) {
      incomplete = true;
      skippedEdgeIds.push(fallbackId);
      findings.push(createFinding(id ? 'edge.duplicate-id' : 'edge.invalid-id', 'error',
        { edgeIds: id ? [id] : [] }, source?.id ?? null, 'unique non-empty string',
        `Edge at index ${index} does not have a unique valid ID.`));
      continue;
    }
    edgeIds.add(id);
    if (!sourceId || !targetId || !nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
      incomplete = true;
      skippedEdgeIds.push(id);
      findings.push(createFinding('edge.invalid-endpoint', 'error', { edgeIds: [id] },
        { sourceId, targetId }, 'existing node IDs', `Edge "${id}" has an invalid endpoint.`));
      continue;
    }
    let points;
    if (source?.points !== undefined) {
      points = Array.isArray(source.points) ? source.points.map(normalizePoint) : [];
      if (points.length < 2 || points.some((point) => !point)) {
        incomplete = true;
        skippedEdgeIds.push(id);
        findings.push(createFinding('edge.invalid-points', 'error', { edgeIds: [id] },
          source.points, 'at least two finite points', `Edge "${id}" has invalid route points.`));
        continue;
      }
    } else {
      points = [center(nodeMap.get(sourceId).bounds), center(nodeMap.get(targetId).bounds)];
    }
    let lengthRatio = polylineLength(points) / normalizationUnit;
    edges.push({ id, sourceId, targetId, points, lengthRatio });
    if (lengthRatio > policy.maxEdgeLengthRatio) {
      findings.push(createFinding('edge.too-long', 'warning', { edgeIds: [id] },
        round(lengthRatio), policy.maxEdgeLengthRatio,
        `Edge "${id}" exceeds the normalized length limit.`));
    }
  }
  edges.sort((left, right) => left.id.localeCompare(right.id));
  skippedEdgeIds.sort((left, right) => left.localeCompare(right));

  let nodePairCount = nodes.length * (nodes.length - 1) / 2;
  let edgePairCount = edges.length * (edges.length - 1) / 2;
  let edgeNodePairCount = edges.reduce((total, edge) => total + nodes.filter(
    (node) => node.id !== edge.sourceId && node.id !== edge.targetId
  ).length, 0);
  let requiredChecks = {
    nodePairs: nodePairCount,
    edgeNodePairs: edgeNodePairCount,
    edgePairs: edgePairCount,
  };
  let performedChecks = { nodePairs: 0, edgeNodePairs: 0, edgePairs: 0 };
  let remainingBudget = policy.maxPairChecks;
  let enabledChecks = {};
  for (let key of ['nodePairs', 'edgeNodePairs', 'edgePairs']) {
    enabledChecks[key] = requiredChecks[key] <= remainingBudget;
    if (enabledChecks[key]) remainingBudget -= requiredChecks[key];
    else if (requiredChecks[key]) incomplete = true;
  }
  let totalRequired = Object.values(requiredChecks).reduce((sum, value) => sum + value, 0);
  if (totalRequired > policy.maxPairChecks) {
    findings.push(createFinding('layout.analysis-budget-exceeded', 'error', {}, totalRequired,
      policy.maxPairChecks, 'The deterministic pair-check budget is too small for this layout.'));
  }

  let overlaps = 0;
  let nearest = new Map(nodes.map((node) => [node.id, Number.POSITIVE_INFINITY]));
  if (enabledChecks.nodePairs) {
    for (let left = 0; left < nodes.length; left += 1) {
      for (let right = left + 1; right < nodes.length; right += 1) {
        performedChecks.nodePairs += 1;
        let leftNode = nodes[left];
        let rightNode = nodes[right];
        let area = overlapArea(leftNode.bounds, rightNode.bounds, policy.overlapTolerance);
        if (area > 0) {
          overlaps += 1;
          findings.push(createFinding('node.overlap', 'error',
            { nodeIds: [leftNode.id, rightNode.id] }, round(area), policy.overlapTolerance,
            'Node bounds overlap.'));
        }
        let ratio = distance(center(leftNode.bounds), center(rightNode.bounds)) / normalizationUnit;
        nearest.set(leftNode.id, Math.min(nearest.get(leftNode.id), ratio));
        nearest.set(rightNode.id, Math.min(nearest.get(rightNode.id), ratio));
      }
    }
  }
  let nearestValues = [];
  for (let node of nodes) {
    let value = nearest.get(node.id);
    if (!Number.isFinite(value)) continue;
    nearestValues.push(value);
    if (value > policy.maxNearestNeighborDistanceRatio) {
      findings.push(createFinding('node.too-distant', 'warning', { nodeIds: [node.id] },
        round(value), policy.maxNearestNeighborDistanceRatio,
        `Node "${node.id}" is too far from its nearest neighbor.`));
    }
  }

  let nodeIntersections = 0;
  if (enabledChecks.edgeNodePairs) {
    for (let edge of edges) {
      for (let node of nodes) {
        if (node.id === edge.sourceId || node.id === edge.targetId) continue;
        performedChecks.edgeNodePairs += 1;
        if (edgeSegments(edge).some(([a, b]) => segmentIntersectsBounds(a, b, node.bounds))) {
          nodeIntersections += 1;
          findings.push(createFinding('edge.node-intersection', 'error',
            { nodeIds: [node.id], edgeIds: [edge.id] }, 1, 0,
            `Edge "${edge.id}" crosses unrelated node "${node.id}".`));
        }
      }
    }
  }

  let crossings = 0;
  if (enabledChecks.edgePairs) {
    for (let left = 0; left < edges.length; left += 1) {
      for (let right = left + 1; right < edges.length; right += 1) {
        performedChecks.edgePairs += 1;
        let leftEdge = edges[left];
        let rightEdge = edges[right];
        let sharesEndpoint = leftEdge.sourceId === rightEdge.sourceId
          || leftEdge.sourceId === rightEdge.targetId
          || leftEdge.targetId === rightEdge.sourceId
          || leftEdge.targetId === rightEdge.targetId;
        if (sharesEndpoint) continue;
        if (edgeSegments(leftEdge).some((leftSegment) => edgeSegments(rightEdge).some(
          (rightSegment) => segmentsIntersect(...leftSegment, ...rightSegment)
        ))) {
          crossings += 1;
          findings.push(createFinding('edge.crossing', 'warning',
            { edgeIds: [leftEdge.id, rightEdge.id] }, 1, 0, 'Unrelated edges cross.'));
        }
      }
    }
  }

  let parentRatios = [];
  for (let node of nodes) {
    if (!node.parentId || !nodeMap.has(node.parentId)) continue;
    let ratio = distance(center(node.bounds), center(nodeMap.get(node.parentId).bounds))
      / normalizationUnit;
    parentRatios.push(ratio);
    if (ratio > policy.maxParentDistanceRatio) {
      findings.push(createFinding('parent.too-distant', 'warning',
        { nodeIds: [node.id, node.parentId].sort() }, round(ratio),
        policy.maxParentDistanceRatio, `Node "${node.id}" is too far from its parent.`));
    }
  }

  let bounds = layoutBounds(nodes);
  let viewportMetrics = { provided: false, fitScale: null, minRenderedNodeSize: null };
  if (snapshot?.viewport !== undefined) {
    let viewport = snapshot.viewport;
    let padding = isFiniteNumber(viewport?.padding) && viewport.padding >= 0 ? viewport.padding : 0;
    if (!isFiniteNumber(viewport?.width) || viewport.width <= 0
      || !isFiniteNumber(viewport?.height) || viewport.height <= 0) {
      incomplete = true;
      findings.push(createFinding('viewport.invalid', 'error', {}, viewport,
        'positive width/height', 'Viewport geometry is invalid.'));
    } else if (bounds) {
      let fitScale = Math.min(
        Math.max(0, viewport.width - padding * 2) / bounds.width,
        Math.max(0, viewport.height - padding * 2) / bounds.height,
        1
      );
      let renderedSizes = nodes.map(
        (node) => Math.min(node.bounds.width, node.bounds.height) * fitScale
      );
      viewportMetrics = {
        provided: true,
        width: viewport.width,
        height: viewport.height,
        padding,
        fitScale: round(fitScale),
        minRenderedNodeSize: round(Math.min(...renderedSizes)),
      };
      for (let [index, node] of nodes.entries()) {
        if (renderedSizes[index] < policy.minRenderedNodeSize) {
          findings.push(createFinding('viewport.node-too-small', 'warning',
            { nodeIds: [node.id] }, round(renderedSizes[index]), policy.minRenderedNodeSize,
            `Node "${node.id}" would render below the readability limit.`));
        }
      }
    }
  }

  let baselineMap = new Map();
  for (let source of baselineEntries(snapshot?.baseline)) {
    let id = normalizeId(source?.id);
    let value = normalizeBounds(source?.bounds || source);
    if (id && value) baselineMap.set(id, value);
  }
  let shifts = nodes.filter((node) => baselineMap.has(node.id)).map((node) => {
    let current = center(node.bounds);
    let previous = center(baselineMap.get(node.id));
    return { id: node.id, x: current.x - previous.x, y: current.y - previous.y };
  });
  let translation = {
    x: median(shifts.map((shift) => shift.x)),
    y: median(shifts.map((shift) => shift.y)),
  };
  let shiftRatios = shifts.map((shift) => ({
    id: shift.id,
    ratio: Math.hypot(shift.x - translation.x, shift.y - translation.y) / normalizationUnit,
  }));
  for (let shift of shiftRatios) {
    if (shift.ratio > policy.maxStabilityShiftRatio) {
      findings.push(createFinding('layout.unstable', 'warning', { nodeIds: [shift.id] },
        round(shift.ratio), policy.maxStabilityShiftRatio,
        `Node "${shift.id}" moved relative to the baseline layout.`));
    }
  }

  let edgeRatios = edges.map((edge) => edge.lengthRatio);
  let objectiveFailure = findings.some((item) => [
    'node.overlap',
    'edge.node-intersection',
  ].includes(item.ruleId));
  let warning = findings.some((item) => item.severity === 'warning');
  let complete = !incomplete;
  let status = !complete ? 'incomplete' : objectiveFailure ? 'fail' : warning ? 'warn' : 'pass';

  return {
    version: GRAPH_LAYOUT_QUALITY_VERSION,
    status,
    pass: complete && !objectiveFailure,
    complete,
    normalization,
    policy,
    metrics: {
      nodes: { total: sourceNodes.length, analyzed: nodes.length, overlaps },
      edges: {
        total: sourceEdges.length,
        analyzed: edges.length,
        nodeIntersections,
        crossings,
        averageLengthRatio: round(edgeRatios.length
          ? edgeRatios.reduce((sum, value) => sum + value, 0) / edgeRatios.length
          : 0),
        maxLengthRatio: round(edgeRatios.length ? Math.max(...edgeRatios) : 0),
      },
      bounds,
      nearestNeighborDistance: {
        count: nearestValues.length,
        averageRatio: round(nearestValues.length
          ? nearestValues.reduce((sum, value) => sum + value, 0) / nearestValues.length
          : 0),
        maxRatio: round(nearestValues.length ? Math.max(...nearestValues) : 0),
      },
      viewport: viewportMetrics,
      locality: {
        count: parentRatios.length,
        averageDistanceRatio: round(parentRatios.length
          ? parentRatios.reduce((sum, value) => sum + value, 0) / parentRatios.length
          : 0),
      },
      stability: {
        count: shiftRatios.length,
        translation: { x: round(translation.x), y: round(translation.y) },
        averageShiftRatio: round(shiftRatios.length
          ? shiftRatios.reduce((sum, shift) => sum + shift.ratio, 0) / shiftRatios.length
          : 0),
        maxShiftRatio: round(shiftRatios.length
          ? Math.max(...shiftRatios.map((shift) => shift.ratio))
          : 0),
      },
    },
    coverage: {
      nodes: {
        total: sourceNodes.length,
        analyzedIds: nodes.map((node) => node.id),
        skippedIds: skippedNodeIds,
      },
      edges: {
        total: sourceEdges.length,
        analyzedIds: edges.map((edge) => edge.id),
        skippedIds: skippedEdgeIds,
      },
      checks: Object.fromEntries(Object.keys(requiredChecks).map((key) => [
        key,
        coverageEntry(requiredChecks[key], performedChecks[key]),
      ])),
    },
    findings: sortFindings(findings),
  };
}
