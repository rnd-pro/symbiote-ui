import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getModelContext, registerWebMcpTool } from '../webmcp.js';

test('getModelContext ignores the deprecated navigator surface', () => {
  let previous = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { modelContext: { registerTool() {} } } });
  try {
    assert.equal(getModelContext({}), null);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'navigator', previous);
    else delete globalThis.navigator;
  }
});

test('registerWebMcpTool forwards AbortSignal lifecycle options to the native surface', async () => {
  let controller = new AbortController();
  let seenDescriptor;
  let seenOptions;
  let unregisterCalls = 0;
  let target = {
    modelContext: {
      async registerTool(descriptor, options) {
        seenDescriptor = descriptor;
        seenOptions = options;
        let unregister = () => {
          unregisterCalls += 1;
        };
        options.signal.addEventListener('abort', unregister, { once: true });
        return unregister;
      },
    },
  };

  let registration = await registerWebMcpTool({
    name: 'inspect_record',
    description: 'Inspect the selected record',
    inputSchema: { type: 'object' },
    execute() {},
  }, target, { signal: controller.signal, exposedTo: ['https://agent.example'] });

  assert.equal(seenDescriptor.name, 'inspect_record');
  assert.equal(seenOptions.signal, controller.signal);
  assert.deepEqual(seenOptions.exposedTo, ['https://agent.example']);
  assert.equal(registration.nativeActive, false);
  controller.abort();
  assert.equal(unregisterCalls, 1);
});
