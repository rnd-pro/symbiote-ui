import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

let docsBaseUrl = new URL('../skills/symbiote-ui/', import.meta.url);

let docFiles = {
  skill: new URL('SKILL.md', docsBaseUrl),
  dynamicRegistry: new URL('references/dynamic-registry.md', docsBaseUrl),
  runtimeApi: new URL('references/runtime-api.md', docsBaseUrl),
  intentOrchestrator: new URL('references/intent-orchestrator.md', docsBaseUrl),
  integrationContracts: new URL('../docs/integration-contracts.md', import.meta.url),
};
let cat04DocKeys = ['skill', 'dynamicRegistry', 'runtimeApi', 'intentOrchestrator'];

test('documentation contract for dynamic registry and intent orchestrator', async () => {
  let docContents = {};
  for (let [key, url] of Object.entries(docFiles)) {
    try {
      let content = await readFile(url, 'utf8');
      docContents[key] = content.replace(/\s+/g, ' ').trim();
    } catch (err) {
      assert.fail(`Failed to read documentation file for ${key} at ${url}: ${err.message}`);
    }
  }

  let falsePhrases = [
    'code sandboxing',
    'code string (sandboxed)',
    'default sandbox',
    'the sandbox will reject',
  ];

  for (let key of cat04DocKeys) {
    let content = docContents[key];
    for (let phrase of falsePhrases) {
      let containsPhrase = content.toLowerCase().includes(phrase);
      assert.equal(
        containsPhrase,
        false,
        `Document "${key}" must not contain false dynamic-registry phrase: "${phrase}"`
      );
    }
  }

  let sandboxDenialPattern = /no iframe, worker, separate realm, capability isolation, or sandbox/i;
  assert.ok(
    sandboxDenialPattern.test(docContents.skill),
    'SKILL.md must explicitly deny capability isolation and sandbox'
  );
  assert.ok(
    sandboxDenialPattern.test(docContents.dynamicRegistry),
    'references/dynamic-registry.md must explicitly deny capability isolation and sandbox'
  );

  assert.ok(
    docContents.dynamicRegistry.includes('trusted local/host-authored input') &&
    docContents.dynamicRegistry.includes('remote/community code is forbidden'),
    'references/dynamic-registry.md must explicitly state trusted input and forbidden remote/community code requirements'
  );

  assert.ok(
    docContents.dynamicRegistry.includes('same-page-realm loading') ||
    docContents.dynamicRegistry.includes('current page realm'),
    'references/dynamic-registry.md must explicitly state same-page-realm loading'
  );

  assert.ok(
    docContents.dynamicRegistry.includes('lexical validation') &&
    docContents.dynamicRegistry.includes('validateComponentCode()'),
    'references/dynamic-registry.md must explicitly state lexical validation'
  );

  assert.ok(
    docContents.dynamicRegistry.includes('extends defaults') ||
    docContents.dynamicRegistry.includes('extends default deny-list') ||
    docContents.dynamicRegistry.includes('does not replace them'),
    'references/dynamic-registry.md must explicitly state that additional blockedKeywords extend default list'
  );

  assert.match(
    docContents.intentOrchestrator,
    /allowIrreversible/,
    'references/intent-orchestrator.md must require host approval'
  );
  assert.match(
    docContents.intentOrchestrator,
    /dedicated single-operation intent/,
    'references/intent-orchestrator.md must require a dedicated irreversible intent'
  );
  assert.match(
    docContents.intentOrchestrator,
    /not rolled back|no rollback action/,
    'references/intent-orchestrator.md must describe the irreversible rollback boundary'
  );

  assert.match(
    docContents.runtimeApi,
    /Apply lexical validation to trusted source/,
    'references/runtime-api.md must describe validateComponentCode as lexical validation'
  );
  assert.match(
    docContents.dynamicRegistry,
    /does not establish a security boundary/,
    'references/dynamic-registry.md must deny a security boundary'
  );
  assert.match(
    docContents.dynamicRegistry,
    /case-sensitive substring deny-list/,
    'references/dynamic-registry.md must describe the exact lexical match behavior'
  );
  assert.match(
    docContents.dynamicRegistry,
    /class-constructor input bypasses string validation/,
    'references/dynamic-registry.md must document the constructor validation bypass'
  );
  assert.match(
    docContents.dynamicRegistry,
    /Direct registry calls have no host-approval gate/,
    'references/dynamic-registry.md must document the direct-call approval boundary'
  );
  assert.match(
    docContents.skill,
    /allowIrreversible[\s\S]*dedicated single-operation intent[\s\S]*cannot be rolled back/,
    'SKILL.md must describe the host-approved dedicated irreversible route'
  );
  assert.match(
    docContents.integrationContracts,
    /privacy-hardened `youtube`.{0,120}sandboxed/i,
    'legitimate iframe sandbox documentation must remain intact'
  );

  assert.match(
    docContents.skill,
    /best-effort rollback/,
    'SKILL.md must describe rollback as best-effort'
  );
  assert.match(
    docContents.intentOrchestrator,
    /Rollback errors are logged and suppressed/,
    'references/intent-orchestrator.md must describe rollback failure handling'
  );
  assert.match(
    docContents.runtimeApi,
    /If neither is set, method calls are skipped/,
    'references/runtime-api.md must document the default-deny method gate'
  );
  assert.match(
    docContents.intentOrchestrator,
    /successful irreversible no-op and increments `executedCount`/,
    'references/intent-orchestrator.md must document the missing driver callback behavior'
  );

  let sourceExample = 'export default class DynamicWidget extends HTMLElement {}';
  assert.ok(docContents.skill.includes(sourceExample));
  assert.ok(docContents.intentOrchestrator.includes(sourceExample));

  let originalHTMLElement = globalThis.HTMLElement;
  globalThis.HTMLElement = class {};
  try {
    let sourceUrl = `data:text/javascript,${encodeURIComponent(sourceExample)}`;
    let sourceModule = await import(sourceUrl);
    assert.equal(typeof sourceModule.default, 'function');
  } finally {
    if (originalHTMLElement === undefined) {
      delete globalThis.HTMLElement;
    } else {
      globalThis.HTMLElement = originalHTMLElement;
    }
  }
});
