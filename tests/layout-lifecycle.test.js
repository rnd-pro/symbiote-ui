import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';

test('layout lifecycle helpers suspend and resume reusable and host-owned subtree elements once', async () => {
  let { suspendLayoutSubtree, resumeLayoutSubtree } = await import('../layout/index.js');
  let { document } = parseHTML(`
    <section id="workspace">
      <agent-chat>
        <chat-workspace>
          <chat-composer></chat-composer>
          <cell-bg></cell-bg>
        </chat-workspace>
      </agent-chat>
    </section>
  `);
  let root = document.getElementById('workspace');
  let calls = [];
  for (let element of root.querySelectorAll('agent-chat, chat-workspace, chat-composer, cell-bg')) {
    element.suspendLayout = (context) => calls.push(['suspend', element.localName, context.reason]);
    element.resumeLayout = (context) => calls.push(['resume', element.localName, context.reason]);
  }

  assert.equal(suspendLayoutSubtree(root, { reason: 'workspace-inactive' }), 4);
  assert.deepEqual(calls, [
    ['suspend', 'agent-chat', 'workspace-inactive'],
    ['suspend', 'chat-workspace', 'workspace-inactive'],
    ['suspend', 'chat-composer', 'workspace-inactive'],
    ['suspend', 'cell-bg', 'workspace-inactive'],
  ]);
  for (let element of root.querySelectorAll('agent-chat, chat-workspace, chat-composer, cell-bg')) {
    assert.equal(element.hasAttribute('data-layout-suspended'), true);
  }

  calls = [];
  assert.equal(resumeLayoutSubtree(root, { reason: 'workspace-active' }), 4);
  assert.deepEqual(calls, [
    ['resume', 'agent-chat', 'workspace-active'],
    ['resume', 'chat-workspace', 'workspace-active'],
    ['resume', 'chat-composer', 'workspace-active'],
    ['resume', 'cell-bg', 'workspace-active'],
  ]);
  for (let element of root.querySelectorAll('agent-chat, chat-workspace, chat-composer, cell-bg')) {
    assert.equal(element.hasAttribute('data-layout-suspended'), false);
  }
});
