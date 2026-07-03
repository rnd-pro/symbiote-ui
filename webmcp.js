import {
  createRuntimeSafeActionFromProductAction,
  createProductContextAgentView,
  createProductRuntimeContext,
  normalizeRuntimeEnrichment,
  normalizeRuntimeHook,
  normalizeRuntimeSafeAction,
  normalizeProductContext,
  normalizeRuntimeContext,
} from './runtime/product-context.js';

export const PRODUCT_RUNTIME_CONTEXT_NAME = 'symbiote.productRuntimeContext';

export {
  createRuntimeSafeActionFromProductAction,
  createProductRuntimeContext,
  normalizeRuntimeEnrichment,
  normalizeRuntimeHook,
  normalizeRuntimeSafeAction,
  normalizeRuntimeContext,
};

export function getModelContext(target = globalThis.document) {
  return target?.modelContext
    || (typeof target?.registerTool === 'function' ? target : null)
    || globalThis.navigator?.modelContext
    || null;
}

export function createToolDescriptor(options) {
  return { ...options };
}

export function getComponentDescription(component) {
  return component?.componentDescription
    || component?.agent?.componentDescription
    || component?.description
    || '';
}

export function createComponentToolDescriptor(component, tool) {
  let componentDescription = getComponentDescription(component);
  return createToolDescriptor({
    ...tool,
    description: [
      componentDescription,
      tool?.description,
    ].filter(Boolean).join('\n\n'),
    annotations: {
      componentTag: component?.tagName,
      componentClass: component?.className,
      semanticRole: component?.agent?.semanticRole,
      ...(tool?.annotations || {}),
    },
  });
}

function registrationUnregister(registration) {
  if (typeof registration === 'function') return registration;
  return () => registration?.dispose?.() || registration?.unregister?.();
}

export async function createNativeToolDescriptor(options) {
  let { ToolDescriptor } = await import('@symbiotejs/symbiote/webmcp');
  return new ToolDescriptor(options);
}

export async function registerWebMcpTool(options, target = globalThis.document) {
  let context = getModelContext(target);
  if (!context || typeof context.registerTool !== 'function') {
    return { nativeActive: false, descriptor: createToolDescriptor(options), unregister: () => {} };
  }

  let nativeActive = true;
  let descriptor;
  if (typeof globalThis.HTMLElement !== 'function') {
    nativeActive = false;
    descriptor = createToolDescriptor(options);
  } else try {
    descriptor = await createNativeToolDescriptor(options);
  } catch {
    nativeActive = false;
    descriptor = createToolDescriptor(options);
  }
  let registration = context.registerTool(descriptor);
  let unregister = registrationUnregister(registration);

  return { nativeActive, descriptor, unregister };
}

