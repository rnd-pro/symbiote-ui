import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateComponent, validateTokenUsage } from '../discover.js';

const BAD = [
  'sn-widget {',
  '  padding: 13px;',
  '  border-radius: 5px;',
  '  transition: all 200ms ease;',
  '}',
].join('\n');

const GOOD = [
  'sn-widget {',
  '  padding: var(--sn-space-md);',
  '  border-radius: var(--sn-node-radius);',
  '  transition: var(--sn-transition-fast) ease;',
  '}',
].join('\n');

test('validateComponent passes clean component CSS', () => {
  let result = validateComponent({ css: GOOD, file: 'good.css.js', profile: 'product' });
  assert.equal(result.command, 'validate-component');
  assert.equal(result.valid, true);
  assert.equal(result.summary.warnings, 0);
});

test('validateComponent surfaces geometry + motion findings with snap suggestions', () => {
  let result = validateComponent({ css: BAD, file: 'bad.css.js', profile: 'product' });
  // findings are warnings (not errors) so valid stays true unless contrast fails
  assert.equal(result.summary.warnings >= 3, true);
  let geometry = result.findings.filter((f) => f.type === 'geometry-lint');
  assert.ok(geometry.some((f) => f.suggestion === 'var(--sn-space-md)'));
  assert.ok(result.findings.some((f) => f.type === 'motion-lint'));
});

test('validateComponent fails on a resolved sub-AA contrast pair', () => {
  let result = validateComponent({
    css: GOOD,
    contrastPairs: [['#777777', '#888888'], ['#000000', '#ffffff', { largeText: false }]],
  });
  assert.equal(result.summary.contrastChecked, 2);
  assert.equal(result.summary.contrastFailures, 1);
  assert.equal(result.valid, false);
});

test('validateTokenUsage returns the literal -> token fix map', () => {
  let fixes = validateTokenUsage({ css: BAD, profile: 'product' });
  assert.ok(fixes.length >= 3);
  let padding = fixes.find((f) => f.property === 'padding');
  assert.equal(padding.suggestion, 'var(--sn-space-md)');
  assert.ok(fixes.some((f) => f.property === 'transition'));
});
