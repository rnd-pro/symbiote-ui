import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const layoutSource = new URL('../layout/Layout/Layout.js', import.meta.url);
const layoutStyles = new URL('../layout/Layout/Layout.css.js', import.meta.url);
const layoutTemplate = new URL('../layout/Layout/Layout.tpl.js', import.meta.url);
const dockShellSource = new URL('../chat/AgentDockShell/AgentDockShell.js', import.meta.url);

test('native R2 rails render without synthetic rail-button presentation', async () => {
  let [layout, template, styles] = await Promise.all([
    readFile(layoutSource, 'utf8'),
    readFile(layoutTemplate, 'utf8'),
    readFile(layoutStyles, 'utf8'),
  ]);

  // No synthetic button zones in the template.
  assert.doesNotMatch(template, /layout-drawer-launcher/);
  assert.doesNotMatch(template, /layout-rail-stack/);
  assert.doesNotMatch(template, /rail-stack-btn/);
  assert.doesNotMatch(template, /launcher-list/);
  assert.doesNotMatch(template, /rail-stack-list/);
  assert.doesNotMatch(template, /startLauncherItems/);
  assert.doesNotMatch(template, /endLauncherItems/);
  assert.doesNotMatch(template, /railStack\w*Items/);
  assert.doesNotMatch(template, /onLauncherClick/);
  assert.doesNotMatch(template, /onRailStackClick/);

  // No synthetic button state or proxy routing in the provider.
  assert.doesNotMatch(layout, /onLauncherClick/);
  assert.doesNotMatch(layout, /onRailStackClick/);
  assert.doesNotMatch(layout, /_syncDrawerLaunchers/);
  assert.doesNotMatch(layout, /_syncRailStack/);
  assert.doesNotMatch(layout, /_activateStackedRail/);
  assert.doesNotMatch(layout, /getDrawerRailDescriptors/);
  assert.doesNotMatch(layout, /registerRailStackContributor/);
  assert.doesNotMatch(layout, /unregisterRailStackContributor/);
  assert.doesNotMatch(layout, /railStack\w*Items/);
  assert.doesNotMatch(layout, /hasRailStack/);
  assert.doesNotMatch(layout, /hasStartLaunchers/);
  assert.doesNotMatch(layout, /hasEndLaunchers/);
  assert.doesNotMatch(layout, /rail-stack-active/);
  assert.doesNotMatch(layout, /drawer-start-launchers/);
  assert.doesNotMatch(layout, /drawer-end-launchers/);

  // No synthetic button styles, and native collapsed rails are never hidden.
  assert.doesNotMatch(styles, /\.layout-drawer-launcher/);
  assert.doesNotMatch(styles, /\.layout-rail-stack-btn/);
  assert.doesNotMatch(styles, /\.rail-stack-list/);
  assert.doesNotMatch(styles, /\.launcher-list/);
  assert.doesNotMatch(styles, /\[drawer-rail\]\[drawer-rail-collapsed\][\s\S]{0,160}?display:\s*none/);
});

test('native R2 rails share one dock edge as equal regions with a gap', async () => {
  let [layout, styles] = await Promise.all([
    readFile(layoutSource, 'utf8'),
    readFile(layoutStyles, 'utf8'),
  ]);

  // One dock edge per side: START stays inline-start, END stays inline-end.
  assert.match(styles, /layout-node\[mobile-dock='start'\][\s\S]*?inset-inline-start:\s*0;/);
  assert.match(styles, /layout-node\[mobile-dock='end'\][\s\S]*?inset-inline-end:\s*0;/);

  // Equal vertical regions driven by per-rail count/index with a uniform gap.
  assert.match(styles, /--sn-layout-rail-count/);
  assert.match(styles, /--sn-layout-rail-index/);
  assert.match(styles, /--sn-layout-rail-gap|--sn-layout-native-rail-gap/);
  assert.match(
    styles,
    /layout-node\[drawer-rail\]\[drawer-rail-collapsed\][\s\S]*?block-size:\s*calc\(/
  );
  assert.match(
    styles,
    /layout-node\[drawer-rail\]\[drawer-rail-collapsed\][\s\S]*?inset-block-start:\s*calc\(/
  );

  // Single owner: this layout's own nodes, deduped by dock + panel identity.
  assert.match(layout, /_syncNativeRailRegions/);
  assert.match(layout, /getOwnedLayoutNodes\((?:this|layout),\s*'layout-node\[drawer-rail\]\[drawer-rail-collapsed\]'\)/);
  assert.match(layout, /--sn-layout-rail-count/);
  assert.match(layout, /--sn-layout-rail-index/);
  assert.match(layout, /dataset\?\.drawerPanelId/);
});

test('native R2 rails keep a single owner with no inner/outer duplicates', async () => {
  let [layout, shell] = await Promise.all([
    readFile(layoutSource, 'utf8'),
    readFile(dockShellSource, 'utf8'),
  ]);

  // No cross-layout contributor/host registries on the provider.
  assert.doesNotMatch(layout, /_railStackContributors/);
  assert.doesNotMatch(layout, /_railStackHosts/);
  assert.doesNotMatch(layout, /_railStackRegistry/);
  assert.doesNotMatch(layout, /rail-stack-suppressed/);
  assert.doesNotMatch(layout, /rail-stack-count/);

  // No nested-layout rail merging from the dock shell: each panel-layout
  // owns exactly its own collapsed rails.
  assert.doesNotMatch(shell, /registerRailStackContributor/);
  assert.doesNotMatch(shell, /unregisterRailStackContributor/);
  assert.doesNotMatch(shell, /RailStack/i);
});

test('native R2 rails preserve open/close/swipe/focus lifecycle', async () => {
  let [layout, styles] = await Promise.all([
    readFile(layoutSource, 'utf8'),
    readFile(layoutStyles, 'utf8'),
  ]);

  // Drawer open/close API and single-active semantics stay on the provider.
  assert.match(layout, /openDrawer\(dock, panelId\)/);
  assert.match(layout, /closeDrawer\(/);
  assert.match(layout, /toggleDrawer\(/);
  assert.match(layout, /_resyncDrawerProjection/);

  // Swipe lifecycle stays on native rail surfaces and drawer content.
  assert.match(layout, /_onDrawerRailPointerDown/);
  assert.match(layout, /_onDrawerPointerMove/);
  assert.match(layout, /_onDrawerPointerUp/);
  assert.match(layout, /layout-node\[drawer-rail\]\[drawer-rail-collapsed\]\[data-drawer-dock\]/);
  assert.match(layout, /drawer-open/);
  assert.match(layout, /drawer-expanded/);

  // Collapsed native rails keep their visible icon affordance.
  assert.match(styles, /layout-node\[drawer-rail\]\[drawer-rail-collapsed\][\s\S]*?\.type-btn\s*\{[\s\S]*?display:\s*flex !important;/);
  // Collapsed rails keep an interactive collapse affordance.
  assert.match(styles, /layout-node\[drawer-rail\]\[drawer-rail-collapsed\][\s\S]*?\.collapse-btn\s*\{/);
});