export function triggerWebMcpCommand(element, command, args = {}) {
  if (!element || !command) return;
  element.dispatchEvent(new CustomEvent('webmcp-command', {
    bubbles: true,
    composed: true,
    detail: { command, args },
  }));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const DEFAULT_OBSERVER_LIMIT = 50;

function normalizeObserverLimit(limit) {
  return Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_OBSERVER_LIMIT;
}

export function createWebMcpObserver({ limit = DEFAULT_OBSERVER_LIMIT } = {}) {
  const cap = normalizeObserverLimit(limit);
  const buffer = [];
  const subscribers = new Set();
  let seq = 0;

  function record(event) {
    const base = event && typeof event === 'object' ? event : { value: event };
    const entry = { ...base, seq: ++seq };
    buffer.push(entry);
    if (buffer.length > cap) buffer.shift();
    for (const cb of subscribers) {
      try {
        cb(entry);
      } catch {
        // A faulty subscriber must not break recording or notification.
      }
    }
    return entry;
  }

  function recent(n = 10, filter) {
    let entries = buffer;
    if (typeof filter === 'string') {
      entries = entries.filter((entry) => entry.type === filter);
    } else if (typeof filter === 'function') {
      entries = entries.filter((entry) => filter(entry));
    }
    return entries.slice(-n).reverse();
  }

  function subscribe(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  function clear() {
    buffer.length = 0;
  }

  return { record, recent, subscribe, clear };
}

function looksLikeRuntimeContext(value) {
  if (!isObject(value) || value.modelContext || typeof value.registerTool === 'function') return false;
  return [
    'activeViewId',
    'activeSurfaceId',
    'activeWindowId',
    'activeTabId',
    'selectedEntityRefs',
    'safeActionRefs',
    'safeActions',
    'enrichment',
    'hooks',
    'collapsed',
    'layoutPresets',
    'windows',
    'tabs',
    'surfaces',
    'cues',
    'targets',
  ].some((key) => key in value);
}

function resolveProductContextToolOptions(targetOrOptions, runtimeInput) {
  if (isObject(targetOrOptions)
    && !targetOrOptions.modelContext
    && typeof targetOrOptions.registerTool !== 'function'
    && typeof targetOrOptions.createElement !== 'function'
    && ('target' in targetOrOptions || 'runtime' in targetOrOptions || 'publishContext' in targetOrOptions)) {
    return {
      target: targetOrOptions.target || globalThis.document,
      runtime: targetOrOptions.runtime,
      safeActions: targetOrOptions.safeActions,
      enrichContext: targetOrOptions.enrichContext,
      enrichRuntime: targetOrOptions.enrichRuntime,
      enrichActionDescriptor: targetOrOptions.enrichActionDescriptor,
      publishContext: targetOrOptions.publishContext !== false,
    };
  }
  if (looksLikeRuntimeContext(targetOrOptions) && runtimeInput === undefined) {
    return {
      target: globalThis.document,
      runtime: targetOrOptions,
      publishContext: true,
    };
  }
  return {
    target: targetOrOptions || globalThis.document,
    runtime: runtimeInput,
    publishContext: true,
  };
}

function createProductRuntimeContextPayload(contextView) {
  return {
    name: PRODUCT_RUNTIME_CONTEXT_NAME,
    version: contextView.version,
    schema: contextView.schema,
    productId: contextView.product?.id || '',
    description: contextView.webmcp?.productDescription || contextView.agent?.summary || '',
    value: contextView,
  };
}

function callContextPublisher(modelContext, methodName, payload) {
  let publish = modelContext?.[methodName];
  if (typeof publish !== 'function') return null;
  let registration = publish.length >= 2
    ? publish.call(modelContext, payload.name, payload.value, payload)
    : publish.call(modelContext, payload);
  return {
    published: true,
    nativeActive: true,
    method: methodName,
    payload,
    unregister: registrationUnregister(registration),
  };
}

export function publishProductRuntimeContext(contextView, target = globalThis.document) {
  let modelContext = getModelContext(target);
  let payload = createProductRuntimeContextPayload(contextView);
  if (!modelContext) {
    return { published: false, nativeActive: false, method: '', payload, unregister: () => {} };
  }

  for (let methodName of ['registerContext', 'publishContext', 'setContext', 'addContext']) {
    try {
      let publication = callContextPublisher(modelContext, methodName, payload);
      if (publication) return publication;
    } catch {
      // Try the next host surface, then fall back to a plain property.
    }
  }

  modelContext[PRODUCT_RUNTIME_CONTEXT_NAME] = payload.value;
  modelContext.productRuntimeContext = payload.value;
  return {
    published: true,
    nativeActive: false,
    method: 'property',
    payload,
    unregister() {
      if (modelContext[PRODUCT_RUNTIME_CONTEXT_NAME] === payload.value) {
        delete modelContext[PRODUCT_RUNTIME_CONTEXT_NAME];
      }
      if (modelContext.productRuntimeContext === payload.value) {
        delete modelContext.productRuntimeContext;
      }
    },
  };
}

function resolveProductAction(context, action = {}) {
  let key = action.id || action.actionId || action.name || action.toolName;
  let normalizedKey = String(key || '').trim();
  let existing = normalizedKey
    ? context.actions.find((item) => (
      item.id === normalizedKey
      || item.name === normalizedKey
      || item.title === normalizedKey
    ))
    : null;
  if (existing) return existing;
  return normalizeProductContext({
    product: context.product,
    actions: [action],
  }).actions[0] || {};
}

export function createProductActionToolDescriptor(productContext, action) {
  let context = normalizeProductContext(productContext);
  let actionRecord = resolveProductAction(context, action);
  let productDescription = context.webmcp.productDescription;
  return createToolDescriptor({
    name: actionRecord.name,
    description: [
      productDescription,
      actionRecord.description,
    ].filter(Boolean).join('\n\n'),
    inputSchema: actionRecord.inputSchema || {
      type: 'object',
      additionalProperties: true,
    },
    annotations: {
      productContextVersion: context.version,
      productId: context.product.id,
      productName: context.product.name,
      actionId: actionRecord.id,
      actionType: actionRecord.type,
      componentRefs: actionRecord.componentRefs || [],
      entityRefs: actionRecord.entityRefs || [],
      viewRefs: actionRecord.viewRefs || [],
      permission: actionRecord.permission || '',
      destructive: Boolean(actionRecord.destructive),
      allowed: actionRecord.allowed !== false,
      actionPolicy: context.webmcp.actionPolicy,
      intent: actionRecord.intent || {},
    },
  });
}

export function createProductContextToolDescriptors(productContext) {
  let context = normalizeProductContext(productContext);
  return context.actions
    .filter((action) => action.allowed !== false)
    .map((action) => createProductActionToolDescriptor(context, action));
}

export const WEBMCP_PRESENTATION_INTENTS = Object.freeze([
  'emphasize',
  'detail',
  'group',
  'risk',
  'question',
  'success',
  'affinity',
  'flourish',
]);

export const WEBMCP_PRESENTATION_MARKERS = Object.freeze([
  'circle',
  'underline',
  'box',
  'bracket',
  'slash',
]);

export const WEBMCP_PRESENTATION_SYMBOLS = Object.freeze([
  'question',
  'cross',
  'check',
  'heart',
  'flourish',
]);

const PRESENTATION_PLACEMENTS = Object.freeze([
  'over',
  'after',
  'before',
  'corner',
  'below',
]);

export const WEBMCP_PRESENTATION_TOUR_PHASES = Object.freeze({
  BEFORE_FOCUS: 'before-focus',
  AFTER_FOCUS: 'after-focus',
  AFTER_FOCUS_ANNOTATION: 'after-focus-annotation',
  NONE: 'none',
});

const PRESENTATION_ACTIONS = Object.freeze([
  {
    id: 'select_window',
    name: 'select_window',
    title: 'Select UI window',
    description: 'Pure UI: switch or focus an existing visible workspace, tab, or window by boardId/tabId or by a declared WebMCP targetId. Does not create UI and does not change product data.',
    type: 'intent',
    eventName: 'webmcp-command',
    inputSchema: {
      type: 'object',
      properties: {
        boardId: { type: 'string', description: 'Window, board, or workspace id from runtime context.' },
        tabId: { type: 'string', description: 'Alias for boardId.' },
        targetId: { type: 'string', description: 'Declared WebMCP target id, e.g. window:<id> or panel:<id>:<panelId>.' },
      },
    },
    metadata: { webmcpRole: 'presentation-safe-action', gesture: 'native-control', tourPhase: WEBMCP_PRESENTATION_TOUR_PHASES.BEFORE_FOCUS, targetRefs: ['window:*'] },
  },
  {
    id: 'set_panel_collapsed',
    name: 'set_panel_collapsed',
    title: 'Reveal or collapse panel',
    description: 'Pure UI: reveal or collapse an existing panel by targetId, panelId, or panelType through the native panel control. Does not create UI and does not change product data.',
    type: 'intent',
    eventName: 'webmcp-command',
    inputSchema: {
      type: 'object',
      properties: {
        targetId: { type: 'string', description: 'Declared panel target id, e.g. panel:<id>:<panelId>.' },
        boardId: { type: 'string', description: 'Window, board, or workspace id from runtime context.' },
        panelId: { type: 'string', description: 'Exact panel id from runtime context.' },
        panelType: { type: 'string', description: 'Panel type from runtime context.' },
        collapsed: { type: 'boolean', description: 'false reveals the panel; true collapses it. Omit to toggle.' },
      },
    },
    metadata: { webmcpRole: 'presentation-safe-action', gesture: 'native-control', tourPhase: WEBMCP_PRESENTATION_TOUR_PHASES.BEFORE_FOCUS, targetRefs: ['panel:*'] },
  },
  {
    id: 'annotate_ui',
    name: 'annotate_ui',
    title: 'Annotate UI during narration',
    description: 'Pure UI: draw a semantic presenter annotation on a declared target during narration. Use markers for words, values, and small controls; use symbols for meaning. Does not create UI and does not change product data.',
    type: 'intent',
    eventName: 'webmcp-command',
    inputSchema: {
      type: 'object',
      required: ['targetId'],
      properties: {
        targetId: { type: 'string', description: 'Declared WebMCP target id from runtime context.' },
        intent: { type: 'string', enum: [...WEBMCP_PRESENTATION_INTENTS], description: 'Semantic reason for the annotation.' },
        kind: { type: 'string', enum: ['marker', 'symbol'], description: 'marker draws a stroke; symbol draws a sign near the target.' },
        marker: { type: 'string', enum: WEBMCP_PRESENTATION_MARKERS.filter((marker) => marker !== 'circle'), description: 'Marker stroke shape. Prefer underline for words and small elements.' },
        symbol: { type: 'string', enum: [...WEBMCP_PRESENTATION_SYMBOLS], description: 'Presenter sign to draw near the target.' },
        placement: { type: 'string', enum: [...PRESENTATION_PLACEMENTS], description: 'Where the annotation should sit relative to the target.' },
      },
    },
    metadata: { webmcpRole: 'presentation-safe-action', gesture: 'presenter-annotation', tourPhase: WEBMCP_PRESENTATION_TOUR_PHASES.AFTER_FOCUS_ANNOTATION, targetRefs: ['window:*', 'panel:*', 'element:*'] },
  },
  {
    id: 'mark_ui',
    name: 'mark_ui',
    title: 'Draw presenter marker',
    description: 'Legacy pure UI alias for annotate_ui with kind marker. Prefer annotate_ui for new narration.',
    type: 'intent',
    eventName: 'webmcp-command',
    inputSchema: {
      type: 'object',
      required: ['targetId'],
      properties: {
        targetId: { type: 'string', description: 'Declared WebMCP target id from runtime context.' },
        marker: { type: 'string', enum: [...WEBMCP_PRESENTATION_MARKERS], description: 'Presenter marker shape.' },
      },
    },
    metadata: { webmcpRole: 'presentation-safe-action', gesture: 'presenter-marker', tourPhase: WEBMCP_PRESENTATION_TOUR_PHASES.AFTER_FOCUS_ANNOTATION, targetRefs: ['element:*'] },
  },
]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createWebMcpPresentationActions({ additionalActions = [], includeLegacyAlias = true } = {}) {
  let base = includeLegacyAlias
    ? PRESENTATION_ACTIONS
    : PRESENTATION_ACTIONS.filter((action) => action.id !== 'mark_ui');
  return [...base, ...(Array.isArray(additionalActions) ? additionalActions : [])]
    .filter(isObject)
    .map(cloneJson);
}

export function createWebMcpPresentationActionPack(options = {}) {
  let actions = createWebMcpPresentationActions(options);
  let safeActions = actions.map((action) => normalizeRuntimeSafeAction({
    ...action,
    reason: action.description,
    targetRefs: action.targetRefs || action.metadata?.targetRefs,
    metadata: {
      webmcpRole: 'presentation-safe-action',
      ...(action.metadata || {}),
    },
  }));
  return {
    actions,
    safeActions,
    actionNames: actions.map((action) => action.name).filter(Boolean),
    actionIds: actions.map((action) => action.id).filter(Boolean),
    validateCommand(command, validationOptions = {}) {
      return validateWebMcpPresentationCommand(command, { ...validationOptions, actions });
    },
    coerceCommand(command, validationOptions = {}) {
      return coerceWebMcpPresentationCommand(command, { ...validationOptions, actions });
    },
  };
}

export function describeWebMcpPresentationActions(actions = createWebMcpPresentationActions()) {
  return actions
    .filter((action) => action?.name && action?.description)
    .map((action) => `{"tool":"${action.name}","inputSchema":${JSON.stringify(action.inputSchema || { type: 'object' })}} — ${action.description}`)
    .join('\n');
}

function addString(set, value) {
  let text = String(value || '').trim();
  if (text) set.add(text);
}

function addWindowIdAliases(set, value) {
  let text = String(value || '').trim();
  if (!text) return;
  set.add(text);
  if (text.startsWith('window:')) set.add(text.slice('window:'.length));
  else set.add(`window:${text}`);
}

function addRuntimeRefItem(refs, item = {}) {
  addString(refs.targetIds, item.id || item.targetId);
  addString(refs.panelIds, item.panelId);
  addString(refs.panelTypes, item.panelType);
  addWindowIdAliases(refs.windowIds, item.tabId || item.boardId || item.windowId || item.surfaceId);
  if (['window', 'workspace', 'tab', 'home'].includes(item.kind)) {
    addWindowIdAliases(refs.windowIds, item.id);
  }
  let id = String(item.id || '').trim();
  if (id.startsWith('window:')) addWindowIdAliases(refs.windowIds, id.slice('window:'.length));
  if (id.startsWith('panel:')) {
    let [, windowId, panelId] = id.split(':');
    addWindowIdAliases(refs.windowIds, windowId);
    addString(refs.panelIds, panelId);
  }
  addRuntimeRefList(refs, item.children);
}

function addRuntimeRefList(refs, items) {
  for (let item of Array.isArray(items) ? items : []) {
    if (isObject(item)) addRuntimeRefItem(refs, item);
    else addString(refs.targetIds, item);
  }
}

export function collectWebMcpPresentationRefs(runtime = {}, options = {}) {
  let refs = {
    targetIds: new Set(),
    panelIds: new Set(),
    panelTypes: new Set(),
    windowIds: new Set(),
  };
  for (let key of ['targets', 'cues', 'surfaces', 'windows', 'tabs', 'panels']) {
    addRuntimeRefList(refs, runtime?.[key]);
  }
  addRuntimeRefList(refs, options.runtimeTargets);
  addRuntimeRefList(refs, options.targets);
  for (let id of options.allowedTargetIds || []) addString(refs.targetIds, id);
  for (let id of options.allowedPanelIds || []) addString(refs.panelIds, id);
  for (let type of options.allowedPanelTypes || []) addString(refs.panelTypes, type);
  for (let id of options.allowedWindowIds || []) addWindowIdAliases(refs.windowIds, id);
  return refs;
}

function normalizeToolName(value) {
  return String(value || '').trim();
}

function actionByToolName(actions, tool) {
  let name = normalizeToolName(tool);
  if (!name) return null;
  return (Array.isArray(actions) ? actions : []).find((action) => (
    action?.name === name || action?.id === name
  )) || null;
}

function normalizeWebMcpPresentationTourPhase(value) {
  let phase = String(value || '').trim();
  return Object.values(WEBMCP_PRESENTATION_TOUR_PHASES).includes(phase) ? phase : '';
}

function webMcpPresentationActionsFromOptions(options = {}) {
  return Array.isArray(options.actions) ? options.actions : createWebMcpPresentationActions(options);
}

function webMcpPresentationActionFromValue(value, actions) {
  if (isObject(value) && value.metadata && (value.name || value.id) && !('input' in value)) return value;
  let tool = isObject(value) ? value.tool || value.name || value.id : value;
  return actionByToolName(actions, tool);
}

export function getWebMcpPresentationActionPhase(value, options = {}) {
  let actions = webMcpPresentationActionsFromOptions(options);
  let action = webMcpPresentationActionFromValue(value, actions);
  if (!action) return WEBMCP_PRESENTATION_TOUR_PHASES.NONE;
  let phase = normalizeWebMcpPresentationTourPhase(action.metadata?.tourPhase || action.metadata?.presentationPhase);
  if (phase) return phase;
  let gesture = String(action.metadata?.gesture || '').trim();
  if (gesture === 'native-control') return WEBMCP_PRESENTATION_TOUR_PHASES.BEFORE_FOCUS;
  if (gesture === 'presenter-annotation' || gesture === 'presenter-marker') {
    return WEBMCP_PRESENTATION_TOUR_PHASES.AFTER_FOCUS_ANNOTATION;
  }
  return WEBMCP_PRESENTATION_TOUR_PHASES.AFTER_FOCUS;
}

export function createWebMcpTourTurnActionPlan(turn = {}, options = {}) {
  let actions = webMcpPresentationActionsFromOptions(options);
  let source = isObject(turn?.webmcp) ? turn.webmcp : null;
  let action = webMcpPresentationActionFromValue(source, actions);
  let phase = source ? getWebMcpPresentationActionPhase(source, { ...options, actions }) : WEBMCP_PRESENTATION_TOUR_PHASES.NONE;
  let command = action && phase !== WEBMCP_PRESENTATION_TOUR_PHASES.NONE ? {
    tool: action.name || action.id,
    input: isObject(source.input) ? { ...source.input } : {},
  } : null;
  return {
    action,
    command,
    phase,
    runBeforeFocus: phase === WEBMCP_PRESENTATION_TOUR_PHASES.BEFORE_FOCUS,
    runAfterFocus: phase === WEBMCP_PRESENTATION_TOUR_PHASES.AFTER_FOCUS,
    runAsAnnotation: phase === WEBMCP_PRESENTATION_TOUR_PHASES.AFTER_FOCUS_ANNOTATION,
    runAsEffect: phase === WEBMCP_PRESENTATION_TOUR_PHASES.AFTER_FOCUS,
  };
}

function schemaTypeMatches(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return isObject(value);
  if (type === 'number' || type === 'integer') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

function schemaValidationErrors(input, schema = {}, path = 'input') {
  if (!isObject(schema)) return [];
  let errors = [];
  if (schema.type && !schemaTypeMatches(input, schema.type)) {
    errors.push(`${path} must be ${schema.type}`);
    return errors;
  }
  if (schema.type === 'object' || schema.properties || schema.required) {
    if (!isObject(input)) {
      errors.push(`${path} must be object`);
      return errors;
    }
    for (let key of Array.isArray(schema.required) ? schema.required : []) {
      if (input[key] === undefined || input[key] === null || input[key] === '') {
        errors.push(`${path}.${key} is required`);
      }
    }
    for (let [key, propSchema] of Object.entries(schema.properties || {})) {
      if (input[key] === undefined || input[key] === null || input[key] === '') continue;
      if (propSchema?.type && !schemaTypeMatches(input[key], propSchema.type)) {
        errors.push(`${path}.${key} must be ${propSchema.type}`);
      }
      if (Array.isArray(propSchema?.enum) && !propSchema.enum.includes(input[key])) {
        errors.push(`${path}.${key} must be one of ${propSchema.enum.join(', ')}`);
      }
    }
  }
  return errors;
}

function hasRefs(set) {
  return set && set.size > 0;
}

function isAllowedWindowId(refs, value) {
  let text = String(value || '').trim();
  if (!text) return true;
  return !hasRefs(refs.windowIds) || refs.windowIds.has(text) || refs.windowIds.has(`window:${text}`);
}

function presentationRefErrors(action, input, refs) {
  let name = action?.name || action?.id || '';
  let errors = [];
  let targetId = String(input.targetId || '').trim();
  let boardId = String(input.boardId || input.tabId || '').trim();
  let panelId = String(input.panelId || '').trim();
  let panelType = String(input.panelType || '').trim();

  if ((name === 'annotate_ui' || name === 'mark_ui') && targetId && hasRefs(refs.targetIds) && !refs.targetIds.has(targetId)) {
    errors.push(`targetId "${targetId}" is not declared`);
  }
  if (name === 'select_window') {
    if (!targetId && !boardId) errors.push('targetId, boardId, or tabId is required');
    if (targetId && hasRefs(refs.targetIds) && !refs.targetIds.has(targetId)) {
      errors.push(`targetId "${targetId}" is not declared`);
    }
    if (boardId && !isAllowedWindowId(refs, boardId)) {
      errors.push(`window "${boardId}" is not declared`);
    }
  }
  if (name === 'set_panel_collapsed') {
    if (!targetId && !panelId && !panelType) errors.push('targetId, panelId, or panelType is required');
    if (targetId && hasRefs(refs.targetIds) && !refs.targetIds.has(targetId)) {
      errors.push(`targetId "${targetId}" is not declared`);
    }
    if (panelId && hasRefs(refs.panelIds) && !refs.panelIds.has(panelId)) {
      errors.push(`panelId "${panelId}" is not declared`);
    }
    if (panelType && hasRefs(refs.panelTypes) && !refs.panelTypes.has(panelType)) {
      errors.push(`panelType "${panelType}" is not declared`);
    }
    if (boardId && !isAllowedWindowId(refs, boardId)) {
      errors.push(`window "${boardId}" is not declared`);
    }
  }
  return errors;
}

export function validateWebMcpPresentationCommand(command = {}, options = {}) {
  let actions = Array.isArray(options.actions)
    ? options.actions
    : createWebMcpPresentationActions(options);
  let allowedToolNames = new Set((options.allowedToolNames || actions.map((action) => action.name)).filter(Boolean));
  let tool = normalizeToolName(command?.tool || command?.name);
  let action = actionByToolName(actions, tool);
  let input = isObject(command?.input) ? { ...command.input } : null;
  let errors = [];
  if (!tool) errors.push('tool is required');
  else if (!allowedToolNames.has(tool)) errors.push(`tool "${tool}" is not allowed`);
  if (!action) errors.push(`tool "${tool}" is not declared`);
  if (!input) errors.push('input must be object');
  if (action && input) {
    errors.push(...schemaValidationErrors(input, action.inputSchema || { type: 'object' }));
    errors.push(...presentationRefErrors(action, input, collectWebMcpPresentationRefs(options.runtime, options)));
  }
  return {
    valid: errors.length === 0,
    errors,
    action,
    command: errors.length === 0 ? { tool: action.name || tool, input } : null,
  };
}

export function coerceWebMcpPresentationCommand(command = {}, options = {}) {
  let result = validateWebMcpPresentationCommand(command, options);
  return result.valid ? result.command : null;
}

export const WEBMCP_DEFAULT_DETAIL_TARGET_SELECTOR = 'sn-badge, button, [slot="title"], sn-description-item';

export function normalizeWebMcpTargetText(value, fallback = '', { limit = 0 } = {}) {
  let text = String(value ?? '')
    .replace(/\b(?:undefined|null|NaN)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
  if (!text) text = String(fallback ?? '').replace(/\s+/g, ' ').trim();
  if (limit > 0 && text.length > limit) return `${text.slice(0, Math.max(0, limit - 1)).trim()}…`;
  return text;
}

export function webMcpTargetAttrValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function formatWebMcpTargetLine(target = {}, fields = ['kind', 'title', 'resourceType', 'windowRole', 'layoutPreset', 'component', 'summary']) {
  let parts = [];
  for (let field of fields) {
    if (field === 'collapsed') {
      if (target.collapsed) parts.push('collapsed');
      continue;
    }
    let value = target?.[field];
    if (field === 'title' || field === 'summary') value = normalizeWebMcpTargetText(value);
    if (value) parts.push(String(value));
  }
  if (target.collapsed && !fields.includes('collapsed')) parts.push('collapsed');
  return parts.filter(Boolean).join(' · ');
}

function normalizeWebMcpTargetDescriptor(target = {}, defaults = {}) {
  if (!isObject(target)) return null;
  let id = normalizeWebMcpTargetText(target.id || defaults.id);
  if (!id) return null;
  let clean = {
    ...defaults,
    ...target,
    id,
    kind: normalizeWebMcpTargetText(target.kind || defaults.kind || 'detail'),
    title: normalizeWebMcpTargetText(target.title, defaults.title || id, { limit: 96 }),
    summary: normalizeWebMcpTargetText(target.summary, defaults.summary || '', { limit: 220 }),
  };
  delete clean.element;
  delete clean.el;
  delete clean.node;
  return clean;
}

function webMcpTargetCollectors(root, includeRoot = true) {
  let roots = Array.isArray(root) ? root : [root];
  let candidates = [];
  let seen = new Set();
  let add = (el) => {
    if (!el || seen.has(el) || typeof el.getWebMcpTargets !== 'function') return;
    seen.add(el);
    candidates.push(el);
  };
  for (let item of roots) {
    if (includeRoot) add(item);
    for (let el of item?.querySelectorAll?.('*') || []) add(el);
  }
  return candidates;
}

export function collectWebMcpComponentTargets(root, options = {}) {
  let targets = [];
  let seenIds = new Set();
  let defaults = {
    tabId: options.tabId,
    panelId: options.panelId,
    resourceType: options.resourceType,
    component: options.component,
  };
  for (let component of webMcpTargetCollectors(root, options.includeRoot !== false)) {
    let componentName = component.localName || component.tagName?.toLowerCase?.() || defaults.component || '';
    let rawTargets = [];
    try {
      rawTargets = component.getWebMcpTargets({
        ...options,
        component: componentName,
      }) || [];
    } catch {
      rawTargets = [];
    }
    for (let raw of Array.isArray(rawTargets) ? rawTargets : []) {
      let normalized = normalizeWebMcpTargetDescriptor(raw, { ...defaults, component: componentName });
      if (!normalized || seenIds.has(normalized.id)) continue;
      let enriched = typeof options.enrichTarget === 'function'
        ? options.enrichTarget(normalized, { component, sourceTarget: raw, options })
        : normalized;
      normalized = normalizeWebMcpTargetDescriptor(enriched, normalized);
      if (!normalized || seenIds.has(normalized.id)) continue;
      try {
        let el = raw.element || raw.el || null;
        if (el?.dataset) el.dataset.tourTargetId = normalized.id;
        else el?.setAttribute?.(options.targetAttribute || 'data-tour-target-id', normalized.id);
      } catch {}
      seenIds.add(normalized.id);
      targets.push(normalized);
    }
  }
  return targets;
}

function resolveElementSource(source, ...args) {
  if (typeof source === 'function') return source(...args);
  return source || null;
}

function panelSelectorForId(panelId, options = {}) {
  if (typeof options.panelSelector === 'function') return options.panelSelector(panelId);
  return `[data-panel-id="${webMcpTargetAttrValue(panelId)}"]`;
}

function windowEntryById(windows, id) {
  let windowId = String(id || '').trim();
  return (Array.isArray(windows) ? windows : []).find((item) => (
    item?.id === windowId
    || item?.windowId === windowId
    || item?.tabId === windowId
    || item?.tab?.id === windowId
  )) || null;
}

export function resolveWebMcpRuntimeTarget(id, options = {}) {
  let value = String(id || '').trim();
  let doc = options.document || globalThis.document;
  let windows = options.windows || [];
  if (!value) return null;
  if (value === 'home') return { home: true, el: resolveElementSource(options.home, value) };
  if (value === 'chat') return { el: resolveElementSource(options.chat, value) };
  if (value === 'theme') return { el: resolveElementSource(options.theme, value) };
  if (value.startsWith('window:')) {
    let entry = windowEntryById(windows, value.slice('window:'.length));
    return entry ? { ...entry, tab: entry.tab || entry, layout: entry.layout || entry.tab?.layout || null, el: entry.el || entry.container || entry.tab?.container || null } : null;
  }
  if (value.startsWith('panel:')) {
    let [, tabId, ...panelParts] = value.split(':');
    let panelId = panelParts.join(':');
    let entry = windowEntryById(windows, tabId);
    let layout = entry?.layout || entry?.tab?.layout || null;
    let el = layout && panelId ? layout.querySelector?.(panelSelectorForId(panelId, options)) : null;
    return entry ? { ...entry, tab: entry.tab || entry, layout, panelId, el } : null;
  }
  if (value.startsWith('element:')) {
    let attr = options.targetAttribute || 'data-tour-target-id';
    let selector = `[${attr}="${webMcpTargetAttrValue(value)}"]`;
    let el = doc?.querySelector?.(selector) || null;
    let [, tabId, panelId, rawIndex] = value.split(':');
    let entry = windowEntryById(windows, tabId)
      || (Array.isArray(windows) ? windows : []).find((candidate) => candidate?.container?.contains?.(el) || candidate?.tab?.container?.contains?.(el));
    let layout = entry?.layout || entry?.tab?.layout || null;
    if (!el && layout && panelId) {
      let panelEl = layout.querySelector?.(panelSelectorForId(panelId, options));
      let detailSelector = options.detailSelector || WEBMCP_DEFAULT_DETAIL_TARGET_SELECTOR;
      let candidates = [...(panelEl?.querySelectorAll?.(detailSelector) || [])]
        .filter((candidate) => normalizeWebMcpTargetText(candidate?.innerText || candidate?.textContent, '', { limit: options.detailTextLimit || 80 }));
      el = candidates[Number(rawIndex)] || null;
      try {
        if (el) {
          if (el.dataset) el.dataset.tourTargetId = value;
          else el.setAttribute?.(attr, value);
        }
      } catch {}
    }
    return el ? { ...entry, tab: entry?.tab || entry, layout, panelId, el } : null;
  }
  return null;
}

function optionValue(source, ...args) {
  return typeof source === 'function' ? source(...args) : source;
}

function presentationWindows(options = {}) {
  return optionValue(options.windows, options) || optionValue(options.getWindows, options) || [];
}

function presentationTargetOptions(options = {}) {
  return {
    document: options.document || globalThis.document,
    windows: presentationWindows(options),
    home: options.home,
    chat: options.chat,
    theme: options.theme,
    detailSelector: options.detailSelector,
    detailTextLimit: options.detailTextLimit,
    targetAttribute: options.targetAttribute,
    panelSelector: options.panelSelector,
  };
}

function presentationWindowIdFromInput(input = {}, resolved = null) {
  let targetId = String(input.targetId || '').trim();
  let id = String(input.boardId || input.tabId || input.windowId || input.id || '').trim();
  if (!id && (targetId === 'home' || resolved?.home)) id = 'home';
  if (!id && targetId.startsWith('window:')) id = targetId.slice('window:'.length);
  if (!id && (targetId.startsWith('panel:') || targetId.startsWith('element:'))) id = targetId.split(':')[1] || '';
  if (!id) id = resolved?.tab?.id || resolved?.id || resolved?.windowId || resolved?.tabId || '';
  return String(id || '').trim();
}

function presentationShell(options = {}) {
  return optionValue(options.shell, options) || null;
}

function presentationTabs(shell) {
  return shell?.querySelector?.('project-tabs') || shell?.ref?.tabs || null;
}

function presentationWindowControl(id, options = {}) {
  let custom = optionValue(options.windowControl, id, options);
  if (custom) return custom;
  let shell = presentationShell(options);
  let tabs = presentationTabs(shell);
  if (!tabs || !id) return null;
  if (id === 'home') {
    return tabs.querySelector?.('.tab') || tabs.getTabsElements?.()[0] || null;
  }
  let items = [...(tabs.querySelectorAll?.('project-tab-item') || [])];
  return items.find((item) => item?.$?.id === id || item?.id === id || item?.dataset?.id === id) || null;
}

function presentationCursor(options = {}) {
  return optionValue(options.cursor, options) || optionValue(options.getCursor, options) || null;
}

function settleLater(fn) {
  try { fn?.(); } catch {}
}

function clickPresentationControl(el, options = {}, onSettled = null) {
  if (!el) {
    settleLater(onSettled);
    return false;
  }
  try { el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); } catch {}
  let clicker = options.clickElement;
  let done = () => settleLater(onSettled);
  if (typeof clicker === 'function') {
    try {
      clicker(el, { onSettled: done, onGestureSettled: done });
      return true;
    } catch {}
  }
  let cursor = presentationCursor(options);
  try {
    if (typeof cursor?.clickElement === 'function') {
      cursor.clickElement(el, { onGestureSettled: done });
      return true;
    }
    if (typeof cursor?.moveTo === 'function') {
      cursor.moveTo(el, {
        onGestureSettled: () => {
          try { el.click?.(); } catch {}
          done();
        },
      });
      return true;
    }
  } catch {}
  try { el.click?.(); } catch {}
  done();
  return true;
}

function dispatchWebMcpDomEvent(el, type, detail = {}) {
  if (!el || !type) return false;
  try {
    let EventCtor = el.ownerDocument?.defaultView?.CustomEvent || globalThis.CustomEvent;
    if (typeof EventCtor === 'function') {
      el.dispatchEvent?.(new EventCtor(type, { bubbles: true, composed: true, detail }));
      return true;
    }
  } catch {}
  try {
    el.dispatchEvent?.({ type, bubbles: true, composed: true, detail });
    return true;
  } catch {}
  return false;
}

function presentationPanelNode(layout, panelId, options = {}) {
  if (!layout || !panelId) return null;
  let custom = optionValue(options.panelNode, layout, panelId, options);
  if (custom) return custom;
  let panelEl = layout.querySelector?.(panelSelectorForId(panelId, options));
  return panelEl?.closest?.('layout-node') || panelEl || null;
}

function presentationPanelCollapsed(layout, panelId, options = {}) {
  if (typeof options.isPanelCollapsed === 'function') return Boolean(options.isPanelCollapsed(layout, panelId));
  let node = presentationPanelNode(layout, panelId, options);
  return Boolean(node?.hasAttribute?.('collapsed'));
}

function presentationPanelControl(layout, panelId, options = {}) {
  let custom = optionValue(options.panelCollapseControl, layout, panelId, options);
  if (custom) return custom;
  let node = presentationPanelNode(layout, panelId, options);
  return node?.querySelector?.('.collapse-btn:not([hidden])') || null;
}

function presentationPanelTarget(input = {}, options = {}) {
  let resolved = input.targetId ? resolveWebMcpRuntimeTarget(input.targetId, presentationTargetOptions(options)) : null;
  let windowId = presentationWindowIdFromInput(input, resolved);
  let entry = resolved || windowEntryById(presentationWindows(options), windowId);
  let layout = resolved?.layout || entry?.layout || entry?.tab?.layout || null;
  let panelId = String(resolved?.panelId || input.panelId || '').trim();
  if (!panelId && typeof options.findPanel === 'function') {
    let found = options.findPanel(layout, { panelId: input.panelId, panelType: input.panelType, input, resolved });
    panelId = String(found?.id || found?.panelId || '').trim();
  }
  if (!panelId && input.panelType) panelId = String(input.panelType || '').trim();
  return { resolved, entry, windowId, layout, panelId };
}

function syncPresentationPanelState(layout, options = {}) {
  try { options.syncPanelState?.(layout); } catch {}
}

function setPresentationPanelCollapsed(input = {}, options = {}) {
  let target = presentationPanelTarget(input, options);
  let { layout, panelId } = target;
  if (!layout || !panelId) return { ok: false, reason: 'panel-target-not-found', ...target };
  let collapsed = typeof input.collapsed === 'boolean'
    ? input.collapsed
    : !presentationPanelCollapsed(layout, panelId, options);
  let settle = () => {
    syncPresentationPanelState(layout, options);
    try { input.onSettled?.(); } catch {}
    try { options.onPanelCollapsed?.({ ...target, collapsed, input }); } catch {}
  };
  if (presentationPanelCollapsed(layout, panelId, options) === collapsed) {
    settle();
    return { ok: true, changed: false, collapsed, ...target };
  }
  let dispatch = () => {
    let node = presentationPanelNode(layout, panelId, options) || layout;
    dispatchWebMcpDomEvent(node, 'panel-collapse-toggle', { panelId, collapsed });
    settle();
  };
  if (input.visual !== false) {
    let control = presentationPanelControl(layout, panelId, options);
    if (control) {
      clickPresentationControl(control, options, () => {
        if (presentationPanelCollapsed(layout, panelId, options) !== collapsed) {
          dispatchWebMcpDomEvent(presentationPanelNode(layout, panelId, options) || layout, 'panel-collapse-toggle', { panelId, collapsed });
        }
        settle();
      });
      return { ok: true, changed: true, collapsed, visual: true, ...target };
    }
  }
  dispatch();
  return { ok: true, changed: true, collapsed, visual: false, ...target };
}

function selectPresentationWindow(input = {}, options = {}) {
  let resolved = input.targetId ? resolveWebMcpRuntimeTarget(input.targetId, presentationTargetOptions(options)) : null;
  let windowId = presentationWindowIdFromInput(input, resolved);
  if (!windowId) return { ok: false, reason: 'window-target-not-found', resolved };
  let settled = false;
  let settle = () => {
    if (settled) return;
    settled = true;
    let selected = false;
    try { selected = options.selectWindow?.(windowId, { input, resolved }) !== false; } catch {}
    if (!selected) {
      let shell = presentationShell(options);
      if (typeof shell?.selectGroup === 'function') selected = shell.selectGroup(windowId, input.source || 'webmcp-presentation') !== false;
    }
    try { input.onSettled?.(); } catch {}
  };
  if (input.visual !== false) {
    let control = presentationWindowControl(windowId, options);
    if (control) {
      clickPresentationControl(control, options, settle);
      settle();
      return { ok: true, windowId, visual: true, resolved };
    }
  }
  settle();
  return { ok: true, windowId, visual: false, resolved };
}

function dataTableRowTarget(input = {}, options = {}) {
  let resolved = input.targetId ? resolveWebMcpRuntimeTarget(input.targetId, presentationTargetOptions(options)) : null;
  let rowId = String(input.rowId || input.wonum || input.id || resolved?.el?.dataset?.rowId || '').trim();
  let windowId = presentationWindowIdFromInput(input, resolved);
  let panel = presentationPanelTarget({ ...input, targetId: input.targetId, boardId: windowId, panelId: input.panelId || resolved?.panelId }, options);
  let panelEl = resolved?.panelId && panel.layout
    ? panel.layout.querySelector?.(panelSelectorForId(resolved.panelId, options))
    : panel.layout?.querySelector?.(panelSelectorForId(panel.panelId || input.panelId || '', options));
  let table = resolved?.el?.closest?.('sn-data-table') || panelEl?.querySelector?.('sn-data-table') || null;
  let row = resolved?.el?.closest?.('tr[data-row-id]') || null;
  if (!row && table && rowId) row = table.querySelector?.(`tr[data-row-id="${webMcpTargetAttrValue(rowId)}"]`) || null;
  let control = row?.querySelector?.('.sn-data-table-select-row') || row || resolved?.el || null;
  if (!rowId) rowId = String(row?.dataset?.rowId || '').trim();
  return { ...panel, resolved, windowId: windowId || panel.windowId, panelEl, table, row, control, rowId };
}

function selectPresentationDataTableRow(input = {}, options = {}) {
  let target = dataTableRowTarget(input, options);
  let { table, rowId, control } = target;
  if (!table || !rowId) return { ok: false, reason: 'data-table-row-not-found', ...target };
  let selected = Array.isArray(table.selectedRowIds) && table.selectedRowIds.map(String).includes(rowId);
  let rowData = null;
  try { rowData = table.getData?.().rows?.find?.((row) => String(row.id) === rowId) || null; } catch {}
  let settle = () => {
    if (!Array.isArray(table.selectedRowIds) || !table.selectedRowIds.map(String).includes(rowId)) {
      try { table.selectedRowIds = [rowId]; } catch {}
      dispatchWebMcpDomEvent(table, 'sn-data-table-select', { rowId, row: rowData, selectedRowIds: table.selectedRowIds || [rowId] });
    }
    try { input.onSettled?.(); } catch {}
    try { options.onDataTableRowSelected?.({ ...target, row: rowData, input }); } catch {}
  };
  if (selected) {
    if (input.visual !== false && control) {
      clickPresentationControl(control, options, settle);
      return { ok: true, changed: false, selected: true, visual: true, ...target };
    }
    settle();
    return { ok: true, changed: false, selected: true, ...target };
  }
  if (input.visual !== false && control) {
    clickPresentationControl(control, options, settle);
    return { ok: true, changed: true, selected: true, visual: true, ...target };
  }
  settle();
  return { ok: true, changed: true, selected: true, visual: false, ...target };
}

export function createWebMcpPresentationController(options = {}) {
  let currentOptions = { ...options };
  let controller = {
    configure(nextOptions = {}) {
      currentOptions = { ...currentOptions, ...nextOptions };
      return controller;
    },
    resolveTarget(id, extraOptions = {}) {
      return resolveWebMcpRuntimeTarget(id, presentationTargetOptions({ ...currentOptions, ...extraOptions }));
    },
    clickControl(el, input = {}) {
      return clickPresentationControl(el, currentOptions, input.onSettled);
    },
    selectWindow(input = {}) {
      return selectPresentationWindow(input, currentOptions);
    },
    setPanelCollapsed(input = {}) {
      return setPresentationPanelCollapsed(input, currentOptions);
    },
    selectDataTableRow(input = {}) {
      return selectPresentationDataTableRow(input, currentOptions);
    },
  };
  return controller;
}

export const DEFAULT_WEBMCP_TOUR_PERSONAS = Object.freeze({
  guide: { pitch: 1.15, rate: 1 },
  ops: { pitch: 0.8, rate: 1 },
});

function cleanTourText(value) {
  return normalizeWebMcpTargetText(value);
}

function tourLineList(items = [], formatter) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item && item.id)
    .map(formatter)
    .join('\n');
}

export function formatWebMcpTourTargetLine(target = {}) {
  let tags = [];
  if (target.collapsed) tags.push('collapsed');
  let suffix = tags.length ? ` [${tags.join(', ')}]` : '';
  let meta = [
    target.kind,
    target.resourceType,
    target.windowRole,
    target.layoutPreset,
    target.component,
  ].filter(Boolean).join(', ');
  return `- ${target.id}: ${cleanTourText(target.title)}${meta ? ` (${meta})` : ''} — ${cleanTourText(target.summary)}${suffix}`;
}

export function describeWebMcpTourActionInstructions(actions = createWebMcpPresentationActions()) {
  let lines = describeWebMcpPresentationActions(actions);
  return `A turn MAY include optional "webmcp" — a SAFE UI action during narration. Allowed tools only:\n${lines}\nThe host already selects the cue target and reveals collapsed cue panels, so include webmcp only when you want the gesture to be explicit. Never add other tools, never build new UI, and never change product data.`;
}

export function buildWebMcpTourPrompt({
  title = '',
  language = 'the active UI language',
  targets = [],
  actions = createWebMcpPresentationActions(),
} = {}) {
  let safeTitle = String(title || '').trim() || 'Current UI';
  let targetList = Array.isArray(targets) ? targets.filter((target) => target && target.id) : [];
  let targetLines = targetList.length ? tourLineList(targetList, formatWebMcpTourTargetLine) : '- no runtime targets supplied';
  return `You are an interface narrator for UI that this agent already created. The request includes browser-level WebMCP context with product views/actions, live runtime surfaces, and narration cues; use it as the source of truth. Generate a short guided tour of the current workspace in TWO voices: guide (host, overview) and ops (operator, details). Workspace: "${safeTitle}". In cue use ONLY these targetId values:\n${targetLines}\nWrite ALL narration text in ${language}. Return STRICTLY one \`\`\`json block with the schema: {"personas":{"guide":{"pitch":1.15,"rate":1},"ops":{"pitch":0.8,"rate":1}},"turns":[{"persona":"guide|ops","text":"lively spoken ${language} without markdown or symbols","cue":{"targetId":"one of the listed ids"},"annotations":[{"targetId":"optional listed detail id","intent":"detail|question|risk|success|affinity|flourish","kind":"marker|symbol","marker":"underline|box|bracket|slash","symbol":"question|cross|check|heart|flourish","placement":"over|after|before|corner|below"}]}]}. Rules: 5-8 turns, voices alternate, include only the targets that matter for a concise explanation, and do not repeat the raw target metadata. Keep the text short, conversational, in ${language}, without symbols. cue is for cursor focus and the host draws its own focus frame; do NOT duplicate that focus with box/circle/bracket annotations on the same target. Use marker annotations only for detail targets such as words, values, badges, and small controls; use question/cross/check/heart/flourish symbols for meaning. Do NOT say undefined, null, NaN, or missing raw values; skip unavailable data instead. Do NOT quote raw code tokens from source panels. Do NOT use words about position (left, right, top, bottom, center) — the interface is adaptive and panels can be anywhere; use neutral transitions in ${language}. Some targets may be tagged [collapsed]; the interface reveals them for that turn and restores them afterward, so narrate their purpose normally. ${describeWebMcpTourActionInstructions(actions)} No text outside the json block.`;
}

function markerTargetAllowed(targetId, targetMap = new Map()) {
  let id = String(targetId || '').trim();
  if (!id) return false;
  if (id.startsWith('element:')) return true;
  let target = targetMap.get(id);
  return Boolean(target?.annotation || target?.kind === 'detail' || target?.presentationRole === 'detail');
}

function normalizeTourAnnotation(raw, cue, { allowedTargets, targetMap = new Map() }) {
  if (!isObject(raw)) return null;
  let rawTargetId = String(raw.targetId || '').trim();
  let targetId = rawTargetId && allowedTargets.has(rawTargetId) ? rawTargetId : '';
  if (!targetId && cue?.targetId) targetId = cue.targetId;
  if (!targetId) return null;
  let kind = ['marker', 'symbol'].includes(raw.kind) ? raw.kind : (raw.symbol ? 'symbol' : 'marker');
  let marker = WEBMCP_PRESENTATION_MARKERS.includes(raw.marker) ? raw.marker : '';
  if (marker === 'circle') marker = 'box';
  let symbol = WEBMCP_PRESENTATION_SYMBOLS.includes(raw.symbol) ? raw.symbol : '';
  if (kind === 'marker' && !marker) marker = 'underline';
  if (kind === 'symbol' && !symbol) symbol = 'question';
  if (kind === 'marker' && !markerTargetAllowed(targetId, targetMap)) return null;
  let placement = PRESENTATION_PLACEMENTS.includes(raw.placement) ? raw.placement : 'over';
  let intent = WEBMCP_PRESENTATION_INTENTS.includes(raw.intent) ? raw.intent : 'emphasize';
  return {
    targetId,
    kind,
    intent,
    ...(kind === 'symbol' ? { symbol } : { marker }),
    placement,
  };
}

function extractJsonBlock(text) {
  let source = String(text ?? '');
  let fence = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  let bare = source.match(/\{[\s\S]*\}/);
  return bare ? bare[0].trim() : '';
}

export function coerceWebMcpTourTimelinePayload(responseText, {
  actions = createWebMcpPresentationActions(),
  personas = DEFAULT_WEBMCP_TOUR_PERSONAS,
  allowedTargetIds = [],
  runtimeTargets = [],
  allowedToolNames = actions.map((action) => action.name),
} = {}) {
  let raw = extractJsonBlock(responseText);
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isObject(parsed)) return null;

  let resultPersonas = isObject(parsed.personas) ? parsed.personas : cloneJson(personas);
  let targetEntries = Array.isArray(runtimeTargets) ? runtimeTargets.filter(isObject) : [];
  let targetMap = new Map(targetEntries.map((target) => [String(target.id || target.targetId || '').trim(), target]).filter(([id]) => id));
  let allowedTargets = new Set((Array.isArray(allowedTargetIds) ? allowedTargetIds : []).filter(Boolean));
  for (let id of targetMap.keys()) allowedTargets.add(id);
  let toolNames = (Array.isArray(allowedToolNames) ? allowedToolNames : []).filter(Boolean);
  let turns = [];
  for (let item of Array.isArray(parsed.turns) ? parsed.turns : []) {
    if (!isObject(item)) continue;
    let text = normalizeWebMcpTargetText(item.text);
    if (!text) continue;
    let persona = item.persona === 'ops' ? 'ops' : 'guide';
    let targetId = item.cue?.targetId;
    if (typeof targetId !== 'string' || !allowedTargets.has(targetId)) continue;
    let cue = { targetId };
    let turn = { persona, text, cue };
    let annotations = [];
    for (let rawAnnotation of Array.isArray(item.annotations) ? item.annotations : []) {
      let annotation = normalizeTourAnnotation(rawAnnotation, cue, { allowedTargets, targetMap });
      if (annotation) annotations.push(annotation);
    }
    let legacyMarker = String(item.cue?.marker || item.cue?.gesture || item.marker || item.gesture || '').trim();
    if (WEBMCP_PRESENTATION_MARKERS.includes(legacyMarker) && cue.targetId && markerTargetAllowed(cue.targetId, targetMap)) {
      annotations.push({
        targetId: cue.targetId,
        kind: 'marker',
        intent: 'emphasize',
        marker: legacyMarker === 'circle' ? 'box' : legacyMarker,
        placement: 'over',
      });
    }
    if (annotations.length) turn.annotations = annotations;

    let webmcp = coerceWebMcpPresentationCommand(item.webmcp, {
      actions,
      allowedToolNames: toolNames,
      allowedTargetIds,
    });
    if (webmcp) {
      if (webmcp.tool === 'annotate_ui' || webmcp.tool === 'mark_ui') {
        let targetId = String(webmcp.input.targetId || '').trim();
        let annotation = normalizeTourAnnotation(
          webmcp.tool === 'mark_ui'
            ? { ...webmcp.input, kind: 'marker', marker: webmcp.input.marker || webmcp.input.gesture || webmcp.input.shape || 'box' }
            : webmcp.input,
          { targetId },
          { allowedTargets, targetMap },
        );
        if (targetId && allowedTargets.has(targetId) && annotation) {
          turn.webmcp = { tool: 'annotate_ui', input: { targetId, ...annotation } };
        }
      } else {
        turn.webmcp = { tool: webmcp.tool, input: webmcp.input };
      }
    }
    turns.push(turn);
  }
  return turns.length ? { personas: resultPersonas, turns } : null;
}

export function createProductWebMcpBundle(productContext, options = {}) {
  let context = normalizeProductContext(productContext);
  let runtimeInput = options.runtime === undefined && isObject(productContext)
    ? productContext.runtime
    : options.runtime;

  if (Array.isArray(options.safeActions)) {
    runtimeInput = {
      ...(isObject(runtimeInput) ? runtimeInput : {}),
      safeActions: options.safeActions,
    };
  }

  if (typeof options.enrichRuntime === 'function') {
    let enrichedRuntime = options.enrichRuntime(runtimeInput, context);
    if (enrichedRuntime !== undefined) runtimeInput = enrichedRuntime;
  }

  let contextView = createProductRuntimeContext(context, runtimeInput);
  if (typeof options.enrichContext === 'function') {
    let enrichedContextView = options.enrichContext(contextView, context);
    if (enrichedContextView !== undefined) contextView = enrichedContextView;
  }

  let agentView = createProductContextAgentView(context);
  let descriptors = createProductContextToolDescriptors(context);
  if (typeof options.enrichActionDescriptor === 'function') {
    descriptors = descriptors.map((descriptor, index) => (
      options.enrichActionDescriptor({ ...descriptor }, context.actions[index], context) || descriptor
    ));
  }

  return {
    context,
    contextView,
    agentView,
    runtime: contextView.runtime,
    descriptors,
    safeActions: contextView.runtime.safeActions || [],
    safeActionRefs: contextView.runtime.safeActionRefs || [],
  };
}

function entryCandidateValue(entry, key) {
  if (!entry || !key) return undefined;
  if (entry[key] !== undefined) return entry[key];
  if (entry.data?.[key] !== undefined) return entry.data[key];
  if (entry.state?.[key] !== undefined) return entry.state[key];
  if (entry.entity?.[key] !== undefined) return entry.entity[key];
  return undefined;
}

function hookValueMatches(actual, expected) {
  if (Array.isArray(expected)) return expected.some((item) => hookValueMatches(actual, item));
  if (expected instanceof RegExp) return expected.test(String(actual ?? ''));
  if (typeof expected === 'function') return Boolean(expected(actual));
  if (isObject(expected)) return isObject(actual) && hookObjectMatches(expected, actual);
  if (actual === expected) return true;
  if (actual == null || expected == null) return false;
  return String(actual) === String(expected);
}

function hookObjectMatches(match, entry) {
  for (let [key, expected] of Object.entries(match || {})) {
    if (key === 'constraints') {
      if (!hookObjectMatches(expected, entry)) return false;
      continue;
    }
    if (!hookValueMatches(entryCandidateValue(entry, key), expected)) return false;
  }
  return true;
}

export function matchesWebMcpHookTrigger(trigger, entry) {
  if (typeof trigger === 'string') return entry?.type === trigger;
  if (typeof trigger === 'function') return Boolean(trigger(entry));
  if (isObject(trigger)) return hookObjectMatches(trigger, entry);
  return false;
}

function resolveHookEntry(rule, entry) {
  if (typeof rule.enrichEntry !== 'function') return entry;
  let enriched = rule.enrichEntry(entry, rule.hook);
  if (enriched === false || enriched === null) return null;
  if (enriched === undefined) return entry;
  return isObject(enriched) ? { ...entry, ...enriched } : entry;
}

function matchesHookRule(rule, entry) {
  let resolvedEntry = resolveHookEntry(rule, entry);
  if (!resolvedEntry) return null;
  let { match } = rule;
  return matchesWebMcpHookTrigger(match, resolvedEntry) ? resolvedEntry : null;
}

function getPathValue(source, path) {
  let parts = String(path || '').split('.').filter(Boolean);
  let current = source;
  for (let part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function resolveHookTemplate(value, context) {
  if (typeof value === 'string') {
    if (value.startsWith('$entry.')) return getPathValue(context.entry, value.slice('$entry.'.length));
    if (value.startsWith('$hook.')) return getPathValue(context.hook, value.slice('$hook.'.length));
    if (value.startsWith('$action.')) return getPathValue(context.action, value.slice('$action.'.length));
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => resolveHookTemplate(item, context));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, resolveHookTemplate(item, context)])
        .filter(([, item]) => item !== undefined),
    );
  }
  return value;
}

