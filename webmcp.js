import {
  createProductContextAgentView,
  normalizeProductContext,
} from './runtime/product-context.js';

export function getModelContext(target = globalThis.document) {
  return target?.modelContext || globalThis.navigator?.modelContext || null;
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
  let unregister = typeof registration === 'function'
    ? registration
    : () => registration?.dispose?.() || registration?.unregister?.();

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

export async function registerProductContextTools(productContext, target = globalThis.document) {
  let context = normalizeProductContext(productContext);
  let agentView = createProductContextAgentView(context);
  let descriptors = createProductContextToolDescriptors(context);
  let registrations = [];
  for (let descriptor of descriptors) {
    registrations.push(await registerWebMcpTool(descriptor, target));
  }
  return {
    nativeActive: registrations.some((registration) => registration.nativeActive),
    context,
    agentView,
    descriptors,
    registrations,
    unregister() {
      for (let registration of registrations) registration.unregister?.();
    },
  };
}
