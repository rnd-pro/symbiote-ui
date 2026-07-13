export const GRAPH_LAYOUT_QUALITY_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://rnd-pro.github.io/symbiote-ui/schemas/graph-layout-quality-v1.json',
  title: 'Symbiote Graph Layout Quality Report',
  description: 'Deterministic quality report for a settled 2D graph layout.',
  type: 'object',
  additionalProperties: false,
  required: [
    'version', 'status', 'pass', 'complete', 'normalization', 'policy',
    'metrics', 'coverage', 'findings',
  ],
  properties: {
    version: { const: 'graph-layout-quality-v1' },
    status: { enum: ['pass', 'warn', 'fail', 'incomplete'] },
    pass: { type: 'boolean' },
    complete: { type: 'boolean' },
    normalization: { type: 'object', additionalProperties: true },
    policy: { $ref: '#/$defs/policy' },
    metrics: { type: 'object', additionalProperties: true },
    coverage: { type: 'object', additionalProperties: true },
    findings: { type: 'array', items: { $ref: '#/$defs/finding' } },
  },
  $defs: {
    point: {
      type: 'object', additionalProperties: false, required: ['x', 'y'],
      properties: { x: { type: 'number' }, y: { type: 'number' } },
    },
    bounds: {
      type: 'object', additionalProperties: false, required: ['x', 'y', 'width', 'height'],
      properties: {
        x: { type: 'number' }, y: { type: 'number' },
        width: { type: 'number', exclusiveMinimum: 0 },
        height: { type: 'number', exclusiveMinimum: 0 },
      },
    },
    node: {
      type: 'object', additionalProperties: true, required: ['id', 'bounds'],
      properties: {
        id: { type: 'string', minLength: 1 },
        parentId: { type: 'string', minLength: 1 },
        bounds: { $ref: '#/$defs/bounds' },
      },
    },
    edge: {
      type: 'object', additionalProperties: true, required: ['id', 'sourceId', 'targetId'],
      properties: {
        id: { type: 'string', minLength: 1 },
        sourceId: { type: 'string', minLength: 1 },
        targetId: { type: 'string', minLength: 1 },
        points: { type: 'array', minItems: 2, items: { $ref: '#/$defs/point' } },
      },
    },
    policy: {
      type: 'object', additionalProperties: false,
      properties: {
        maxEdgeLengthRatio: { type: 'number', minimum: 0 },
        maxNearestNeighborDistanceRatio: { type: 'number', minimum: 0 },
        maxParentDistanceRatio: { type: 'number', minimum: 0 },
        maxStabilityShiftRatio: { type: 'number', minimum: 0 },
        minRenderedNodeSize: { type: 'number', minimum: 0 },
        overlapTolerance: { type: 'number', minimum: 0 },
        maxPairChecks: { type: 'integer', minimum: 0 },
      },
    },
    input: {
      type: 'object', additionalProperties: true, required: ['version', 'nodes'],
      properties: {
        version: { const: 'graph-layout-snapshot-v1' },
        nodes: { type: 'array', items: { $ref: '#/$defs/node' } },
        edges: { type: 'array', items: { $ref: '#/$defs/edge' } },
        viewport: {
          type: 'object', additionalProperties: false, required: ['width', 'height'],
          properties: {
            width: { type: 'number', exclusiveMinimum: 0 },
            height: { type: 'number', exclusiveMinimum: 0 },
            padding: { type: 'number', minimum: 0 },
          },
        },
        baseline: {
          type: 'object', additionalProperties: true,
          properties: { nodes: { type: ['array', 'object'] } },
        },
        policy: { $ref: '#/$defs/policy' },
      },
    },
    finding: {
      type: 'object', additionalProperties: true,
      required: ['ruleId', 'severity', 'actual', 'limit', 'message'],
      properties: {
        ruleId: { type: 'string', minLength: 1 },
        severity: { enum: ['error', 'warning'] },
        nodeIds: { type: 'array', items: { type: 'string' } },
        edgeIds: { type: 'array', items: { type: 'string' } },
        actual: {}, limit: {}, message: { type: 'string', minLength: 1 },
      },
    },
  },
};

export const GRAPH_ANALYSIS_CATALOG = [
  {
    id: 'graph.layout.audit',
    title: 'Audit graph layout quality',
    description: 'Analyze settled graph geometry without mutating graph or viewport state.',
    function: 'analyzeGraphLayout',
    specifier: 'symbiote-ui/graph',
    runtime: 'node-safe',
    schemas: {
      input: 'schemas/graph-layout-quality-v1.json#/$defs/input',
      output: 'schemas/graph-layout-quality-v1.json',
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
    cli: {
      command: 'layout-audit',
      usage: 'symbiote-ui layout-audit <graph-layout-snapshot.json>',
    },
  },
];

export function listGraphAnalysisOperations() {
  return structuredClone(GRAPH_ANALYSIS_CATALOG);
}

export function getGraphAnalysisOperation(id) {
  let operation = GRAPH_ANALYSIS_CATALOG.find((item) => item.id === id);
  if (!operation) {
    let available = GRAPH_ANALYSIS_CATALOG.map((item) => item.id).join(', ');
    throw new Error(`Unknown graph analysis operation "${id}". Available operations: ${available}`);
  }
  return structuredClone(operation);
}
