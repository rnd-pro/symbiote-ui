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

test('Provider theme/chrome v11 corrections validation', async (t) => {
  let platform = createFakeXrPlatform({ mode: 'webgl' });
  let THREE = createFakeThree();

  await t.test('1. Multi-window transaction prepare -> commit -> inspect -> finalize flow success', async () => {
    let log = [];
    let baseBridge = createFakeBatchBridge({ stage: 'three-material-applied' });
    let testStagingBridge = {
      prepareBatch(items, options) {
        log.push('prepareBatch');
        return baseBridge.prepareBatch(items, options);
      },
      commitBatch(tx) {
        log.push('commitBatch');
        return baseBridge.commitBatch(tx);
      },
      inspectBatch(tx) {
        log.push('inspectBatch');
        return baseBridge.inspectBatch(tx);
      },
      finalizeBatch(tx) {
        log.push('finalizeBatch');
        return baseBridge.finalizeBatch(tx);
      },
      rollbackBatch(tx) {
        log.push('rollbackBatch');
        return baseBridge.rollbackBatch(tx);
      }
    };

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: testStagingBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    let contentBeta = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
      createLayoutDescriptor({ layoutId: 'layout-beta', themeScope: 'beta-scope' }),
    ], [contentAlpha, contentBeta]);
    assembly.enter({ sessionId: 'session-v11-1' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      global: true,
      tokens: {
        '--sn-xr-panel-bg': '#888888',
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
        background: '#888888',
        backgroundColor: 0x888888,
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

    assembly.applyTheme(themeInput);

    let expectedLog = [
      'prepareBatch',
      'commitBatch',
      'inspectBatch',
      'finalizeBatch'
    ];
    assert.deepEqual(log, expectedLog, 'Transaction must execute exact prepare -> commit -> inspect -> finalize flow in order');
  });

  await t.test('2. Two-window second commit failure invokes rollback in reverse order and verifies exact prior state', async () => {
    let log = [];
    let baseBridge = createFakeBatchBridge({
      shouldFail: (stage) => stage === 'commit',
      commitFailReason: 'simulated-commit-failure',
      stage: 'three-material-applied'
    });
    let stagingBridge = {
      prepareBatch(items, options) {
        log.push('prepareBatch');
        return baseBridge.prepareBatch(items, options);
      },
      commitBatch(tx) {
        log.push('commitBatch');
        return baseBridge.commitBatch(tx);
      },
      rollbackBatch(tx) {
        log.push('rollbackBatch');
        return baseBridge.rollbackBatch(tx);
      },
      inspectBatch(tx) {
        log.push('inspectBatch');
        return baseBridge.inspectBatch(tx);
      },
      finalizeBatch(tx) {
        log.push('finalizeBatch');
        return baseBridge.finalizeBatch(tx);
      }
    };

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: stagingBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    let contentBeta = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
      createLayoutDescriptor({ layoutId: 'layout-beta', themeScope: 'beta-scope' }),
    ], [contentAlpha, contentBeta]);
    assembly.enter({ sessionId: 'session-v11-2' });

    let preDiag = JSON.parse(JSON.stringify(assembly.getDiagnostics()));

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      global: true,
      tokens: { '--sn-xr-panel-bg': '#777777' },
      material: { background: '#777777', backgroundColor: 0x777777 }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: simulated-commit-failure/);

    let postDiag = assembly.getDiagnostics();
    assert.equal(postDiag.windows[0].themeRevision, preDiag.windows[0].themeRevision, 'Alpha revision must rollback');
    assert.equal(postDiag.windows[1].themeRevision, preDiag.windows[1].themeRevision, 'Beta revision must rollback');

    assert.deepEqual(log, [
      'prepareBatch',
      'commitBatch',
      'rollbackBatch'
    ], 'Rollback must execute prepareBatch, commitBatch, rollbackBatch in order');
  });

  await t.test('3. Three-window inspection mismatch triggers reverse rollback and restores prior state', async () => {
    let log = [];
    let baseBridge = createFakeBatchBridge({ stage: 'three-material-applied' });
    let stagingBridge = {
      prepareBatch(items, options) {
        log.push('prepareBatch');
        return baseBridge.prepareBatch(items, options);
      },
      commitBatch(tx) {
        log.push('commitBatch');
        return baseBridge.commitBatch(tx);
      },
      rollbackBatch(tx) {
        log.push('rollbackBatch');
        return baseBridge.rollbackBatch(tx);
      },
      inspectBatch(tx) {
        log.push('inspectBatch');
        let res = baseBridge.inspectBatch(tx);
        if (res && res.ok && res.observations) {
          let obs = res.observations.get('window:layout-gamma');
          if (obs) {
            obs.snapshotDigest = 'mismatched-digest-value';
          }
        }
        return res;
      },
      finalizeBatch(tx) {
        log.push('finalizeBatch');
        return baseBridge.finalizeBatch(tx);
      }
    };

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: stagingBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    let contentBeta = createWindowContentElement(platform.document);
    let contentGamma = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-u1' }),
      createLayoutDescriptor({ layoutId: 'layout-beta', themeScope: 'scope-u1' }),
      createLayoutDescriptor({ layoutId: 'layout-gamma', themeScope: 'scope-u1' }),
    ], [contentAlpha, contentBeta, contentGamma]);
    assembly.enter({ sessionId: 'session-v11-3' });

    let preDiag = JSON.parse(JSON.stringify(assembly.getDiagnostics()));

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-u1',
      tokens: { '--sn-xr-panel-bg': '#999999' },
      material: { background: '#999999', backgroundColor: 0x999999 }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: inspection-snapshot-digest-mismatch/);

    let postDiag = assembly.getDiagnostics();
    assert.equal(postDiag.windows[0].themeRevision, preDiag.windows[0].themeRevision, 'Alpha must rollback on inspection mismatch');
    assert.equal(postDiag.windows[1].themeRevision, preDiag.windows[1].themeRevision, 'Beta must rollback on inspection mismatch');
    assert.equal(postDiag.windows[2].themeRevision, preDiag.windows[2].themeRevision, 'Gamma must rollback on inspection mismatch');

    assert.deepEqual(log, [
      'prepareBatch',
      'commitBatch',
      'inspectBatch',
      'rollbackBatch'
    ], 'Rollback must execute prepareBatch, commitBatch, inspectBatch, rollbackBatch in order');
  });

  await t.test('4. Sequential non-staged bridge fails closed pre-mutation on multi-window theme update', async () => {
    let mockSequentialBridge = {
      applyPanelTexture(mesh, panel, options) {
        return { ok: true, textureApplied: true };
      }
    };

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockSequentialBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    let contentBeta = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-u2' }),
      createLayoutDescriptor({ layoutId: 'layout-beta', themeScope: 'scope-u2' }),
    ], [contentAlpha, contentBeta]);
    assembly.enter({ sessionId: 'session-v11-4' });

    let preDiag = JSON.parse(JSON.stringify(assembly.getDiagnostics()));

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-u2',
      tokens: { '--sn-xr-panel-bg': '#aaaaaa' },
      material: { background: '#aaaaaa', backgroundColor: 0xaaaaaa }
    };

    // Since bridge lacks prepare/commit/rollback/inspect/finalize and multiple windows are mounted & affected, it must fail closed pre-mutation
    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /missing-bridge-capability/);

    let postDiag = assembly.getDiagnostics();
    assert.equal(postDiag.windows[0].themeRevision, preDiag.windows[0].themeRevision, 'Pre-mutation failure must leave first window untouched');
    assert.equal(postDiag.windows[1].themeRevision, preDiag.windows[1].themeRevision, 'Pre-mutation failure must leave second window untouched');
  });

  await t.test('5. Rollback restores exact needsUpdate value and does not force it', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-u3' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v11-5' });

    let mesh = assembly.getWindowMesh('window:layout-alpha');
    mesh.material.needsUpdate = false; // set initial value

    // Inject an error in updating material color to force rollback
    let originalSetHex = mesh.material.color.setHex;
    mesh.material.color.setHex = function(val) {
      mesh.material.color.setHex = originalSetHex;
      throw new Error('simulated-material-color-error');
    };

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-u3',
      tokens: { '--sn-xr-panel-bg': '#555555' },
      material: { background: '#555555', backgroundColor: 0x555555 }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: simulated-material-color-error/);

    assert.equal(mesh.material.needsUpdate, false, 'Rollback must restore the exact needsUpdate value instead of forcing it to true');
  });

  await t.test('6. Strict cascade root validation rejects DocumentFragments and lookalikes', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-u4' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v11-6' });

    // 6.1 nodeType === 11 (DocumentFragment) is rejected
    let fragmentRoot = platform.document.createDocumentFragment();
    let themeInputFragment = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-u4',
      root: fragmentRoot,
      tokens: { '--sn-xr-panel-bg': '#111111' }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInputFragment);
    }, /Theme redraw receipt validation failed: unsupported-cascade-root/);

    // 6.2 Plain lookalike object lacking DOM element functions is rejected
    let lookalikeRoot = {
      nodeType: 1,
      style: {},
      ownerDocument: {}
      // missing getAttribute etc.
    };
    let themeInputLookalike = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-u4',
      root: lookalikeRoot,
      tokens: { '--sn-xr-panel-bg': '#111111' }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInputLookalike);
    }, /Theme redraw receipt validation failed: unsupported-cascade-root/);
  });
});
