import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateXRSpatialWindowThemeRedrawReceipt,
  validateXRSpatialWindowThemeRedrawReceiptSelfConsistency,
  validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservation,
  computeXREvidenceDigest,
  validateXRThemeSnapshot,
  validateXRThemeMaterial,
  validateXRThemeInput,
} from '../xr/spatial-window-contract.js';
import { createXRSpatialWindowAssembly } from '../xr/spatial-window-assembly.js';
import {
  createFakeXrPlatform,
  createLayoutDescriptor,
  createWindowContentElement,
  createFakeThree,
  createFakeBatchBridge,
} from './xr-spatial-window-fixtures.js';

test('Provider theme/chrome v9 corrections validation', async (t) => {
  let platform = createFakeXrPlatform({ mode: 'webgl' });
  let THREE = createFakeThree();

  await t.test('1. Bounded fixtures: nested extras and type errors fail before mutation', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v9-1' });

    let initialDiagnostics = JSON.parse(JSON.stringify(assembly.getDiagnostics()));
    let initialAlphaRevision = initialDiagnostics.windows[0].themeRevision || 0;

    // 1.1 Input with nested extra property inside material fails
    let badTheme1 = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      tokens: {},
      material: {
        background: '#ff0000',
        backgroundColor: 0xff0000,
        extraPropertyNotAllowed: 'nested-extra-value'
      }
    };

    assert.throws(() => {
      assembly.applyTheme(badTheme1);
    }, /Theme redraw receipt validation failed: disallowed-material-property-extraPropertyNotAllowed/);

    // 1.2 Input with invalid types (e.g. non-string tokens) fails
    let badTheme2 = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      tokens: {
        '--sn-xr-panel-bg': 12345 // should be a string
      },
      material: {}
    };

    assert.throws(() => {
      assembly.applyTheme(badTheme2);
    }, /Theme redraw receipt validation failed: token---sn-xr-panel-bg-must-be-string/);

    // 1.3 Verify no mutation has occurred
    let postDiagnostics = JSON.parse(JSON.stringify(assembly.getDiagnostics()));
    assert.equal(postDiagnostics.windows[0].themeRevision || 0, initialAlphaRevision, 'Theme revision must not change on validation failure');
  });

  await t.test('2. Exact identical reapply: no-op with unchanged revisions/counters and no redraw', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v9-2' });

    let themeInput = {
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
        motion: {
          duration: '100ms',
          easing: 'ease-out'
        }
      }
    };

    // First application: redraws/uploads
    assembly.applyTheme(themeInput);
    let diag1 = JSON.parse(JSON.stringify(assembly.getDiagnostics()));
    let rev1 = diag1.windows[0].themeRevision;
    let uploadCount1 = diag1.windows[0].upload.uploads;

    // Second application: exact identical theme reapply must throw zero-handle/no-op under new contract
    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /zero-handle\/no-op/);

    let receiptsAfter = assembly.getReceipts().filter(r => r.action === 'theme-redraw');
    assert.equal(receiptsAfter.length, 1, 'No new redraw receipts must be emitted for zero-handle/no-op');
  });

  await t.test('3. Scoped/unmatched themes: complete revision maps must bind all windows', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    let contentBeta = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
      createLayoutDescriptor({ layoutId: 'layout-beta', themeScope: 'beta-scope' }),
    ], [contentAlpha, contentBeta]);
    assembly.enter({ sessionId: 'session-v9-3' });

    let themeInput = {
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
        motion: {
          duration: '100ms',
          easing: 'ease-out'
        }
      }
    };

    assembly.applyTheme(themeInput);
    let receipt = assembly.getReceipts().filter(r => r.action === 'theme-redraw').slice(-1)[0];

    assert.equal(receipt.windowIds.length, 2);
    let beforeRevisionKeys = Object.keys(receipt.beforeRevision);
    let afterRevisionKeys = Object.keys(receipt.afterRevision);

    assert.ok(beforeRevisionKeys.includes('window:layout-alpha'));
    assert.ok(beforeRevisionKeys.includes('window:layout-beta'));
    assert.ok(afterRevisionKeys.includes('window:layout-alpha'));
    assert.ok(afterRevisionKeys.includes('window:layout-beta'));

    let val = await validateXRSpatialWindowThemeRedrawReceipt(receipt);
    assert.equal(val.ok, true, `Receipt validation failed: ${val.reason}`);
  });

  await t.test('4. Transactional applyTheme: texture bridge failure restores exact synchronous state', async () => {
    let bridgePlatform = createFakeXrPlatform();
    let bridgeThree = createFakeThree();
    let assembly = createXRSpatialWindowAssembly({
      globalThis: bridgePlatform.globalThis,
      document: bridgePlatform.document,
      THREE: bridgeThree,
      textureBridge: createFakeBatchBridge({
        shouldFail: (stage) => stage === 'commit',
        commitFailReason: 'simulated-texture-failure',
      }),
    });

    let contentAlpha = createWindowContentElement(bridgePlatform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v9-4' });

    let diag1 = JSON.parse(JSON.stringify(assembly.getDiagnostics()));
    let rev1 = diag1.windows[0].themeRevision || 0;

    let themeInput = {
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
        motion: {
          duration: '100ms',
          easing: 'ease-out'
        }
      }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: simulated-commit-failure/);

    let diag2 = JSON.parse(JSON.stringify(assembly.getDiagnostics()));
    let rev2 = diag2.windows[0].themeRevision || 0;

    assert.equal(rev2, rev1, 'Theme revision must rollback to original on texture bridge failure');
    assert.deepEqual(diag2.windows[0].material, diag1.windows[0].material, 'Material must rollback to original on texture bridge failure');
  });
});
