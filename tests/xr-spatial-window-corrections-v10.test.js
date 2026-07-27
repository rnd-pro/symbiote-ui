import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateXRSpatialWindowThemeRedrawReceipt,
} from '../xr/spatial-window-contract.js';
import { createXRSpatialWindowAssembly } from '../xr/spatial-window-assembly.js';
import {
  createFakeXrPlatform,
  createLayoutDescriptor,
  createWindowContentElement,
  createFakeThree,
  createFakeBatchBridge,
} from './xr-spatial-window-fixtures.js';

test('Provider theme/chrome v10 corrections validation', async (t) => {
  let platform = createFakeXrPlatform({ mode: 'webgl' });
  let THREE = createFakeThree();

  await t.test('1. Bounded fixtures: token-only change redraws exactly once; exact full reapply no-op', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v10-1' });

    let themeInput1 = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      tokens: {
        '--sn-xr-panel-bg': '#ff0000',
        '--sn-xr-panel-border': '1px solid #00ff00',
        '--sn-xr-panel-radius': '8px',
        '--sn-xr-panel-shadow': 'none',
        '--sn-xr-pointer-color': '#0000ff',
        '--sn-sys-on-surface': '#ffffff',
        '--sn-sys-on-surface-dim': '#888888',
        '--sn-duration-fast': '100ms',
        '--sn-ease-standard': 'ease-out',
        '--sn-layout-resizer-size': '8px'
      },
      material: {
        background: '#ff0000',
        backgroundColor: 0xff0000,
        border: '1px solid #00ff00',
        borderColor: 0x00ff00,
        radius: '8px',
        shadow: 'none',
        pointer: '#0000ff',
        pointerColor: 0x0000ff,
        text: '#ffffff',
        textColor: 0xffffff,
        textDim: '#888888',
        textDimColor: 0x888888,
        gap: '8px',
        motion: { duration: '100ms', easing: 'ease-out' }
      }
    };

    // First theme application: redraws/uploads
    assembly.applyTheme(themeInput1);
    let diag1 = assembly.getDiagnostics();
    let rev1 = diag1.windows[0].themeRevision;
    let uploads1 = diag1.windows[0].upload.uploads;

    // Apply exact same theme input: must throw zero-handle/no-op
    assert.throws(() => {
      assembly.applyTheme(themeInput1);
    }, /zero-handle\/no-op/);

    // Token-only change theme: change one token val (e.g. pointer color)
    let themeInput2 = {
      ...themeInput1,
      tokens: {
        ...themeInput1.tokens,
        '--sn-xr-pointer-color': '#ff00ff'
      }
    };

    // Apply token-only change: must redraw exactly once
    assembly.applyTheme(themeInput2);
    let diag3 = assembly.getDiagnostics();
    let rev3 = diag3.windows[0].themeRevision;
    let uploads3 = diag3.windows[0].upload.uploads;

    assert.equal(rev3, rev1 + 1, 'Theme revision must increment on token-only change');
    assert.equal(uploads3, uploads1 + 1, 'Uploads must increment on token-only change');

    // Apply the same token-only theme again: must throw zero-handle/no-op
    assert.throws(() => {
      assembly.applyTheme(themeInput2);
    }, /zero-handle\/no-op/);
  });

  await t.test('2. Two-window second prepare/commit failure restores first external bridge/GPU and all diagnostics', async () => {
    let mockBridge = createFakeBatchBridge({
      shouldFail: (stage) => stage === 'commit',
      commitFailReason: 'simulated-staging-failure',
      stage: 'three-material-applied',
    });

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge
    });

    let contentAlpha = createWindowContentElement(platform.document);
    let contentBeta = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
      createLayoutDescriptor({ layoutId: 'layout-beta', themeScope: 'beta-scope' }),
    ], [contentAlpha, contentBeta]);
    assembly.enter({ sessionId: 'session-v10-2' });

    let preDiag = JSON.parse(JSON.stringify(assembly.getDiagnostics()));

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      global: true, // affects both windows
      tokens: {
        '--sn-xr-panel-bg': '#777777',
        '--sn-xr-panel-border': '1px solid #777777',
        '--sn-xr-panel-radius': '8px',
        '--sn-xr-panel-shadow': 'none',
        '--sn-xr-pointer-color': '#0000ff',
        '--sn-sys-on-surface': '#ffffff',
        '--sn-sys-on-surface-dim': '#888888',
        '--sn-duration-fast': '100ms',
        '--sn-ease-standard': 'ease-out',
        '--sn-layout-resizer-size': '8px'
      },
      material: {
        background: '#777777',
        backgroundColor: 0x777777,
        border: '1px solid #777777',
        borderColor: 0x777777,
        radius: '8px',
        shadow: 'none',
        pointer: '#0000ff',
        pointerColor: 0x0000ff,
        text: '#ffffff',
        textColor: 0xffffff,
        textDim: '#888888',
        textDimColor: 0x888888,
        gap: '8px',
        motion: { duration: '100ms', easing: 'ease-out' }
      }
    };

    // Staging failure: beta window prepare fails, should rollback alpha window completely
    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: simulated-commit-failure/);

    let postDiag = assembly.getDiagnostics();

    // Verify alpha revision and materials are rolled back to pre-state
    assert.equal(postDiag.windows[0].themeRevision, preDiag.windows[0].themeRevision, 'Alpha revision must rollback');
    assert.equal(postDiag.windows[1].themeRevision, preDiag.windows[1].themeRevision, 'Beta revision must rollback');
    assert.equal(mockBridge.getCounts().rollbackCount, 1, 'Rollback on first window prepared handle must be called');

    // Verify GPU state of first window is restored
    let meshAlpha = assembly.getWindowMesh('window:layout-alpha');
    assert.ok(meshAlpha);
    assert.equal(meshAlpha.userData.panel.material?.backgroundColor, preDiag.windows[0].theme.snapshot?.material?.backgroundColor);
  });

  await t.test('3. Material update throw rolls back and propagates error', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v10-3' });

    let preDiag = JSON.parse(JSON.stringify(assembly.getDiagnostics()));

    // Make material color setHex method throw to simulate a GPU/material state error
    let mesh = assembly.getWindowMesh('window:layout-alpha');
    assert.ok(mesh);
    let originalSetHex = mesh.material.color.setHex;
    mesh.material.color.setHex = function(val) {
      mesh.material.color.setHex = originalSetHex;
      throw new Error('simulated-material-color-error');
    };

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      tokens: {
        '--sn-xr-panel-bg': '#aaaaaa',
        '--sn-xr-panel-border': '1px solid #aaaaaa',
        '--sn-xr-panel-radius': '8px',
        '--sn-xr-panel-shadow': 'none',
        '--sn-xr-pointer-color': '#0000ff',
        '--sn-sys-on-surface': '#ffffff',
        '--sn-sys-on-surface-dim': '#888888',
        '--sn-duration-fast': '100ms',
        '--sn-ease-standard': 'ease-out',
        '--sn-layout-resizer-size': '8px'
      },
      material: {
        background: '#aaaaaa',
        backgroundColor: 0xaaaaaa,
        border: '1px solid #aaaaaa',
        borderColor: 0xaaaaaa,
        radius: '8px',
        shadow: 'none',
        pointer: '#0000ff',
        pointerColor: 0x0000ff,
        text: '#ffffff',
        textColor: 0xffffff,
        textDim: '#888888',
        textDimColor: 0x888888,
        gap: '8px',
        motion: { duration: '100ms', easing: 'ease-out' }
      }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: simulated-material-color-error/);

    let postDiag = assembly.getDiagnostics();
    assert.equal(postDiag.windows[0].themeRevision, preDiag.windows[0].themeRevision, 'Revision must rollback on material exception');
  });

  await t.test('4. Missing/mismatched bridge inspection cannot pass', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v10-4' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      tokens: {
        '--sn-xr-panel-bg': '#bbbbbb',
        '--sn-xr-panel-border': '1px solid #bbbbbb',
        '--sn-xr-panel-radius': '8px',
        '--sn-xr-panel-shadow': 'none',
        '--sn-xr-pointer-color': '#0000ff',
        '--sn-sys-on-surface': '#ffffff',
        '--sn-sys-on-surface-dim': '#888888',
        '--sn-duration-fast': '100ms',
        '--sn-ease-standard': 'ease-out',
        '--sn-layout-resizer-size': '8px'
      },
      material: {
        background: '#bbbbbb',
        backgroundColor: 0xbbbbbb,
        border: '1px solid #bbbbbb',
        borderColor: 0xbbbbbb,
        radius: '8px',
        shadow: 'none',
        pointer: '#0000ff',
        pointerColor: 0x0000ff,
        text: '#ffffff',
        textColor: 0xffffff,
        textDim: '#888888',
        textDimColor: 0x888888,
        gap: '8px',
        motion: { duration: '100ms', easing: 'ease-out' }
      }
    };

    let mesh = assembly.getWindowMesh('window:layout-alpha');
    assert.ok(mesh);

    // Make inspection fail by setting mesh.material to null
    let origMaterial = mesh.material;
    mesh.material = null;

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: texture-identity-mismatch/);

    // Restore mesh material so cleanup/dispose doesn't crash
    mesh.material = origMaterial;
  });

  await t.test('5. Valid alternate cascade root is used and invalid root fails before mutation', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v10-5' });

    let preDiag = JSON.parse(JSON.stringify(assembly.getDiagnostics()));

    // 5.1 Invalid root (plain object without document/element properties) fails before mutation
    let badTheme = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      root: { someProperty: 'not-a-node' }, // invalid root
      tokens: {
        '--sn-xr-panel-bg': '#cccccc',
      }
    };

    assert.throws(() => {
      assembly.applyTheme(badTheme);
    }, /Theme redraw receipt validation failed: unsupported-cascade-root/);

    let postDiag = assembly.getDiagnostics();
    assert.equal(postDiag.windows[0].themeRevision, preDiag.windows[0].themeRevision, 'Revision must not change on invalid root');

    // 5.2 Valid root node (alternate DOM element) is used
    let validDiv = platform.document.createElement('div');
    platform.document.body.appendChild(validDiv);
    Object.defineProperty(validDiv, 'style', {
      value: {
        getPropertyValue(prop) {
          if (prop === '--sn-xr-panel-bg') return '#112233';
          return '';
        }
      },
      writable: true,
      configurable: true
    });

    let goodTheme = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      root: validDiv,
      tokens: {
        '--sn-xr-panel-bg': '#112233',
        '--sn-xr-panel-border': 'none',
        '--sn-xr-panel-radius': '0px',
        '--sn-xr-panel-shadow': 'none',
        '--sn-xr-pointer-color': '#000000',
        '--sn-sys-on-surface': '#000000',
        '--sn-sys-on-surface-dim': '#000000',
        '--sn-duration-fast': '0ms',
        '--sn-ease-standard': 'linear',
        '--sn-layout-resizer-size': '0px'
      },
      material: {
        background: '#112233',
        backgroundColor: 0x112233,
        border: 'none',
        borderColor: 0x000000,
        radius: '0px',
        shadow: 'none',
        pointer: '#000000',
        pointerColor: 0x000000,
        text: '#000000',
        textColor: 0x000000,
        textDim: '#000000',
        textDimColor: 0x000000,
        gap: '0px',
        motion: { duration: '0ms', easing: 'linear' }
      }
    };

    assembly.applyTheme(goodTheme);
    let updatedDiag = assembly.getDiagnostics();
    assert.equal(updatedDiag.windows[0].theme.snapshot.tokens['--sn-xr-panel-bg'], '#112233');
    validDiv.remove();
  });
});