function hookActionRef(hook = {}, options = {}) {
  return String(
    options.actionRef
      || hook.metadata?.actionRef
      || hook.metadata?.action
      || hook.actionRefs?.[0]
      || '',
  ).trim();
}

export function createWebMcpHookActionPlan(entry = {}, hook = {}, options = {}) {
  let actions = Array.isArray(options.actions) ? options.actions : [];
  let actionRef = hookActionRef(hook, options);
  if (!actionRef) return { command: null, action: null, actionRef: '', input: null };
  let action = actionByToolName(actions, actionRef) || null;
  let tool = action?.name || action?.id || actionRef;
  let input = typeof options.resolveActionInput === 'function'
    ? options.resolveActionInput(entry, hook, action)
    : undefined;
  if (input === undefined) {
    let template = options.actionInput || hook.metadata?.actionInput || hook.metadata?.input || {};
    input = resolveHookTemplate(template, { entry, hook, action });
  }
  if (input === false || input === null) return { command: null, action, actionRef, input: null };
  let command = { tool, input: isObject(input) ? input : {} };
  return {
    command,
    action,
    actionRef,
    input: command.input,
    confirmationRequired: Boolean(
      hook.metadata?.confirmationRequired
      || action?.metadata?.confirmationRequired
      || action?.metadata?.permission === 'operator-confirm'
      || action?.annotations?.destructive
    ),
  };
}

