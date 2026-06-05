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
      componentRole: component?.agent?.semanticRole,
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

