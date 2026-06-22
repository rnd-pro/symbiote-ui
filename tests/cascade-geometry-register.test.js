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

test('geometrySpacePrimitives returns only the --sn-space-* rungs per register', () => {
  let product = geometrySpacePrimitives('product');
  assert.deepEqual(Object.keys(product), ['--sn-space-xs', '--sn-space-sm', '--sn-space-md', '--sn-space-lg', '--sn-space-xl']);
  assert.equal(product['--sn-space-md'], '12px');
  // dense register shifts the same rung
  assert.equal(geometrySpacePrimitives('tool')['--sn-space-md'], '8px');
  assert.equal(geometrySpacePrimitives('spacious')['--sn-space-md'], '14px');
  // no derived tokens leak in (composes with cascade density/radius sliders)
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
