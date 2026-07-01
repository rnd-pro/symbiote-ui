import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import {
  PRODUCT_CONTEXT_VERSION,
  createProductContextAgentView,
  createProductRuntimeContext,
  normalizeProductContext,
  normalizeRuntimeContext,
} from '../runtime/product-context.js';
import {
  PRODUCT_RUNTIME_CONTEXT_NAME,
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
        descriptor: 'sn-kanban-board',
        schema: 'component-descriptor-v2',
        version: '0.3.0-alpha.50',
        capabilities: ['selection', 'move-intent'],
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

function sampleRuntimeContext() {
  return {
    activeSurfaceId: 'release-window',
    activeWindowId: 'release-window',
    activeTabId: 'release-tab',
    locale: 'ru',
    selectedEntityRefs: ['publish-pages'],
    safeActions: [{
      id: 'request-release-move',
      name: 'release_flow_request_move',
      title: 'Request release move',
      reason: 'The selected task is ready and the action is non-destructive.',
      componentRefs: ['release-board'],
      entityRefs: ['publish-pages'],
      viewRefs: ['kanban-board'],
    }],
    collapsed: { 'release-sidebar': true },
    layoutPresets: [{
      id: 'operations-board',
      label: 'Operations board',
      componentRefs: ['release-board'],
      viewRefs: ['kanban-board'],
    }],
    windows: [{
      id: 'release-window',
      title: 'Release workspace',
      resourceType: 'workflow-window',
      windowRole: 'operations-board',
      layoutPresetId: 'operations-board',
      panels: [{
        id: 'release-board-panel',
        panelType: 'board-panel',
        title: 'Release board',
        component: 'sn-kanban-board',
        collapsed: false,
      }],
    }],
    tabs: [{
      id: 'release-tab',
      title: 'Release tab',
      viewId: 'kanban-board',
      component: 'sn-tab-panel',
    }],
    targets: [{
      id: 'cue:release-board:selected-card',
      kind: 'cue',
      title: 'Selected release card',
      component: 'sn-kanban-board',
      target: {
        id: 'publish-pages',
        kind: 'entity-card',
        selector: '[data-card-id="publish-pages"]',
        component: 'sn-kanban-board',
        viewId: 'kanban-board',
        entityRefs: ['publish-pages'],
        actionRefs: ['request-release-move'],
        semantics: 'selected release task card',
      },
    }],
    capabilities: { presentation: { canSwitchTabs: true } },
  };
}

function resolveSchemaRef(root, ref) {
  return ref.split('/').slice(1).reduce((node, part) => node?.[part], root);
}

function typeMatches(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
}

function assertSchemaValid(value, schema, root = schema, path = '$') {
  if (value === undefined) return;
  if (schema.$ref) {
    assertSchemaValid(value, resolveSchemaRef(root, schema.$ref), root, path);
    return;
  }
  if ('const' in schema) {
    assert.equal(value, schema.const, `${path} const`);
  }
  if (schema.enum) {
    assert.ok(schema.enum.includes(value), `${path} enum`);
  }
  if (schema.type) {
    let types = Array.isArray(schema.type) ? schema.type : [schema.type];
    assert.ok(types.some((type) => typeMatches(value, type)), `${path} type`);
  }
  if (schema.minLength !== undefined && typeof value === 'string') {
    assert.ok(value.length >= schema.minLength, `${path} minLength`);
  }
  if (schema.type === 'array') {
    if (schema.uniqueItems) {
      assert.equal(new Set(value).size, value.length, `${path} uniqueItems`);
    }
    for (let [index, item] of value.entries()) {
      assertSchemaValid(item, schema.items, root, `${path}[${index}]`);
    }
    return;
  }
  if (schema.type !== 'object' || !value || Array.isArray(value)) return;

  for (let required of schema.required || []) {
    assert.notEqual(value[required], undefined, `${path}.${required} required`);
  }
  let properties = schema.properties || {};
  for (let [key, child] of Object.entries(value)) {
    if (child === undefined) continue;
    let propertySchema = properties[key];
    if (!propertySchema) {
      assert.notEqual(schema.additionalProperties, false, `${path}.${key} additionalProperties`);
      if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        assertSchemaValid(child, schema.additionalProperties, root, `${path}.${key}`);
      }
      continue;
    }
    assertSchemaValid(child, propertySchema, root, `${path}.${key}`);
  }
}

