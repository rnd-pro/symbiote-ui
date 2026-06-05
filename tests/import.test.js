import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('root and metadata entrypoints import in Node', async () => {
  let root = await import('../index.js');
  let layout = await import('../layout/index.js');
  let runtime = await import('../runtime/index.js');
  let manifest = await import('../manifest/index.js');
  let webmcp = await import('../webmcp.js');

  assert.equal(typeof root.NodeEditor, 'function');
  assert.equal(typeof root.createCascadeTheme, 'function');
  assert.equal(typeof root.getReadableTextForHsl, 'function');
  assert.equal(typeof root.createRuntimeUiInstance, 'function');
  assert.equal(typeof runtime.createRuntimeUiController, 'function');
  assert.equal(runtime.RUNTIME_UI_CONTRACT.version, 'runtime-ui-v1');
  assert.equal(typeof manifest.listComponents, 'function');
  assert.equal(typeof manifest.listAgentComponentDescriptions, 'function');
  assert.equal(typeof manifest.listThemeRuntimeDescriptors, 'function');
  assert.equal(typeof webmcp.createToolDescriptor, 'function');
  assert.equal(typeof webmcp.createComponentToolDescriptor, 'function');
  assert.equal(typeof layout.resolveLayoutMinSize, 'function');
  assert.equal(typeof layout.resolveResponsiveLayoutState, 'function');
});

test('discover exposes the standalone package contract', async () => {
  let { cmdDiscover } = await import('../discover.js');
  let data = await cmdDiscover({});
  let entrypoints = new Map(data.exports.entrypoints.map((entry) => [entry.specifier, entry]));

  assert.equal(data.package.name, 'symbiote-ui');
  assert.equal(entrypoints.get('symbiote-ui')?.kind, 'node-safe');
  assert.equal(entrypoints.get('symbiote-ui/runtime')?.kind, 'ssr-entry-safe');
  assert.equal(entrypoints.get('symbiote-ui/webmcp')?.kind, 'ssr-entry-safe');
  let component = data.manifest.components.find((item) => item.tagName === 'cascade-theme-editor');
  let agentCatalogItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'cascade-theme-editor');
  let shellMenu = data.manifest.components.find((item) => item.tagName === 'layout-shell-menu');
  let shellMenuAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'layout-shell-menu');
  let layout = data.manifest.components.find((item) => item.tagName === 'panel-layout');
  let sidebar = data.manifest.components.find((item) => item.tagName === 'layout-sidebar');
  let layoutAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'panel-layout');
  let sidebarAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'layout-sidebar');
  let chatSidebarAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'chat-sidebar-shell');
  let nodeCanvasAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'node-canvas');
  let canvasGraphAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'canvas-graph');
  let graphExplorerAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'graph-explorer-shell');
  let cellBgAgentItem = data.manifest.componentAgentCatalog.find((item) => item.tagName === 'cell-bg');
  assert.ok(component.componentDescription.includes('cascade theme editor'));
  assert.equal(component.agent.webmcp.mode, 'explicit-descriptor');
  assert.ok(component.agent.webmcp.references.includes('https://rnd-pro.com/pulse/symbiote-webmcp-support/'));
  assert.ok(agentCatalogItem.componentDescription.includes('WebMCP tools: cascade_theme_editor_apply'));
  assert.equal(agentCatalogItem.webmcp.toolNames[0], 'cascade_theme_editor_apply');
  assert.ok(shellMenu.componentDescription.includes('project tabs'));
  assert.ok(shellMenu.componentDescription.includes('layout-group-controller'));
  assert.equal(shellMenu.agent.webmcp.mode, 'explicit-descriptor');
  assert.ok(shellMenu.contract.capabilities.includes('sidebar-slot'));
  assert.ok(shellMenu.contract.methods.some((method) => method.name === 'setGroups'));
  assert.ok(shellMenu.contract.slots.some((slot) => slot.name === 'sidebar'));
  assert.equal(shellMenuAgentItem.webmcp.toolNames[0], 'layout_shell_menu_select');
  assert.equal(shellMenuAgentItem.webmcp.toolNames[1], 'layout_shell_menu_set_groups');
  assert.equal(layout.contract.schemaVersion, 'component-descriptor-v2');
  assert.equal(sidebar.contract.schemaVersion, 'component-descriptor-v2');
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_set_behavior'));
  assert.ok(layout.componentDescription.includes('min-size-fit'));
  assert.ok(layout.contract.capabilities.includes('mobile-stack'));
  assert.ok(layout.contract.attributes.some((attribute) => attribute.name === 'scroll-inline-active'));
  assert.ok(layout.contract.attributes.some((attribute) => attribute.name === 'scroll-block-active'));
  assert.ok(layout.contract.properties.find((property) => (
    property.name === 'layoutBehavior' &&
    property.description.includes('not persisted')
  )));
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_register_panel_type'));
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_set_panel_menu_actions'));
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_open_panel'));
  assert.ok(layoutAgentItem.webmcp.toolNames.includes('panel_layout_close_ui_panel'));
  assert.ok(sidebarAgentItem.webmcp.toolNames.includes('layout_sidebar_set_sections'));
  assert.ok(sidebarAgentItem.webmcp.toolNames.includes('layout_sidebar_set_active_section'));
  assert.ok(chatSidebarAgentItem.webmcp.toolNames.includes('chat_sidebar_set_chats'));
  assert.ok(chatSidebarAgentItem.webmcp.toolNames.includes('chat_sidebar_select'));
  assert.ok(chatSidebarAgentItem.webmcp.toolNames.includes('chat_sidebar_set_collapsed'));
  assert.ok(nodeCanvasAgentItem.webmcp.toolNames.includes('node_canvas_set_editor_model'));
  assert.ok(nodeCanvasAgentItem.webmcp.toolNames.includes('node_canvas_set_path_style'));
  assert.ok(nodeCanvasAgentItem.webmcp.toolNames.includes('node_canvas_set_flow_layout'));
  assert.ok(nodeCanvasAgentItem.componentDescription.includes('node-editor-canvas'));
  assert.ok(canvasGraphAgentItem.webmcp.toolNames.includes('canvas_graph_set_model'));
  assert.ok(canvasGraphAgentItem.webmcp.toolNames.includes('canvas_graph_focus_node'));
  assert.ok(canvasGraphAgentItem.webmcp.toolNames.includes('canvas_graph_set_path'));
  assert.ok(canvasGraphAgentItem.componentDescription.includes('overview-read-renderer'));
  assert.equal(
    data.manifest.components
      .find((item) => item.tagName === 'canvas-graph')
      .contract.attributes
      .some((attribute) => attribute.name === 'auto-trigger'),
    false
  );
  assert.ok(graphExplorerAgentItem.webmcp.toolNames.includes('graph_explorer_shell_set_view'));
  assert.ok(graphExplorerAgentItem.webmcp.toolNames.includes('graph_explorer_shell_set_stats'));
  assert.ok(graphExplorerAgentItem.webmcp.toolNames.includes('graph_explorer_shell_request_action'));
  assert.ok(cellBgAgentItem.componentDescription.includes('WebMCP tools: cell_bg_trigger'));
  assert.ok(cellBgAgentItem.webmcp.toolNames.includes('cell_bg_trigger'));
  assert.ok(cellBgAgentItem.webmcp.toolNames.includes('cell_bg_start'));
  assert.ok(cellBgAgentItem.webmcp.toolNames.includes('cell_bg_stop'));
  let cascadeDescriptor = data.manifest.themeRuntimeDescriptors.find((descriptor) => descriptor.name === 'cascade-theme');
  assert.ok(cascadeDescriptor);
  assert.equal(cascadeDescriptor.webmcp?.name, 'symbiote-ui.createCascadeTheme');
  assert.ok(cascadeDescriptor.exports.includes('getReadableTextForHsl'));
  let cascadeControlNames = data.manifest.themeControls['cascade-theme'].map((control) => control.name);
  for (const name of ['mode', 'brightness', 'contrast', 'chroma', 'hue', 'outline', 'type', 'heading', 'density']) {
    assert.ok(cascadeControlNames.includes(name), `expected cascade theme control ${name}`);
  }
});

