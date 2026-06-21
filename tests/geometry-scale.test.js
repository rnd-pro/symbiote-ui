import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { MODERN_SKIN, COMPACT_SKIN, ROUNDED_SKIN } from '../themes/Skin.js';
import {
  GEOMETRY_PROFILES,
  GEOMETRY_PROFILE_NAMES,
  SPACE_RUNGS,
  buildSkinGeometry,
  geometryAxisForProperty,
  getGeometryScaleDescriptor,
  isGeometryToken,
  listGeometryTokens,
  snapValueToToken,
} from '../tokens/scale.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Frozen snapshot of the skin geometry maps before the canonical-scale refactor.
// Guards against any drift when skins are generated from tokens/scale.js.
const EXPECTED_MODERN = {
  '--sn-space-xs': '4px',
  '--sn-space-sm': '8px',
  '--sn-space-md': '12px',
  '--sn-space-lg': '16px',
  '--sn-space-xl': '24px',
  '--sn-node-radius': 'var(--sn-space-md)',
  '--sn-comment-radius': 'var(--sn-space-sm)',
  '--sn-socket-size': 'var(--sn-space-md)',
  '--sn-socket-border-width': '2px',
  '--sn-grid-size': 'var(--sn-space-xl)',
  '--sn-conn-width': '2',
  '--sn-font': "'Inter', sans-serif",
  '--sn-font-size': '13px',
  '--sn-shadow-geometry': '0 4px 16px',
  '--sn-node-shadow': 'var(--sn-shadow-geometry) var(--sn-shadow-color, rgba(0, 0, 0, 0.3))',
};
const EXPECTED_COMPACT = {
  '--sn-space-xs': '3px',
  '--sn-space-sm': '5px',
  '--sn-space-md': '8px',
  '--sn-space-lg': '12px',
  '--sn-space-xl': '16px',
  '--sn-node-radius': 'var(--sn-space-md)',
  '--sn-comment-radius': 'var(--sn-space-sm)',
  '--sn-socket-size': 'var(--sn-space-md)',
  '--sn-socket-border-width': '1.5px',
  '--sn-grid-size': 'var(--sn-space-xl)',
  '--sn-conn-width': '1.5',
  '--sn-font': "'Inter', sans-serif",
  '--sn-font-size': '12px',
  '--sn-shadow-geometry': '0 2px 8px',
  '--sn-node-shadow': 'var(--sn-shadow-geometry) var(--sn-shadow-color, rgba(0, 0, 0, 0.2))',
};
const EXPECTED_ROUNDED = {
  '--sn-space-xs': '5px',
  '--sn-space-sm': '10px',
  '--sn-space-md': '14px',
  '--sn-space-lg': '20px',
  '--sn-space-xl': '28px',
  '--sn-node-radius': 'var(--sn-space-lg)',
  '--sn-comment-radius': 'var(--sn-space-md)',
  '--sn-socket-size': 'var(--sn-space-md)',
  '--sn-socket-border-width': '2.5px',
  '--sn-grid-size': 'var(--sn-space-xl)',
  '--sn-conn-width': '2.5',
  '--sn-font': "'Space Grotesk', sans-serif",
  '--sn-font-size': '14px',
  '--sn-shadow-geometry': '0 6px 24px',
  '--sn-node-shadow': 'var(--sn-shadow-geometry) var(--sn-shadow-color, rgba(0, 0, 0, 0.25))',
};

test('skins generated from the canonical scale match the pre-refactor geometry exactly', () => {
  assert.deepEqual(MODERN_SKIN.geometry, EXPECTED_MODERN);
  assert.deepEqual(COMPACT_SKIN.geometry, EXPECTED_COMPACT);
  assert.deepEqual(ROUNDED_SKIN.geometry, EXPECTED_ROUNDED);
  // key order preserved
  assert.deepEqual(Object.keys(MODERN_SKIN.geometry), Object.keys(EXPECTED_MODERN));
});

test('buildSkinGeometry is the single source the skins are derived from', () => {
  assert.deepEqual(buildSkinGeometry('product'), MODERN_SKIN.geometry);
  assert.deepEqual(buildSkinGeometry('tool'), COMPACT_SKIN.geometry);
  assert.deepEqual(buildSkinGeometry('spacious'), ROUNDED_SKIN.geometry);
  // unknown profile falls back to the default (product)
  assert.deepEqual(buildSkinGeometry('nope'), MODERN_SKIN.geometry);
});

