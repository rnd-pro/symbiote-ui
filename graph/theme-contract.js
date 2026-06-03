export const GRAPH_TYPE_COLOR_TOKENS = Object.freeze({
  action: '--sn-graph-type-action',
  output: '--sn-graph-type-output',
  data: '--sn-graph-type-data',
  config: '--sn-graph-type-config',
  external: '--sn-graph-type-external',
  style: '--sn-graph-type-style',
  docs: '--sn-graph-type-docs',
  asset: '--sn-graph-type-asset',
  group: '--sn-graph-type-group',
});

export const GRAPH_CLUSTER_COLOR_TOKENS = Object.freeze([
  '--sn-graph-cluster-0',
  '--sn-graph-cluster-1',
  '--sn-graph-cluster-2',
  '--sn-graph-cluster-3',
  '--sn-graph-cluster-4',
  '--sn-graph-cluster-5',
  '--sn-graph-cluster-6',
]);

export function getGraphClusterColorToken(index = 0) {
  let token = GRAPH_CLUSTER_COLOR_TOKENS[Math.abs(Number(index) || 0) % GRAPH_CLUSTER_COLOR_TOKENS.length];
  return `var(${token})`;
}

export function isGraphColorReference(value) {
  let color = String(value || '').trim();
  return /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color) || /^var\(--sn-[A-Za-z0-9_-]+\)$/.test(color);
}

export function normalizeGraphColorReference(value, fallbackIndex = 0) {
  let color = String(value || '').trim();
  return isGraphColorReference(color) ? color : getGraphClusterColorToken(fallbackIndex);
}
