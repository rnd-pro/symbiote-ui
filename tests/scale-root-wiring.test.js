import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { DEFAULT_PROVIDER_THEME } from '../themes/default-provider.js';
import {
  geometrySpacePrimitives,
  typeScaleTokens,
  radiusScaleTokens,
  snapFontSizeToToken,
  snapRadiusToToken,
} from '../tokens/scale.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRODUCT = { ...geometrySpacePrimitives('product'), ...typeScaleTokens(), ...radiusScaleTokens() };

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

test('type scale codifies the de-facto sizes and snaps font-size to a rung', () => {
  let tokens = typeScaleTokens();
  assert.equal(tokens['--sn-text-md'], '13px');
  assert.equal(tokens['--sn-text-xs'], '11px');
  assert.equal(tokens['--sn-text-2xl'], '18px');
  // exact rung
  assert.deepEqual(
    { token: snapFontSizeToToken('11px').token, exact: snapFontSizeToToken('11px').exact },
    { token: 'var(--sn-text-xs)', exact: true },
  );
  // off-scale snaps to nearest, flagged inexact (15 -> 14 lg)
  let near = snapFontSizeToToken('15px');
  assert.equal(near.token, 'var(--sn-text-lg)');
  assert.equal(near.exact, false);
});

test('radius scale snaps corner radii, with a pill case for large values', () => {
  let tokens = radiusScaleTokens();
  assert.equal(tokens['--sn-radius-md'], '6px');
  assert.equal(tokens['--sn-radius-full'], '9999px');
  assert.equal(snapRadiusToToken('6px').token, 'var(--sn-radius-md)');
  assert.equal(snapRadiusToToken('6px').exact, true);
  // off-scale snaps to nearest rung (7 -> 6 md or 8 lg; nearest is md by <0.5 rule false)
  assert.equal(snapRadiusToToken('10px').token, 'var(--sn-radius-lg)'); // nearest to 8 vs 12
  // pill
  assert.equal(snapRadiusToToken('999px').token, 'var(--sn-radius-full)');
});

test('seeding primitives does not redefine derived geometry tokens', () => {
  // The migration is additive: node-radius/grid/etc keep their own values and
  // are not re-pointed at the scale yet, so nothing currently rendered changes.
  let tokens = DEFAULT_PROVIDER_THEME.tokens;
  assert.equal(tokens['--sn-node-radius'], 'calc(6px * var(--sn-theme-radius-scale))');
  assert.equal(tokens['--sn-grid-size'], '20px');
});
