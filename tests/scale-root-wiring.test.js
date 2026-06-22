import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { DEFAULT_PROVIDER_THEME } from '../themes/default-provider.js';
import { geometrySpacePrimitives } from '../tokens/scale.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCT = geometrySpacePrimitives('product');

test('default-provider token object seeds the canonical scale primitives', () => {
  let tokens = DEFAULT_PROVIDER_THEME.tokens;
  for (let [name, value] of Object.entries(PRODUCT)) {
    assert.equal(tokens[name], value, `${name} missing/incorrect in default-provider token object`);
  }
});

test('default-provider.css root mirrors the scale primitives (no drift)', () => {
  let css = readFileSync(resolve(__dirname, '../themes/default-provider.css'), 'utf-8');
  for (let [name, value] of Object.entries(PRODUCT)) {
    assert.match(css, new RegExp(`${name}:\\s*${value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')};`),
      `${name}: ${value} missing from default-provider.css :root`);
  }
});

test('seeding primitives does not redefine derived geometry tokens', () => {
  // The migration is additive: node-radius/grid/etc keep their own values and
  // are not re-pointed at the scale yet, so nothing currently rendered changes.
  let tokens = DEFAULT_PROVIDER_THEME.tokens;
  assert.equal(tokens['--sn-node-radius'], 'calc(6px * var(--sn-theme-radius-scale))');
  assert.equal(tokens['--sn-grid-size'], '20px');
});
