import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { geometrySpacePrimitives, GEOMETRY_PROFILE_NAMES } from '../tokens/scale.js';

const editorSource = new URL('../themes/CascadeThemeEditor/CascadeThemeEditor.js', import.meta.url);
const editorTemplate = new URL('../themes/CascadeThemeEditor/CascadeThemeEditor.tpl.js', import.meta.url);
const widgetSource = new URL('../themes/CascadeThemeWidget/CascadeThemeWidget.js', import.meta.url);
const widgetTemplate = new URL('../themes/CascadeThemeWidget/CascadeThemeWidget.tpl.js', import.meta.url);

test('geometrySpacePrimitives emits the step ladder plus --sn-space-* aliases per register', () => {
  let product = geometrySpacePrimitives('product');
  // step ladder primitives carry the px; product is the airy default
  assert.equal(product['--sn-step-6'], '12px');
  assert.equal(product['--sn-step-3'], '6px');
  // legacy t-shirt names are permanent var() aliases onto even step rungs
  assert.equal(product['--sn-space-md'], 'var(--sn-step-6)');
  // the same rung index re-resolves denser/airier per register (base × density)
  assert.equal(geometrySpacePrimitives('tool')['--sn-step-6'], '9px');
  assert.equal(geometrySpacePrimitives('spacious')['--sn-step-6'], '15px');
  // derived geometry (node-radius) is not seeded here
  assert.equal('--sn-node-radius' in product, false);
});

test('the cascade theme editor exposes a geometry register toggle', async () => {
  let [source, template] = await Promise.all([
    readFile(editorSource, 'utf8'),
    readFile(editorTemplate, 'utf8'),
  ]);

  // template offers Default + every canonical register
  assert.match(template, /data-geometry-register=""/);
  for (let register of GEOMETRY_PROFILE_NAMES) {
    assert.match(template, new RegExp(`data-geometry-register="${register}"`));
  }

  // component wires the toggle to the scale and applies it to the target
  assert.match(source, /geometrySpacePrimitives/);
  assert.match(source, /\[data-geometry-register\]/);
  assert.match(source, /#applyGeometryRegister/);
  assert.match(source, /cascade-geometry-register-change/);
  assert.match(source, /get geometryRegister\(\)/);
});

test('the cascade theme widget exposes the same geometry register toggle', async () => {
  let [source, template] = await Promise.all([
    readFile(widgetSource, 'utf8'),
    readFile(widgetTemplate, 'utf8'),
  ]);

  assert.match(template, /data-geometry-register=""/);
  for (let register of GEOMETRY_PROFILE_NAMES) {
    assert.match(template, new RegExp(`data-geometry-register="${register}"`));
  }
  assert.match(source, /geometrySpacePrimitives/);
  assert.match(source, /#applyGeometryRegister/);
  assert.match(source, /#syncRegisterButtons/);
});
