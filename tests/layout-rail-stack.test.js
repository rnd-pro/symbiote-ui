import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  createRailStackRegistry,
  layoutRailStack,
  normalizeRailDescriptor,
  resolveRailStackRegions,
  routeRailDescriptor,
} from '../layout/rail-stack.js';

const railStackSource = new URL('../layout/rail-stack.js', import.meta.url);
const layoutSource = new URL('../layout/Layout/Layout.js', import.meta.url);
const layoutStyles = new URL('../layout/Layout/Layout.css.js', import.meta.url);
const layoutTemplate = new URL('../layout/Layout/Layout.tpl.js', import.meta.url);
const dockShellSource = new URL('../chat/AgentDockShell/AgentDockShell.js', import.meta.url);

const HOST_HEIGHT = 512;

test('rail stack splits the host into two equal vertical regions for N=2', () => {
  let regions = resolveRailStackRegions(2, HOST_HEIGHT);

  assert.equal(regions.length, 2);
  assert.deepEqual(regions[0], { index: 0, top: 0, height: 256 });
  assert.deepEqual(regions[1], { index: 1, top: 256, height: 256 });
  assert.equal(regions[0].height, regions[1].height);
  assert.equal(regions[0].height + regions[1].height, HOST_HEIGHT);
});

test('rail stack splits the host into three equal vertical regions for N=3', () => {
  let regions = resolveRailStackRegions(3, HOST_HEIGHT);

  assert.equal(regions.length, 3);
  for (let region of regions) {
    assert.ok(Math.abs(region.height - HOST_HEIGHT / 3) < 1e-9);
  }
  assert.equal(regions[0].top, 0);
  assert.ok(Math.abs(regions[1].top - HOST_HEIGHT / 3) < 1e-9);
  assert.ok(Math.abs(regions[2].top - (2 * HOST_HEIGHT) / 3) < 1e-9);
  let total = regions.reduce((sum, region) => sum + region.height, 0);
  assert.ok(Math.abs(total - HOST_HEIGHT) < 1e-9);
});

test('rail stack keeps a single rail full-height for N=1', () => {
  assert.deepEqual(resolveRailStackRegions(1, HOST_HEIGHT), [
    { index: 0, top: 0, height: HOST_HEIGHT },
  ]);
});

test('rail stack attaches regions without changing rail identity', () => {
  let owner = { name: 'inner-layout' };
  let stacked = layoutRailStack(
    [
      { railId: 'inner:end:graph', owner, ownerId: 'inner', panelId: 'graph', dock: 'end', icon: 'hub', label: 'Graph' },
      { railId: 'inner:end:theme', owner, ownerId: 'inner', panelId: 'theme', dock: 'end', icon: 'palette', label: 'Theme' },
    ],
    HOST_HEIGHT
  );

  assert.equal(stacked.length, 2);
  assert.equal(stacked[0].railId, 'inner:end:graph');
  assert.equal(stacked[0].owner, owner);
  assert.equal(stacked[0].icon, 'hub');
  assert.deepEqual(stacked[0].region, { index: 0, top: 0, height: 256 });
  assert.deepEqual(stacked[1].region, { index: 1, top: 256, height: 256 });
});

test('rail stack registry preserves per-owner identity and routes by rail id', () => {
  let registry = createRailStackRegistry();
  let inner = { name: 'inner' };
  let outer = { name: 'outer' };

  registry.register('inner', [
    { railId: 'inner:end:graph', owner: inner, panelId: 'graph', dock: 'end' },
    { railId: 'inner:end:theme', owner: inner, panelId: 'theme', dock: 'end' },
  ]);
  registry.register('outer', [
    { railId: 'outer:end:chat', owner: outer, panelId: 'chat', dock: 'end' },
  ]);

  assert.equal(registry.count(), 3);
  assert.deepEqual(registry.list().map((rail) => rail.railId), [
    'inner:end:graph',
    'inner:end:theme',
    'outer:end:chat',
  ]);

  let routed = routeRailDescriptor(registry.list(), 'outer:end:chat');
  assert.equal(routed.owner, outer);
  assert.equal(routed.panelId, 'chat');
  assert.equal(routeRailDescriptor(registry.list(), 'missing'), null);

  // Re-registering one owner replaces only that owner's slice.
  registry.register('inner', [
    { railId: 'inner:end:graph', owner: inner, panelId: 'graph', dock: 'end' },
  ]);
  assert.deepEqual(registry.list().map((rail) => rail.railId), [
    'inner:end:graph',
    'outer:end:chat',
  ]);

  registry.unregister('inner');
  assert.deepEqual(registry.list().map((rail) => rail.railId), ['outer:end:chat']);
});

test('rail stack rejects descriptors without stable identity', () => {
  assert.equal(normalizeRailDescriptor({ panelId: 'graph', dock: 'end' }), null);
  assert.equal(normalizeRailDescriptor({ railId: 'x', dock: 'end' }), null);
  assert.equal(normalizeRailDescriptor({ railId: 'x', panelId: 'graph', dock: 'middle' }), null);
});

test('nested layouts contribute rails to a shared host zone routed to the owner', async () => {
  let [stack, layout, template, styles, shell] = await Promise.all([
    readFile(railStackSource, 'utf8'),
    readFile(layoutSource, 'utf8'),
    readFile(layoutTemplate, 'utf8'),
    readFile(layoutStyles, 'utf8'),
    readFile(dockShellSource, 'utf8'),
  ]);

  // Pure contract stays Node-safe: no window/document in the shared module.
  assert.doesNotMatch(stack, /window|document/);
  assert.match(stack, /resolveRailStackRegions/);
  assert.match(stack, /createRailStackRegistry/);
  assert.match(stack, /routeRailDescriptor/);

  // Host registration/config API on the layout provider.
  assert.match(layout, /getDrawerRailDescriptors/);
  assert.match(layout, /registerRailStackContributor/);
  assert.match(layout, /unregisterRailStackContributor/);
  assert.match(layout, /onRailStackClick/);
  assert.match(layout, /_syncRailStack/);
  assert.match(layout, /_activateStackedRail/);
  assert.match(layout, /railStackItems/);
  assert.match(layout, /hasRailStack/);
  assert.match(layout, /rail-stack-active/);
  assert.match(layout, /rail-stack-suppressed/);

  // Shared zone renders one proxy per rail; clicks route to the owner.
  assert.match(template, /layout-rail-stack/);
  assert.match(template, /railStackItems/);
  assert.match(template, /onRailStackClick/);
  assert.match(template, /data-rail-id/);
  assert.match(styles, /\.layout-rail-stack\s*\{[\s\S]*?flex-direction:\s*column;/);
  assert.match(styles, /\.layout-rail-stack-btn\s*\{[\s\S]*?flex:\s*1 1 0;/);
  assert.match(styles, /rail-stack-suppressed/);
  assert.match(styles, /\.layout-rail-stack-btn:focus-visible\s*\{[\s\S]*?outline:/);

  // Existing same-layout launchers and single-active drawer semantics stay.
  assert.match(layout, /_syncDrawerLaunchers/);
  assert.match(layout, /onLauncherClick/);
  assert.match(layout, /this\.openDrawer\(dock, panelId\)/);
  assert.match(template, /layout-drawer-launchers-start/);
  assert.match(template, /layout-drawer-launchers-end/);

  // Minimal CV call-site: the dock shell registers a nested consumer layout.
  assert.match(shell, /registerRailStackLayout/);
  assert.match(shell, /unregisterRailStackLayout/);
  assert.match(shell, /registerRailStackContributor/);
});
