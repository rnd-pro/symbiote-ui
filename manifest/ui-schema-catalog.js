export let UI_SCHEMA_VERSIONS = [
  {
    version: 'component-descriptor-v1',
    path: 'schemas/component-descriptor-v1.json',
    description: 'JSON Schema for Symbiote Node component provider descriptors.',
  },
  {
    version: 'component-descriptor-v2',
    path: 'schemas/component-descriptor-v2.json',
    description: 'JSON Schema for Symbiote UI component descriptors with SSR and WebMCP metadata.',
  },
  {
    version: 'runtime-ui-v1',
    path: 'schemas/runtime-ui-v1.json',
    description: 'JSON Schema for runtime UI trees assembled from provider component descriptors.',
  },
  {
    version: 'theme-rule-block-v1',
    path: 'schemas/theme-rule-block-v1.json',
    description: 'JSON Schema for composable theme source, cascade, semantic, and component alias blocks.',
  },
  {
    version: 'agent-intent-v1',
    path: 'schemas/agent-intent-v1.json',
    description: 'JSON Schema for unified transaction-like agent intent sequences.',
  },
];

export let UI_SCHEMAS = {
  'component-descriptor-v1': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://rnd-pro.github.io/symbiote-ui/schemas/component-descriptor-v1.json',
    title: 'Symbiote Node Component Descriptor',
    type: 'object',
    additionalProperties: false,
    required: ['tagName', 'className', 'module', 'specifier', 'importKind', 'category', 'description'],
    properties: {
      tagName: { type: 'string', pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)+$' },
      className: { type: 'string', minLength: 1 },
      module: { type: 'string', minLength: 1 },
      specifier: { type: 'string', minLength: 1 },
      exportName: { type: ['string', 'null'] },
      importKind: { enum: ['named', 'side-effect'] },
      category: { type: 'string', minLength: 1 },
      description: { type: 'string', minLength: 1 },
      internal: { type: 'boolean' },
      contract: { $ref: '#/$defs/componentContract' },
    },
    $defs: {
      componentContract: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { enum: ['draft', 'stable'] },
          schemaVersion: { const: 'component-descriptor-v1' },
          dataSchema: { type: 'string' },
          capabilities: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            uniqueItems: true,
          },
          properties: {
            type: 'array',
            items: { $ref: '#/$defs/member' },
          },
          attributes: {
            type: 'array',
            items: { $ref: '#/$defs/member' },
          },
          methods: {
            type: 'array',
            items: { $ref: '#/$defs/member' },
          },
          events: {
            type: 'array',
            items: { $ref: '#/$defs/event' },
          },
          slots: {
            type: 'array',
            items: { $ref: '#/$defs/member' },
          },
          cssParts: {
            type: 'array',
            items: { $ref: '#/$defs/member' },
          },
          themeAliases: {
            type: 'array',
            items: { type: 'string', minLength: 1 },
            uniqueItems: true,
          },
          notes: { type: 'string' },
        },
      },
      member: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          type: { type: 'string' },
          description: { type: 'string' },
          required: { type: 'boolean' },
          readonly: { type: 'boolean' },
        },
      },
      event: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          detail: {
            type: 'array',
            items: { $ref: '#/$defs/member' },
          },
        },
      },
    },
  },
  'runtime-ui-v1': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://rnd-pro.github.io/symbiote-ui/schemas/runtime-ui-v1.json',
    title: 'Symbiote Node Runtime UI Tree',
    type: 'object',
    additionalProperties: false,
    required: ['version', 'root'],
    properties: {
      version: { const: 'runtime-ui-v1' },
      metadata: { type: 'object', additionalProperties: true },
      componentRegistries: {
        type: 'array',
        items: { $ref: '#/$defs/componentRegistry' },
        uniqueItems: true,
      },
      theme: { $ref: '#/$defs/themeRef' },
      root: { $ref: '#/$defs/node' },
    },
    $defs: {
      componentRegistry: {
        type: 'object',
        additionalProperties: true,
        required: ['id'],
        properties: {
          id: { type: 'string', minLength: 1 },
          provider: { type: 'string', minLength: 1 },
          schema: { type: 'string', minLength: 1 },
        },
      },
      themeRef: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          overrides: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
      node: {
        type: 'object',
        additionalProperties: false,
        required: ['component'],
        properties: {
          id: { type: 'string' },
          component: { type: 'string', minLength: 1 },
          componentRegistry: { type: 'string', minLength: 1 },
          props: { type: 'object', additionalProperties: true },
          attrs: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
          state: { $ref: '#/$defs/componentState' },
          layout: { $ref: '#/$defs/layout' },
          bindings: { type: 'object', additionalProperties: { type: 'string' } },
          events: { type: 'object', additionalProperties: { type: 'string' } },
          theme: { $ref: '#/$defs/themeRef' },
          children: {
            type: 'array',
            items: { $ref: '#/$defs/node' },
          },
        },
      },
      componentState: {
        type: 'object',
        additionalProperties: false,
        properties: {
          props: { type: 'object', additionalProperties: true },
          attrs: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
          methods: {
            type: 'object',
            additionalProperties: {
              oneOf: [
                { type: 'array' },
                { type: 'string' },
                { type: 'number' },
                { type: 'boolean' },
                { type: 'object', additionalProperties: true },
                { type: 'null' },
              ],
            },
          },
        },
      },
      layout: {
        type: 'object',
        additionalProperties: false,
        properties: {
          direction: { enum: ['horizontal', 'vertical'] },
          weight: { type: 'number', minimum: 0 },
          rect: { $ref: '#/$defs/relativeRect' },
          area: { type: 'string', minLength: 1 },
        },
      },
      relativeRect: {
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y', 'width', 'height'],
        properties: {
          x: { type: 'number', minimum: 0, maximum: 1 },
          y: { type: 'number', minimum: 0, maximum: 1 },
          width: { type: 'number', minimum: 0, maximum: 1 },
          height: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
  },
  'theme-rule-block-v1': {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://rnd-pro.github.io/symbiote-ui/schemas/theme-rule-block-v1.json',
    title: 'Symbiote Node Theme Rule Block',
    type: 'object',
    additionalProperties: false,
    required: ['name', 'kind', 'description'],
    properties: {
      name: { type: 'string', minLength: 1 },
      theme: { type: 'string', minLength: 1 },
      kind: {
        enum: [
          'source-accent',
          'color-cascade',
          'geometry-cascade',
          'typography-cascade',
          'motion-effects',
          'semantic-alias',
          'component-alias',
        ],
      },
      description: { type: 'string', minLength: 1 },
      parameters: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'type', 'description'],
          properties: {
            name: { type: 'string', minLength: 1 },
            type: { type: 'string', minLength: 1 },
            description: { type: 'string', minLength: 1 },
            default: { type: 'string' },
            unit: { type: 'string' },
          },
        },
      },
      inputs: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
      outputs: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
      formula: { type: 'string' },
      derivations: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['output', 'expression'],
          properties: {
            output: { type: 'string', minLength: 1 },
            inputs: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              uniqueItems: true,
            },
            expression: { type: 'string', minLength: 1 },
            description: { type: 'string' },
          },
        },
      },
      appliesTo: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
        uniqueItems: true,
      },
    },
  },
};

