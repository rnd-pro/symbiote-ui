import assert from 'node:assert/strict';
import { test } from 'node:test';

test('root and metadata entrypoints import in Node', async () => {
  let root = await import('../index.js');
  let manifest = await import('../manifest/index.js');
  let webmcp = await import('../webmcp.js');

  assert.equal(typeof root.NodeEditor, 'function');
  assert.equal(typeof manifest.listComponents, 'function');
  assert.equal(typeof webmcp.createToolDescriptor, 'function');
});

test('discover exposes the standalone package contract', async () => {
  let { cmdDiscover } = await import('../discover.js');
  let data = await cmdDiscover({});
  let entrypoints = new Map(data.exports.entrypoints.map((entry) => [entry.specifier, entry]));

  assert.equal(data.package.name, 'symbiote-ui');
  assert.equal(entrypoints.get('symbiote-ui')?.kind, 'node-safe');
  assert.equal(entrypoints.get('symbiote-ui/webmcp')?.kind, 'ssr-entry-safe');
});
