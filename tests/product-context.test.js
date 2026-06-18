import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  PRODUCT_CONTEXT_VERSION,
  createProductContextAgentView,
  normalizeProductContext,
} from '../runtime/product-context.js';
import {
  createProductActionToolDescriptor,
  createProductContextToolDescriptors,
  registerProductContextTools,
} from '../webmcp.js';
import {
  getUiSchema,
  listUiSchemaVersions,
} from '../manifest/index.js';

function sampleProductContext() {
  return {
    product: {
      id: 'automation-release-demo',
      name: 'Automation release flow',
      category: 'automation',
      description: 'Public demo product for release workflow planning and Pages publish gates.',
    },
    views: [
      {
        id: 'kanban-board',
        label: 'Kanban board',
        route: '#automation/kanban-board',
        description: 'Workflow board with host-owned release tasks.',
        componentRefs: ['release-board'],
        entityRefs: ['publish-pages'],
        actionRefs: ['select-release-card', 'request-release-move'],
      },
    ],
    componentRefs: [
      {
        id: 'release-board',
        component: 'sn-kanban-board',
        viewId: 'kanban-board',
        role: 'workflow board',
        selector: 'cascade-board-panel sn-kanban-board',
        description: 'Reusable board component rendering release-flow tasks.',
        entityRefs: ['publish-pages'],
        actionRefs: ['select-release-card', 'request-release-move'],
      },
    ],
    entities: [
      {
        id: 'publish-pages',
        type: 'release-task',
        label: 'Publish GitHub Pages',
        status: 'ready',
        componentRefs: ['release-board'],
      },
    ],
    actions: [
      {
        id: 'select-release-card',
        title: 'Select release card',
        description: 'Selects a visible release task and updates the inspector.',
        componentRefs: ['release-board'],
        entityRefs: ['publish-pages'],
        inputSchema: {
          type: 'object',
          required: ['cardId'],
          properties: {
            cardId: { type: 'string' },
          },
        },
      },
      {
        id: 'request-release-move',
        name: 'release_flow_request_move',
        title: 'Request release move',
        description: 'Emits a host-owned move intent; the board does not mutate release policy.',
        componentRefs: ['release-board'],
        entityRefs: ['publish-pages'],
        destructive: false,
        inputSchema: {
          type: 'object',
          required: ['cardId', 'toColumnId'],
          properties: {
            cardId: { type: 'string' },
            toColumnId: { type: 'string' },
          },
        },
      },
    ],
    eventLog: [
      {
        id: 'board-ready',
        type: 'render',
        title: 'Board ready',
        status: 'done',
        componentRefId: 'release-board',
        entityId: 'publish-pages',
      },
    ],
  };
}

test('normalizeProductContext keeps product semantics above neutral component refs', () => {
  let context = normalizeProductContext(sampleProductContext());

  assert.equal(context.version, PRODUCT_CONTEXT_VERSION);
  assert.equal(context.product.id, 'automation-release-demo');
  assert.equal(context.product.name, 'Automation release flow');
  assert.equal(context.views[0].route, '#automation/kanban-board');
  assert.deepEqual(context.views[0].componentRefs, ['release-board']);
  assert.equal(context.componentRefs[0].component, 'sn-kanban-board');
  assert.equal(context.componentRefs[0].role, 'workflow board');
  assert.equal(context.entities[0].type, 'release-task');
  assert.equal(context.actions[0].name, 'automation_release_demo_select_release_card');
  assert.equal(context.actions[1].name, 'release_flow_request_move');
  assert.equal(context.actions[1].destructive, false);
  assert.equal(context.eventLog[0].componentRefId, 'release-board');
  assert.equal(context.webmcp.mode, 'product-actions');
  assert.deepEqual(context.webmcp.toolNames, [
    'automation_release_demo_select_release_card',
    'release_flow_request_move',
  ]);
});

test('createProductContextAgentView exposes what an agent needs to inspect a product', () => {
  let view = createProductContextAgentView(sampleProductContext());

  assert.equal(view.product.id, 'automation-release-demo');
  assert.match(view.summary, /Automation release flow/);
  assert.equal(view.views[0].id, 'kanban-board');
  assert.equal(view.views[0].componentRefs[0], 'release-board');
  assert.equal(view.componentRefs[0].component, 'sn-kanban-board');
  assert.equal(view.actions[0].inputSchema.required[0], 'cardId');
  assert.equal(view.eventLog[0].title, 'Board ready');
  assert.match(view.webmcp.actionPolicy, /host-owned product intents/);
});

test('product context actions become WebMCP descriptors without a browser-only dependency', async () => {
  let context = normalizeProductContext(sampleProductContext());
  let descriptor = createProductActionToolDescriptor(context, context.actions[0]);
  let rawDescriptor = createProductActionToolDescriptor(sampleProductContext(), sampleProductContext().actions[0]);
  let descriptors = createProductContextToolDescriptors(context);

  assert.equal(descriptor.name, 'automation_release_demo_select_release_card');
  assert.equal(rawDescriptor.name, 'automation_release_demo_select_release_card');
  assert.match(descriptor.description, /Automation release flow/);
  assert.match(descriptor.description, /Selects a visible release task/);
  assert.equal(descriptor.annotations.productId, 'automation-release-demo');
  assert.equal(descriptor.annotations.actionId, 'select-release-card');
  assert.deepEqual(descriptor.annotations.componentRefs, ['release-board']);
  assert.deepEqual(descriptors.map((tool) => tool.name), [
    'automation_release_demo_select_release_card',
    'release_flow_request_move',
  ]);

  let registered = [];
  let result = await registerProductContextTools(context, {
    modelContext: {
      registerTool(tool) {
        registered.push(tool);
        return () => {};
      },
    },
  });

  assert.equal(result.nativeActive, false);
  assert.equal(result.descriptors.length, 2);
  assert.equal(registered.length, 2);
});

test('product context schema is published through the UI schema catalog', () => {
  let schema = getUiSchema('product-context-v1');

  assert.ok(listUiSchemaVersions().includes('product-context-v1'));
  assert.equal(schema.$id, 'https://rnd-pro.github.io/symbiote-ui/schemas/product-context-v1.json');
  assert.equal(schema.properties.product.$ref, '#/$defs/product');
  assert.equal(schema.properties.componentRefs.items.$ref, '#/$defs/componentRef');
  assert.equal(schema.properties.actions.items.$ref, '#/$defs/action');
});
