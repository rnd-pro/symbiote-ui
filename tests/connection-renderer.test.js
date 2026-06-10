import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { ConnectionRenderer } from '../canvas/ConnectionRenderer.js';

function createNodeElement({ shape = 'disc', ports = { out: {} } } = {}) {
  return {
    _cachedW: 100,
    _cachedH: 100,
    _nodeData: { outputs: ports, inputs: ports },
    _position: { x: 0, y: 0 },
    getAttribute(name) {
      return name === 'node-shape' ? shape : '';
    },
  };
}

test('dynamic SVG edge connector exits a single round node toward the target', () => {
  let renderer = new ConnectionRenderer({
    svgLayer: null,
    nodeViews: new Map(),
    editor: null,
    onConnectionClick: () => {},
    getZoom: () => 1,
  });
  let nodeEl = createNodeElement();

  let offset = renderer.getSocketOffset(nodeEl, 'out', 'output', { x: 200, y: 50 });

  assert.equal(Math.round(offset.x), 100);
  assert.equal(Math.round(offset.y), 50);
  assert.equal(Math.round(offset.angle), 0);
});

test('canvas connection renderer keeps single dynamic SVG ports free of side-gap offsets', async () => {
  let source = await readFile(new URL('../canvas/CanvasConnectionRenderer.js', import.meta.url), 'utf8');

  assert.match(source, /let angle = baseAngle;/);
  assert.match(source, /if \(total > 1\) \{\s*let sideGap = Math\.PI \/ 6;/s);
  assert.doesNotMatch(source, /let angle = baseAngle \+ \(side === 'output' \? -sideGap : sideGap\);/);
});