test('geometry token membership recognizes the canonical scale and rejects others', () => {
  for (let rung of SPACE_RUNGS) assert.ok(isGeometryToken(`--sn-space-${rung}`));
  assert.ok(isGeometryToken('--sn-node-radius'));
  assert.ok(isGeometryToken('--sn-font-size'));
  assert.equal(isGeometryToken('--sn-bg'), false);
  assert.equal(isGeometryToken('--sn-space-2xl'), false);
  assert.ok(listGeometryTokens().includes('--sn-grid-size'));
});

test('geometryAxisForProperty classifies properties', () => {
  assert.equal(geometryAxisForProperty('padding'), 'space');
  assert.equal(geometryAxisForProperty('margin-inline-start'), 'space');
  assert.equal(geometryAxisForProperty('gap'), 'space');
  assert.equal(geometryAxisForProperty('border-radius'), 'radius');
  assert.equal(geometryAxisForProperty('font-size'), 'font-size');
  assert.equal(geometryAxisForProperty('color'), null);
});

test('snapValueToToken maps raw values to the nearest scale token per profile', () => {
  // exact rung hit (product)
  let exact = snapValueToToken('padding', '12px', 'product');
  assert.equal(exact.token, 'var(--sn-space-md)');
  assert.equal(exact.exact, true);
  // off-scale → nearest rung, flagged inexact
  let near = snapValueToToken('gap', '7px', 'product');
  assert.equal(near.token, 'var(--sn-space-sm)');
  assert.equal(near.exact, false);
  assert.equal(near.nearestPx, 8);
  // same raw value snaps differently under the dense tool profile
  let dense = snapValueToToken('padding', '12px', 'tool');
  assert.equal(dense.token, 'var(--sn-space-lg)');
  assert.equal(dense.exact, true);
  // radius axis also snaps to the spacing rungs
  let radius = snapValueToToken('border-radius', '16px', 'product');
  assert.equal(radius.token, 'var(--sn-space-lg)');
  // font-size axis
  let font = snapValueToToken('font-size', '13px', 'product');
  assert.equal(font.token, 'var(--sn-font-size)');
  assert.equal(font.exact, true);
  // non-geometry property
  assert.equal(snapValueToToken('color', '#fff', 'product'), null);
});

test('tokens/scale.json register values stay in sync with the scale module', () => {
  let catalog = JSON.parse(readFileSync(resolve(__dirname, '../tokens/scale.json'), 'utf-8'));
  for (let rung of SPACE_RUNGS) {
    let entry = catalog.space[rung];
    assert.equal(entry.$type === undefined ? catalog.space.$type : entry.$type ?? catalog.space.$type, 'dimension');
    let registers = entry.$extensions.sn.registers;
    for (let profileName of GEOMETRY_PROFILE_NAMES) {
      assert.equal(
        registers[profileName],
        GEOMETRY_PROFILES[profileName].space[rung],
        `space.${rung} register ${profileName} drifted between scale.json and scale.js`,
      );
    }
  }
  // font-size sync
  let fontRegisters = catalog.font.size.$extensions.sn.registers;
  for (let profileName of GEOMETRY_PROFILE_NAMES) {
    assert.equal(fontRegisters[profileName], GEOMETRY_PROFILES[profileName].fontSize);
  }
});

test('tokens/scale.json uses typed DTCG dimensions for the numbered rungs', () => {
  let catalog = JSON.parse(readFileSync(resolve(__dirname, '../tokens/scale.json'), 'utf-8'));
  assert.equal(catalog.space.$type, 'dimension');
  assert.equal(catalog.space.md.$value.unit, 'px');
  assert.equal(typeof catalog.space.md.$value.value, 'number');
});

test('geometry scale descriptor is agent-readable', () => {
  let descriptor = getGeometryScaleDescriptor();
  assert.equal(descriptor.defaultProfile, 'product');
  assert.deepEqual(descriptor.spaceRungs, ['xs', 'sm', 'md', 'lg', 'xl']);
  assert.equal(descriptor.profiles.length, 3);
  assert.ok(descriptor.axes.space.includes('padding'));
  assert.ok(descriptor.tokens.includes('--sn-space-md'));
});