export async function runWebMcpHookAction(entry = {}, hook = {}, options = {}) {
  let plan = createWebMcpHookActionPlan(entry, hook, options);
  if (!plan.command) return { planned: false, plan };
  try { options.onPlan?.(plan, entry, hook); } catch {}
  if (typeof options.executeAction === 'function') {
    let result = await options.executeAction(plan.command, { plan, entry, hook });
    return { planned: true, plan, result };
  }
  if (options.consumer && typeof options.consumer.run === 'function') {
    let result = await options.consumer.run(plan.command.tool, plan.command.input, { signal: options.signal });
    return { planned: true, plan, result };
  }
  return { planned: true, plan, result: null };
}

export function createWebMcpHooks({ observer } = {}) {
  let rules = new Map();
  let nextKey = 0;

  function evaluate(entry = {}) {
    for (let rule of [...rules.values()]) {
      let resolvedEntry = matchesHookRule(rule, entry);
      if (!resolvedEntry) continue;
      let seq = Number.isFinite(Number(resolvedEntry.seq)) ? Number(resolvedEntry.seq) : 0;
      if (rule.cooldown > 0 && rule.lastFiredSeq !== null && seq > 0) {
        if (seq - rule.lastFiredSeq < rule.cooldown) continue;
      }
      rule.lastFiredSeq = seq;
      try {
        rule.trigger?.(resolvedEntry, rule.hook);
      } catch {
        // Hooks are advisory; one failed trigger cannot break the event stream.
      }
      if (rule.once) rules.delete(rule.key);
    }
  }

  let unsubscribe = typeof observer?.subscribe === 'function'
    ? observer.subscribe((entry) => {
      try {
        evaluate(entry);
      } catch {
        // Observer subscriptions must not throw into the host UI.
      }
    })
    : null;

  function register({ id, match, trigger, once = false, cooldown = 0, hook, enrichEntry } = {}) {
    let key = id !== undefined ? `id:${id}` : `auto:${++nextKey}`;
    let rule = { key, id, match, trigger, once, cooldown, hook, enrichEntry, lastFiredSeq: null };
    rules.set(key, rule);
    return () => rules.delete(key);
  }

  function registerRuntimeHooks(hooks = [], options = {}) {
    let normalizedHooks = (Array.isArray(hooks) ? hooks : [])
      .map(normalizeRuntimeHook)
      .filter((hook) => hook.id && hook.trigger);
    return normalizedHooks.map((hook) => {
      let trigger = typeof options.resolveTrigger === 'function'
        ? (entry) => options.resolveTrigger(hook, entry)?.(entry, hook)
        : options.trigger;
      return register({
        id: hook.id,
        match: hook.trigger,
        hook,
        trigger,
        enrichEntry: options.enrichEntry,
        once: Boolean(hook.trigger?.once || hook.metadata?.once || options.once),
        cooldown: Number.isFinite(Number(hook.trigger?.cooldown))
          ? Number(hook.trigger.cooldown)
          : (Number.isFinite(Number(hook.metadata?.cooldown)) ? Number(hook.metadata.cooldown) : Number(options.cooldown || 0)),
      });
    });
  }

  function clear() {
    rules.clear();
  }

  function dispose() {
    clear();
    unsubscribe?.();
  }

  return { register, registerRuntimeHooks, clear, evaluate, dispose };
}