UI_SCHEMAS['agent-intent-v1'] = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://rnd-pro.github.io/symbiote-ui/schemas/agent-intent-v1.json',
  title: 'Symbiote UI Agent Intent Transaction',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'intentId', 'operations'],
  properties: {
    version: { const: 'agent-intent-v1' },
    intentId: { type: 'string', minLength: 1 },
    description: { type: 'string' },
    metadata: { type: 'object', additionalProperties: true },
    dryRun: { type: 'boolean' },
    validateOnly: { type: 'boolean' },
    operations: {
      type: 'array',
      items: { $ref: '#/$defs/operation' },
      minItems: 1,
    },
  },
  $defs: {
    operation: {
      oneOf: [
        { $ref: '#/$defs/registerComponentOperation' },
        { $ref: '#/$defs/registerDriverOperation' },
        { $ref: '#/$defs/layoutOperation' },
        { $ref: '#/$defs/uiOperation' },
        { $ref: '#/$defs/themeOperation' },
        { $ref: '#/$defs/stateOperation' },
      ],
    },
    registerComponentOperation: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'params'],
      properties: {
        type: { const: 'register-component' },
        params: { $ref: '#/$defs/registerComponentParams' },
      },
    },
    registerComponentParams: {
      type: 'object',
      additionalProperties: false,
      required: ['tagName', 'code'],
      properties: {
        tagName: { $ref: '#/$defs/customElementName' },
        code: { type: 'string', minLength: 1 },
        options: {
          type: 'object',
          additionalProperties: false,
          properties: {
            exportName: { type: 'string', minLength: 1 },
            allowOverride: { type: 'boolean' },
            blockedKeywords: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              uniqueItems: true,
            },
          },
        },
      },
    },
    registerDriverOperation: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'params'],
      properties: {
        type: { const: 'register-driver' },
        params: { $ref: '#/$defs/registerDriverParams' },
      },
    },
    registerDriverParams: {
      type: 'object',
      additionalProperties: true,
      required: ['driverType'],
      properties: {
        driverType: { type: 'string', minLength: 1 },
        module: { type: 'string', minLength: 1 },
        handler: { type: 'string', minLength: 1 },
        description: { type: 'string' },
      },
    },
    layoutOperation: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'params'],
      properties: {
        type: { const: 'layout' },
        params: { $ref: '#/$defs/layoutParams' },
      },
    },
    layoutParams: {
      type: 'object',
      additionalProperties: false,
      required: ['action'],
      properties: {
        action: { $ref: '#/$defs/layoutAction' },
        options: { type: 'object', additionalProperties: true },
      },
    },
    layoutAction: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'panelType'],
      properties: {
        type: { enum: ['open-panel', 'close-ui-panel', 'remove-ui-panel'] },
        panelType: { type: 'string', minLength: 1 },
        component: { type: 'string', minLength: 1 },
        panel: { type: 'string', minLength: 1 },
        options: { type: 'object', additionalProperties: true },
      },
    },
    uiOperation: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'params'],
      properties: {
        type: { const: 'ui' },
        params: {
          oneOf: [
            { $ref: '#/$defs/uiCreateParams' },
            { $ref: '#/$defs/uiDestroyParams' },
          ],
        },
      },
    },
    uiCreateParams: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'node'],
      properties: {
        action: { const: 'create' },
        node: { $ref: '#/$defs/runtimeUiNode' },
        parentId: { type: 'string', minLength: 1 },
        targetSelector: { type: 'string', minLength: 1 },
        target: { type: 'string', minLength: 1 },
        options: { type: 'object', additionalProperties: true },
      },
    },
    uiDestroyParams: {
      type: 'object',
      additionalProperties: false,
      required: ['action', 'id'],
      properties: {
        action: { const: 'destroy' },
        id: { type: 'string', minLength: 1 },
        options: { type: 'object', additionalProperties: true },
      },
    },
    themeOperation: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'params'],
      properties: {
        type: { const: 'theme' },
        params: { $ref: '#/$defs/themeParams' },
      },
    },
    themeParams: {
      type: 'object',
      additionalProperties: false,
      required: ['targetSelector'],
      properties: {
        targetSelector: { type: 'string', minLength: 1 },
        target: { type: 'string', minLength: 1 },
        options: { $ref: '#/$defs/themeOptions' },
        presets: { $ref: '#/$defs/themePresets' },
      },
    },
    themeOptions: {
      type: 'object',
      additionalProperties: false,
      properties: {
        mode: { enum: ['dark', 'light'] },
        hue: { type: 'number', minimum: 0, maximum: 360 },
        chroma: { type: 'number', minimum: 0, maximum: 100 },
        brightness: { type: 'number', minimum: 0, maximum: 100 },
        contrast: { type: 'number', minimum: 0, maximum: 100 },
        pattern: { type: 'number', minimum: 0, maximum: 100 },
        density: { type: 'number', minimum: 75, maximum: 140 },
        outline: { type: 'number', minimum: 0, maximum: 100 },
        type: { type: 'number', minimum: 80, maximum: 130 },
        heading: { type: 'number', minimum: 80, maximum: 140 },
        motion: { type: 'number', minimum: 0, maximum: 200 },
      },
    },
    themePresets: {
      type: 'object',
      additionalProperties: false,
      properties: {
        color: { type: 'string', minLength: 1 },
        palette: { type: 'string', minLength: 1 },
        skin: { type: 'string', minLength: 1 },
        layout: { type: 'string', minLength: 1 },
        motion: { type: 'string', minLength: 1 },
      },
    },
    stateOperation: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'params'],
      properties: {
        type: { const: 'state' },
        params: { $ref: '#/$defs/stateParams' },
      },
    },
    stateParams: {
      type: 'object',
      additionalProperties: false,
      required: ['id', 'state'],
      properties: {
        id: { type: 'string', minLength: 1 },
        state: { $ref: '#/$defs/componentState' },
      },
    },
    runtimeUiNode: {
      type: 'object',
      additionalProperties: false,
      required: ['component'],
      properties: {
        id: { type: 'string' },
        component: { $ref: '#/$defs/customElementName' },
        componentRegistry: { type: 'string', minLength: 1 },
        props: { type: 'object', additionalProperties: true },
        attrs: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
        state: { $ref: '#/$defs/componentState' },
        bindings: { type: 'object', additionalProperties: { type: 'string' } },
        events: { type: 'object', additionalProperties: { type: 'string' } },
        layout: { type: 'object', additionalProperties: true },
        theme: { type: 'object', additionalProperties: true },
        children: {
          type: 'array',
          items: { $ref: '#/$defs/runtimeUiNode' },
        },
      },
    },
    componentState: {
      type: 'object',
      additionalProperties: false,
      properties: {
        props: { type: 'object', additionalProperties: true },
        attrs: { type: 'object', additionalProperties: { type: ['string', 'number', 'boolean'] } },
        methods: {
          type: 'object',
          additionalProperties: {
            oneOf: [
              { type: 'array' },
              { type: 'string' },
              { type: 'number' },
              { type: 'boolean' },
              { type: 'object', additionalProperties: true },
              { type: 'null' },
            ],
          },
        },
      },
    },
    customElementName: {
      type: 'string',
      pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)+$',
    },
  },
};