test('normalizeProductContext keeps product semantics above neutral component refs', () => {
  let context = normalizeProductContext(sampleProductContext());

  assert.equal(context.version, PRODUCT_CONTEXT_VERSION);
  assert.equal(context.product.id, 'automation-release-demo');
  assert.equal(context.product.name, 'Automation release flow');
  assert.equal(context.views[0].route, '#automation/kanban-board');
  assert.deepEqual(context.views[0].componentRefs, ['release-board']);
  assert.equal(context.componentRefs[0].component, 'sn-kanban-board');
  assert.equal(context.componentRefs[0].descriptor, 'sn-kanban-board');
  assert.equal(context.componentRefs[0].schema, 'component-descriptor-v2');
  assert.deepEqual(context.componentRefs[0].capabilities, ['selection', 'move-intent']);
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

test('createProductRuntimeContext carries live browser UI context for narration', () => {
  let runtime = normalizeRuntimeContext(sampleRuntimeContext());
  let context = createProductRuntimeContext(sampleProductContext(), runtime);
  let composed = createProductRuntimeContext({
    ...sampleProductContext(),
    runtime: sampleRuntimeContext(),
  });

  assert.equal(context.product.id, 'automation-release-demo');
  assert.equal(composed.runtime.activeWindowId, 'release-window');
  assert.match(context.agent.summary, /Automation release flow/);
  assert.match(context.agent.summary, /Views: Kanban board/);
  assert.equal(context.runtime.activeSurfaceId, 'release-window');
  assert.equal(context.runtime.activeTabId, 'release-tab');
  assert.deepEqual(context.runtime.selectedEntityRefs, ['publish-pages']);
  assert.deepEqual(context.runtime.safeActionRefs, ['request-release-move']);
  assert.equal(context.runtime.safeActions[0].safe, true);
  assert.equal(context.runtime.collapsed['release-sidebar'], true);
  assert.equal(context.runtime.layoutPresets[0].id, 'operations-board');
  assert.equal(context.runtime.windows[0].children[0].component, 'sn-kanban-board');
  assert.equal(context.runtime.tabs[0].id, 'release-tab');
  assert.equal(context.runtime.surfaces[0].children[0].component, 'sn-kanban-board');
  assert.equal(context.runtime.cues[0].target.semantics, 'selected release task card');
  assert.equal(context.runtime.capabilities.presentation.canSwitchTabs, true);
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
  let published = [];
  let unpublished = 0;
  let result = await registerProductContextTools(context, {
    modelContext: {
      registerTool(tool) {
        registered.push(tool);
        return () => {};
      },
      registerContext(payload) {
        published.push(payload);
        return () => {
          unpublished += 1;
        };
      },
    },
  }, sampleRuntimeContext());

  assert.equal(result.nativeActive, false);
  assert.equal(result.descriptors.length, 2);
  assert.equal(registered.length, 2);
  assert.equal(result.contextView.runtime.activeWindowId, 'release-window');
  assert.equal(result.runtime.cues[0].target.entityRefs[0], 'publish-pages');
  assert.equal(result.publication.published, true);
  assert.equal(result.publication.method, 'registerContext');
  assert.equal(published[0].name, PRODUCT_RUNTIME_CONTEXT_NAME);
  assert.equal(published[0].value.runtime.safeActionRefs[0], 'request-release-move');
  result.unregister();
  assert.equal(unpublished, 1);
});

test('product context schema is published through the UI schema catalog', async () => {
  let diskSchema = JSON.parse(await readFile(new URL('../schemas/product-context-v1.json', import.meta.url), 'utf8'));
  let schema = getUiSchema('product-context-v1');
  let context = createProductRuntimeContext(sampleProductContext(), sampleRuntimeContext());

  assert.ok(listUiSchemaVersions().includes('product-context-v1'));
  assert.deepEqual(schema, diskSchema);
  assert.equal(schema.$id, 'https://rnd-pro.github.io/symbiote-ui/schemas/product-context-v1.json');
  assert.equal(schema.properties.product.$ref, '#/$defs/product');
  assert.equal(schema.properties.componentRefs.items.$ref, '#/$defs/componentRef');
  assert.equal(schema.properties.actions.items.$ref, '#/$defs/action');
  assert.equal(schema.properties.runtime.$ref, '#/$defs/runtime');
  assert.equal(schema.$defs.componentRef.properties.capabilities.$ref, '#/$defs/idArray');
  assert.equal(schema.$defs.runtime.properties.windows.items.$ref, '#/$defs/runtimeItem');
  assert.equal(schema.$defs.runtimeItem.properties.target.$ref, '#/$defs/runtimeTarget');
  assertSchemaValid(context, diskSchema);
});