export async function registerProductContextTools(productContext, targetOrOptions = globalThis.document, runtimeInput) {
  let options = resolveProductContextToolOptions(targetOrOptions, runtimeInput);
  let {
    context,
    agentView,
    contextView,
    runtime,
    descriptors,
  } = createProductWebMcpBundle(productContext, options);
  let registrations = [];
  for (let descriptor of descriptors) {
    registrations.push(await registerWebMcpTool(descriptor, options.target));
  }
  let publication = options.publishContext
    ? publishProductRuntimeContext(contextView, options.target)
    : { published: false, nativeActive: false, method: '', payload: null, unregister: () => {} };
  let producer = {
    nativeActive: registrations.some((registration) => registration.nativeActive),
    context,
    agentView,
    contextView,
    runtime: contextView.runtime,
    publication,
    descriptors,
    registrations,
    refresh(nextRuntime = options.runtime, refreshOptions = {}) {
      let refreshed = createProductWebMcpBundle(context, {
        ...options,
        ...refreshOptions,
        runtime: nextRuntime,
        publishContext: false,
      });
      contextView = refreshed.contextView;
      producer.contextView = contextView;
      producer.runtime = contextView.runtime;
      if (options.publishContext !== false && refreshOptions.publishContext !== false) {
        publication.unregister?.();
        publication = publishProductRuntimeContext(contextView, refreshOptions.target || options.target);
        producer.publication = publication;
      }
      return producer;
    },
    unregister() {
      for (let registration of registrations) registration.unregister?.();
      publication.unregister?.();
    },
  };
  return producer;
}