UI_SCHEMAS['component-descriptor-v2'] = JSON.parse(JSON.stringify(UI_SCHEMAS['component-descriptor-v1']));
UI_SCHEMAS['component-descriptor-v2'].$id = 'https://rnd-pro.github.io/symbiote-ui/schemas/component-descriptor-v2.json';
UI_SCHEMAS['component-descriptor-v2'].title = 'Symbiote UI Component Descriptor';
UI_SCHEMAS['component-descriptor-v2'].properties.componentDescription = { type: 'string', minLength: 1 };
UI_SCHEMAS['component-descriptor-v2'].properties.agent = { $ref: '#/$defs/agentContext' };
UI_SCHEMAS['component-descriptor-v2'].$defs.agentContext = {
  type: 'object',
  additionalProperties: false,
  required: ['componentDescription', 'semanticRole', 'usage', 'dataOwnership', 'webmcp'],
  properties: {
    componentDescription: { type: 'string', minLength: 1 },
    semanticRole: { type: 'string', minLength: 1 },
    usage: { type: 'string', minLength: 1 },
    dataOwnership: { type: 'string', minLength: 1 },
    webmcp: { $ref: '#/$defs/webMcpAgentContext' },
  },
};
UI_SCHEMAS['component-descriptor-v2'].$defs.webMcpAgentContext = {
  type: 'object',
  additionalProperties: false,
  required: ['mode', 'toolNames', 'toolNaming', 'componentContext', 'bindVisibility', 'globalToolMode', 'references'],
  properties: {
    mode: { enum: ['explicit-descriptor', 'described-only'] },
    toolNames: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      uniqueItems: true,
    },
    toolNaming: { type: 'string', minLength: 1 },
    componentContext: { type: 'string', minLength: 1 },
    bindVisibility: { type: 'string', minLength: 1 },
    globalToolMode: { type: 'string', minLength: 1 },
    references: {
      type: 'array',
      items: { type: 'string', format: 'uri' },
      uniqueItems: true,
    },
  },
};
UI_SCHEMAS['component-descriptor-v2'].$defs.componentContract.properties.schemaVersion = { const: 'component-descriptor-v2' };
UI_SCHEMAS['component-descriptor-v2'].$defs.componentContract.properties.ssr = { $ref: '#/$defs/ssrContract' };
UI_SCHEMAS['component-descriptor-v2'].$defs.componentContract.properties.webmcp = { $ref: '#/$defs/webMcpContract' };
UI_SCHEMAS['component-descriptor-v2'].$defs.ssrContract = {
  type: 'object',
  additionalProperties: false,
  required: ['mode'],
  properties: {
    mode: { enum: ['node-safe', 'ssr-entry-safe', 'jsda-ssr-renderable', 'hydrate-only', 'client-only'] },
    importSafe: { type: 'boolean' },
    jsdaRenderable: { type: 'boolean' },
    requiresDom: { type: 'boolean' },
    browserApis: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      uniqueItems: true,
    },
    notes: { type: 'string' },
  },
};
UI_SCHEMAS['component-descriptor-v2'].$defs.webMcpContract = {
  type: 'object',
  additionalProperties: false,
  properties: {
    documentation: { type: 'string' },
    tools: {
      type: 'array',
      items: { $ref: '#/$defs/webMcpTool' },
      uniqueItems: true,
    },
  },
};
UI_SCHEMAS['component-descriptor-v2'].$defs.webMcpTool = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description', 'inputSchema'],
  properties: {
    name: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    inputSchema: { type: 'object', additionalProperties: true },
    annotations: { type: 'object', additionalProperties: true },
    exposedTo: {
      type: 'array',
      items: { enum: ['agent', 'assistant', 'host'] },
      uniqueItems: true,
    },
    visibilityDeps: {
      type: 'array',
      items: { type: 'string', minLength: 1 },
      uniqueItems: true,
    },
  },
};

export function listUiSchemaVersions() {
  return UI_SCHEMA_VERSIONS.map((schema) => schema.version);
}

export function getUiSchema(version) {
  return UI_SCHEMAS[version];
}