test('webmcp helpers append component context to explicit tool descriptors', async () => {
  let { createComponentToolDescriptor } = await import('../webmcp.js');
  let descriptor = createComponentToolDescriptor(
    {
      tagName: 'sample-panel',
      className: 'SamplePanel',
      componentDescription: 'Sample panel explains the visible data.',
      agent: { semanticRole: 'sample surface' },
    },
    {
      name: 'sample_action',
      description: 'Run the visible action.',
      inputSchema: { type: 'object', additionalProperties: false },
      annotations: { readOnlyHint: false },
    }
  );

  assert.equal(descriptor.name, 'sample_action');
  assert.match(descriptor.description, /Sample panel explains/);
  assert.match(descriptor.description, /Run the visible action/);
  assert.equal(descriptor.annotations.componentTag, 'sample-panel');
  assert.equal(descriptor.annotations.componentRole, 'sample surface');
  assert.equal(descriptor.annotations.readOnlyHint, false);
});

test('component registry follows the agent-facing WebMCP documentation standard', async () => {
  let { listComponents } = await import('../manifest/index.js');

  for (const component of listComponents()) {
    assert.match(component.componentDescription, /Use this/);
    assert.ok(component.agent?.semanticRole, `${component.tagName} semantic role`);
    assert.ok(component.agent?.usage, `${component.tagName} usage`);
    assert.ok(component.agent?.dataOwnership, `${component.tagName} data ownership`);
    let toolCount = component.contract?.webmcp?.tools?.length || 0;
    assert.equal(
      component.agent?.webmcp?.mode,
      toolCount ? 'explicit-descriptor' : 'described-only'
    );
    assert.ok(
      component.agent?.webmcp?.globalToolMode.includes('Do not enable global Symbiote.mcpToolMode'),
      `${component.tagName} explicit-first WebMCP guidance`
    );
    assert.ok(component.visibility, `${component.tagName} visibility`);
    assert.equal(component.contract?.schemaVersion, 'component-descriptor-v2');
    assert.ok(component.contract?.ssr?.mode, `${component.tagName} SSR mode`);
    assert.ok(Array.isArray(component.contract?.properties), `${component.tagName} properties contract`);
    assert.ok(Array.isArray(component.contract?.events), `${component.tagName} events contract`);
    assert.ok(Array.isArray(component.contract?.slots), `${component.tagName} slots contract`);
  }
});

test('source component registry does not keep legacy descriptor-v1 contracts', async () => {
  let source = await readFile(new URL('../manifest/component-registry.js', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /component-descriptor-v1/);
});
