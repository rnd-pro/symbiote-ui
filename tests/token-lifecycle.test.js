import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  geometryAtPropertyRegistrations,
  geometryAtPropertyCss,
} from '../tokens/scale.js';
import {
  diffTokenCatalogs,
  flattenTokens,
  formatTokenChangelog,
} from '../tokens/token-lifecycle.js';

test('@property registrations cover concrete primitives and inherit', () => {
  let regs = geometryAtPropertyRegistrations('product');
  let names = regs.map((r) => r.name);
  assert.ok(names.includes('--sn-space-md'));
  assert.ok(names.includes('--sn-conn-width'));
  assert.ok(names.includes('--sn-font-size'));
  // derived aliases (var()-valued) are intentionally not registered
  assert.equal(names.includes('--sn-node-radius'), false);

  let spaceMd = regs.find((r) => r.name === '--sn-space-md');
  assert.equal(spaceMd.syntax, '<length>');
  assert.equal(spaceMd.inherits, true);
  assert.equal(spaceMd.initialValue, '12px');

  let conn = regs.find((r) => r.name === '--sn-conn-width');
  assert.equal(conn.syntax, '<number>');

  // dense profile changes the initial-values
  let dense = geometryAtPropertyRegistrations('tool').find((r) => r.name === '--sn-space-md');
  assert.equal(dense.initialValue, '8px');
});

test('geometryAtPropertyCss emits valid @property blocks', () => {
  let css = geometryAtPropertyCss('product');
  assert.match(css, /@property --sn-space-md \{/);
  assert.match(css, /syntax: '<length>';/);
  assert.match(css, /inherits: true;/);
  assert.match(css, /initial-value: 12px;/);
});

test('flattenTokens reads the canonical scale catalog identity', async () => {
  let { readFileSync } = await import('node:fs');
  let { resolve, dirname } = await import('node:path');
  let { fileURLToPath } = await import('node:url');
  let here = dirname(fileURLToPath(import.meta.url));
  let catalog = JSON.parse(readFileSync(resolve(here, '../tokens/scale.json'), 'utf-8'));
  let tokens = flattenTokens(catalog);
  let spaceMd = tokens.find((t) => t.name === '--sn-space-md');
  assert.equal(spaceMd.uuid, 'geo-space-md');
  assert.equal(spaceMd.value, '12px');
  assert.equal(spaceMd.type, 'dimension');
});

const OLD = {
  space: {
    $type: 'dimension',
    sm: { $value: { value: 8, unit: 'px' }, $extensions: { sn: { token: '--sn-space-sm', uuid: 'u-sm' } } },
    md: { $value: { value: 12, unit: 'px' }, $extensions: { sn: { token: '--sn-space-md', uuid: 'u-md' } } },
    lg: { $value: { value: 16, unit: 'px' }, $extensions: { sn: { token: '--sn-space-lg', uuid: 'u-lg' } } },
  },
};

const NEW = {
  space: {
    $type: 'dimension',
    sm: { $value: { value: 8, unit: 'px' }, $extensions: { sn: { token: '--sn-gap-sm', uuid: 'u-sm' } } }, // renamed
    md: { $value: { value: 14, unit: 'px' }, $deprecated: true, $extensions: { sn: { token: '--sn-space-md', uuid: 'u-md' } } }, // updated + deprecated
    xl: { $value: { value: 24, unit: 'px' }, $extensions: { sn: { token: '--sn-space-xl', uuid: 'u-xl' } } }, // added (lg deleted)
  },
};

test('diffTokenCatalogs classifies rename / update / deprecate / add / delete', () => {
  let diff = diffTokenCatalogs(OLD, NEW);
  assert.deepEqual(diff.renamed, [{ uuid: 'u-sm', from: '--sn-space-sm', to: '--sn-gap-sm' }]);
  assert.deepEqual(diff.updated, [{ name: '--sn-space-md', from: '12px', to: '14px' }]);
  assert.deepEqual(diff.deprecated, [{ name: '--sn-space-md' }]);
  assert.deepEqual(diff.added, [{ name: '--sn-space-xl', value: '24px' }]);
  assert.deepEqual(diff.deleted, [{ name: '--sn-space-lg', value: '16px' }]);
  assert.equal(diff.breaking, true); // a delete occurred
});

test('a type change is breaking and a same-shape diff is not', () => {
  let typed = diffTokenCatalogs(OLD, {
    space: {
      $type: 'number',
      sm: { $value: { value: 8, unit: 'px' }, $extensions: { sn: { token: '--sn-space-sm', uuid: 'u-sm' } } },
      md: { $value: { value: 12, unit: 'px' }, $extensions: { sn: { token: '--sn-space-md', uuid: 'u-md' } } },
      lg: { $value: { value: 16, unit: 'px' }, $extensions: { sn: { token: '--sn-space-lg', uuid: 'u-lg' } } },
    },
  });
  assert.equal(typed.breaking, true);
  assert.equal(typed.typeChanges.length, 3);

  let identical = diffTokenCatalogs(OLD, OLD);
  assert.equal(identical.breaking, false);
  assert.equal(identical.added.length + identical.deleted.length + identical.updated.length, 0);
});

test('formatTokenChangelog renders a deterministic Markdown report', () => {
  let md = formatTokenChangelog(diffTokenCatalogs(OLD, NEW));
  assert.match(md, /\*\*BREAKING\*\*/);
  assert.match(md, /## Renamed/);
  assert.match(md, /`--sn-space-sm` → `--sn-gap-sm`/);
  assert.match(md, /## Deleted \(breaking\)/);
});
