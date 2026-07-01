import {
  createProductContextAgentView,
  createProductRuntimeContext,
  normalizeProductContext,
  normalizeRuntimeContext,
} from './runtime/product-context.js';

export const PRODUCT_RUNTIME_CONTEXT_NAME = 'symbiote.productRuntimeContext';

export {
  createProductRuntimeContext,
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

export async function registerProductContextTools(productContext, targetOrOptions = globalThis.document, runtimeInput) {
  let options = resolveProductContextToolOptions(targetOrOptions, runtimeInput);
  let context = normalizeProductContext(productContext);
  let runtime = options.runtime === undefined && isObject(productContext) ? productContext.runtime : options.runtime;
  let contextView = createProductRuntimeContext(context, runtime);
  let agentView = createProductContextAgentView(context);
  let descriptors = createProductContextToolDescriptors(context);
  let registrations = [];
  for (let descriptor of descriptors) {
    registrations.push(await registerWebMcpTool(descriptor, options.target));
  }
  let publication = options.publishContext
    ? publishProductRuntimeContext(contextView, options.target)
    : { published: false, nativeActive: false, method: '', payload: null, unregister: () => {} };
  return {
    nativeActive: registrations.some((registration) => registration.nativeActive),
    context,
    agentView,
    contextView,
    runtime: contextView.runtime,
    publication,
    descriptors,
    registrations,
    unregister() {
      for (let registration of registrations) registration.unregister?.();
      publication.unregister?.();
    },
  };
}
