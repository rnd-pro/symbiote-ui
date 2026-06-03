export function getModelContext(target = globalThis.document) {
  return target?.modelContext || globalThis.navigator?.modelContext || null;
}

export function createToolDescriptor(options) {
  return { ...options };
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
