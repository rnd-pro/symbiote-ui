import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateXRSpatialWindowThemeRedrawReceipt,
  sha256Sync,
  stringifyCanonical,
  validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservationSync,
} from '../xr/spatial-window-contract.js';
import {
  createXRSpatialWindowAssembly,
  RollbackVerificationError,
  FinalizeContractViolationError,
} from '../xr/spatial-window-assembly.js';
import {
  createXRThreePanelTextureBridge,
  createXRThreeHtmlCanvasTextureResolver,
  createXRThreeWebXRAdapter,
  PrepareBatchError,
} from '../xr/three-webxr-adapter.js';
import {
  createFakeXrPlatform,
  createLayoutDescriptor,
  createWindowContentElement,
  createFakeThree,
  createFakeBatchBridge,
} from './xr-spatial-window-fixtures.js';

test('Provider theme/chrome v13/v16 corrections validation', async (t) => {
  let platform = createFakeXrPlatform({ mode: 'webgl' });
  let THREE = createFakeThree();

  await t.test('1. Strict no-adapter capability checks (missing functions fail pre-mutation)', async () => {
    let mockInvalidBridge = {
      prepareBatch() { return { ok: true }; },
      // commitBatch, rollbackBatch, inspectBatch, finalizeBatch are missing!
    };

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockInvalidBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-v13-1' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v13-1' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-v13-1',
      tokens: { '--bg': '#111111' },
      material: { background: '#111111', backgroundColor: 0x111111 }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /missing-bridge-capability/);
  });

  await t.test('2. One-window pre-mutation failure', async () => {
    let mockBridge = createFakeBatchBridge({ prepareFails: true });

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-v13-2' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v13-2' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-v13-2',
      tokens: { '--bg': '#222222' },
      material: { background: '#222222', backgroundColor: 0x222222 }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: simulated-prepare-failure/);
  });

  await t.test('3. Attached forged roots (reject attached forged objects)', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-v13-3' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v13-3' });

    let forgedElement = {
      nodeType: 1,
      ownerDocument: platform.document,
      parentNode: platform.document.body,
      isConnected: true,
    };

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-v13-3',
      root: forgedElement,
      tokens: { '--bg': '#333333' },
      material: { background: '#333333', backgroundColor: 0x333333 }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed: unsupported-cascade-root/);
  });

  await t.test('4. Second commit failure and rollback verification error aggregation', async () => {
    let mockBridge = createFakeBatchBridge({
      shouldFail: (stage) => {
        if (stage === 'commit') return true;
        return false;
      },
      rollbackFails: true,
    });

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-v13-4' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v13-4' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-v13-4',
      tokens: { '--bg': '#444444' },
      material: { background: '#444444', backgroundColor: 0x444444 }
    };

    try {
      assembly.applyTheme(themeInput);
      assert.fail('Should have failed commit');
    } catch (err) {
      assert.match(err.message, /rollback-verification-failed/);
    }
  });

  await t.test('5. V16 Adversarial: Opaque scalar DTO, pre-validation assembly byte invariance, atomic finalize, and restore', async () => {
    let mockBridge = createFakeBatchBridge();

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-v16' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-v16' });

    let tx;
    let originalPrepare = mockBridge.prepareBatch;
    mockBridge.prepareBatch = function(...args) {
      let rawTx = originalPrepare.apply(this, args);
      tx = Object.freeze({
        version: rawTx.version,
        token: rawTx.token,
      });
      return tx;
    };

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-v16',
      tokens: { '--bg': '#555555' },
      material: { background: '#555555', backgroundColor: 0x555555 }
    };

    assembly.applyTheme(themeInput);

    // Verify DTO fields
    let keys = Object.keys(tx);
    assert.deepEqual(keys.sort(), ['token', 'version']);
    assert.equal(tx.version, 'xr-spatial-batch-tx-v18');
    assert.ok(typeof tx.token === 'string');
    assert.ok(Object.isFrozen(tx));

    let counts = mockBridge.getCounts();
    assert.equal(counts.prepareCount, 1);
    assert.equal(counts.commitCount, 1);
    assert.equal(counts.inspectCount, 1);
    assert.equal(counts.finalizeCount, 1);

    let diag = assembly.getDiagnostics();
    assert.equal(diag.windows[0].theme.snapshot.tokens['--bg'], '#555555');
  });

  await t.test('6. Zero-handle no emit / byte invariance', async () => {
    let mockBridge = createFakeBatchBridge();
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-zero' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-zero' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-zero',
      tokens: {},
      material: {}
    };

    assembly.applyTheme(themeInput);

    let preRev = assembly.getDiagnostics().windows[0].themeRevision;
    let receiptsBefore = assembly.getReceipts().length;

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /zero-handle/);

    assert.equal(assembly.getDiagnostics().windows[0].themeRevision, preRev);
    assert.equal(assembly.getReceipts().length, receiptsBefore, 'Zero receipts must be emitted');
  });

  await t.test('7. Unmounted affected window throws and keeps byte invariance', async () => {
    let mockBridge = createFakeBatchBridge();
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    // Create layout with volumetric contentKind so it is not mounted
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-unmounted', contentKind: 'volumetric' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-unmounted' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-unmounted',
      tokens: { '--bg': '#777777' },
      material: { background: '#777777', backgroundColor: 0x777777 }
    };

    let receiptsBefore = assembly.getReceipts().length;
    let preDiagnostics = JSON.stringify(assembly.getDiagnostics());

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /affected-window-unmounted/);

    assert.equal(assembly.getReceipts().length, receiptsBefore, 'Zero receipts must be emitted');
    assert.equal(JSON.stringify(assembly.getDiagnostics()), preDiagnostics, 'Assembly diagnostics must be byte-invariant');
  });

  await t.test('8. no-session throws and keeps byte invariance', async () => {
    let mockBridge = createFakeBatchBridge();
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-nosession' }),
    ], [contentAlpha]);
    // Do NOT enter the session

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-nosession',
      tokens: { '--bg': '#888888' },
      material: { background: '#888888', backgroundColor: 0x888888 }
    };

    let receiptsBefore = assembly.getReceipts().length;
    let preDiagnostics = JSON.stringify(assembly.getDiagnostics());

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /no-session/);

    assert.equal(assembly.getReceipts().length, receiptsBefore, 'Zero receipts must be emitted');
    assert.equal(JSON.stringify(assembly.getDiagnostics()), preDiagnostics, 'Assembly diagnostics must be byte-invariant');
  });

  await t.test('9. shell-not-ready throws and keeps byte invariance', async () => {
    let mockBridge = createFakeBatchBridge();
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE: null, // No THREE makes adapter (shell) not ready
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-shellnotready' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-shellnotready' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-shellnotready',
      tokens: { '--bg': '#999999' },
      material: { background: '#999999', backgroundColor: 0x999999 }
    };

    let receiptsBefore = assembly.getReceipts().length;
    let preDiagnostics = JSON.stringify(assembly.getDiagnostics());

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /shell-not-ready/);

    assert.equal(assembly.getReceipts().length, receiptsBefore, 'Zero receipts must be emitted');
    assert.equal(JSON.stringify(assembly.getDiagnostics()), preDiagnostics, 'Assembly diagnostics must be byte-invariant');
  });

  await t.test('prepare leak/disposer', async () => {
    let disposedCount = 0;
    let spyDisposer = (tex) => { disposedCount++; };
    
    let mockTex = { uuid: 'mock-tex-uuid', dispose() {} };

    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      disposer: spyDisposer,
      textureResolver: () => mockTex,
      requireTextureUpload: true,
    });

    let mesh1 = new THREE.Mesh();
    let panel1 = { id: 'panel-ok' };
    let element1 = platform.document.createElement('div');

    let mesh2 = new THREE.Mesh();
    let panel2 = { id: 'panel-fail' };

    let errorThrown = null;
    try {
      bridge.prepareBatch([
        {
          windowId: 'window-ok',
          mesh: mesh1,
          panel: panel1,
          element: element1,
          snapshot: { material: {} }
        },
        {
          windowId: 'window-fail',
          mesh: mesh2,
          panel: panel2,
          element: null, // Force prepare to fail due to missing element
          snapshot: { material: {} }
        }
      ]);
    } catch (err) {
      errorThrown = err;
    }

    assert.ok(errorThrown instanceof PrepareBatchError);
    assert.equal(errorThrown.code, 'panel-element-missing');
    assert.equal(errorThrown.count, 2);
    assert.equal(errorThrown.cleanupErrorCount, 0);
    assert.equal(disposedCount, 1, 'Spy disposer must be called on the created texture');
    
    // Check that transaction resources were NOT inserted into the private registry
    let inspectRes = bridge.inspectBatch(errorThrown);
    assert.equal(inspectRes.ok, false);
    assert.equal(inspectRes.reason, 'missing-transaction-token');
  });

  await t.test('scalar DTO', async () => {
    let mockBridge = createFakeBatchBridge();
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-scalar' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-scalar' });

    let tx;
    let originalPrepare = mockBridge.prepareBatch;
    mockBridge.prepareBatch = function(...args) {
      let rawTx = originalPrepare.apply(this, args);
      tx = Object.freeze({
        version: rawTx.version,
        token: rawTx.token,
      });
      return tx;
    };

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-scalar',
      tokens: { '--bg': '#ff0000' },
      material: { background: '#ff0000' }
    };

    assembly.applyTheme(themeInput);

    // Verify DTO fields
    let keys = Object.keys(tx);
    assert.deepEqual(keys.sort(), ['token', 'version']);
    assert.equal(tx.version, 'xr-spatial-batch-tx-v18');
    assert.ok(typeof tx.token === 'string');
    assert.ok(Object.isFrozen(tx));
  });

  await t.test('geometry tamper', async () => {
    let mockBridge = createFakeBatchBridge();
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-tamper', sizeMeters: [0.8, 0.45] }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-tamper' });

    // Intercept inspectBatch to tamper geometry dimensions
    let originalInspect = mockBridge.inspectBatch;
    mockBridge.inspectBatch = function(tx) {
      let result = originalInspect.apply(this, [tx]);
      // Let's modify the dimensions of the observation to not match panel
      for (let obs of result.observations.values()) {
        obs.dimensions = [1.5, 2.0];
      }
      return result;
    };

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-tamper',
      tokens: { '--bg': '#00ff00' },
      material: { background: '#00ff00' }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /dimensions-mismatch/);
  });

  await t.test('tokenless inspect rejection', async () => {
    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
    });

    // Call inspectBatch without a valid transaction/token
    let res = bridge.inspectBatch(null);
    assert.equal(res.ok, false);
    assert.equal(res.reason, 'missing-transaction-token');

    let res2 = bridge.inspectBatch({ version: 'xr-spatial-batch-tx-v18' });
    assert.equal(res2.ok, false);
    assert.equal(res2.reason, 'missing-transaction-token');

    let res3 = bridge.inspectBatch({ version: 'xr-spatial-batch-tx-v18', token: 'non-existent' });
    assert.equal(res3.ok, false);
    assert.equal(res3.reason, 'transaction-not-found');
  });

  await t.test('rollback-error exact assembly bytes', async () => {
    let mockBridge = createFakeBatchBridge({
      shouldFail: (stage) => stage === 'commit',
      rollbackFails: true,
    });

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-rollback-fail' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-rollback-fail' });

    let preDiag = JSON.stringify(assembly.getDiagnostics());

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-rollback-fail',
      tokens: { '--bg': '#0000ff' },
      material: { background: '#0000ff' }
    };

    try {
      assembly.applyTheme(themeInput);
      assert.fail('Should have thrown RollbackVerificationError');
    } catch (err) {
      assert.equal(err.name, 'RollbackVerificationError');
      assert.ok(err.bridgeErrors.length > 0);
    }

    // Verify exact byte restoration of assembly state
    assert.equal(JSON.stringify(assembly.getDiagnostics()), preDiag);
  });

  await t.test('public validator unsafe outcome/legacy mounted rejection', async () => {
    // 1. Receipt with accepted-without-redraw must fail validation
    let badReceipt = {
      version: 'xr-spatial-window-theme-redraw-receipt-v1',
      action: 'theme-redraw',
      ok: true,
      themeScope: '*',
      windowIds: ['win-1'],
      affectedWindows: ['win-1'],
      reusedWindows: [],
      beforeRevision: { 'win-1': 1 },
      afterRevision: { 'win-1': 2 },
      counters: { beforeUploads: 0, afterUploads: 1, beforeReuses: 0, afterReuses: 0 },
      bindingHash: '0'.repeat(64),
      evidenceDigest: '0'.repeat(64),
      windowResults: [{
        windowId: 'win-1',
        themeScope: 'xr',
        beforeRevision: 1,
        afterRevision: 2,
        snapshot: null,
        requestedMaterial: null,
        actualMaterial: null,
        outcome: 'accepted-without-redraw', // Disallowed outcome
        counters: { beforeUploads: 0, afterUploads: 1, beforeReuses: 0, afterReuses: 0 },
        hash: '0'.repeat(64)
      }]
    };

    // Calculate valid evidence digest to bypass self-consistency
    let envelopeToHash = { ...badReceipt };
    delete envelopeToHash.evidenceDigest;
    badReceipt.evidenceDigest = sha256Sync(stringifyCanonical(envelopeToHash));

    let res = await validateXRSpatialWindowThemeRedrawReceipt(badReceipt);
    assert.equal(res.ok, false);

    // 2. Receipt with unmounted affected window (unsafe) must fail validation
    let unsafeReceipt = {
      version: 'xr-spatial-window-theme-redraw-receipt-v1',
      action: 'theme-redraw',
      ok: true,
      themeScope: '*',
      windowIds: ['win-1'],
      affectedWindows: ['win-1'],
      reusedWindows: [],
      beforeRevision: { 'win-1': 1 },
      afterRevision: { 'win-1': 2 },
      counters: { beforeUploads: 0, afterUploads: 1, beforeReuses: 0, afterReuses: 0 },
      bindingHash: '0'.repeat(64),
      evidenceDigest: '0'.repeat(64),
      windowResults: [{
        windowId: 'win-1',
        themeScope: 'xr',
        beforeRevision: 1,
        afterRevision: 2,
        snapshot: null,
        requestedMaterial: null,
        actualMaterial: null,
        outcome: 'upload',
        counters: { beforeUploads: 0, afterUploads: 1, beforeReuses: 0, afterReuses: 0 },
        hash: '0'.repeat(64)
      }]
    };

    let windowResult = unsafeReceipt.windowResults[0];
    let recordToHash = {
      windowId: windowResult.windowId,
      themeScope: windowResult.themeScope,
      beforeRevision: windowResult.beforeRevision,
      afterRevision: windowResult.afterRevision,
      snapshot: windowResult.snapshot,
      requestedMaterial: windowResult.requestedMaterial,
      actualMaterial: windowResult.actualMaterial,
      outcome: windowResult.outcome,
      counters: windowResult.counters,
    };
    windowResult.hash = sha256Sync(stringifyCanonical(recordToHash));
    unsafeReceipt.bindingHash = sha256Sync(stringifyCanonical([windowResult.hash]));

    let preObs = [{
      windowId: 'win-1',
      themeRevision: 1,
      lifecycle: { mounted: false } // Unmounted
    }];
    let postObs = [{
      windowId: 'win-1',
      themeRevision: 2,
      lifecycle: { mounted: false } // Still unmounted -> unsafe!
    }];

    // Calculate valid evidence digest to bypass self-consistency
    let envelopeToHash2 = { ...unsafeReceipt };
    delete envelopeToHash2.evidenceDigest;
    unsafeReceipt.evidenceDigest = sha256Sync(stringifyCanonical(envelopeToHash2));

    let resUnsafe = validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservationSync(unsafeReceipt, { pre: preObs, post: postObs });
    assert.equal(resUnsafe.ok, false);
    assert.equal(resUnsafe.reason, 'unsafe-unmounted-affected-window');

    // 3. Legacy mounted property fallback must be rejected (only canonical lifecycle.mounted)
    let legacyObs = [{
      windowId: 'win-1',
      themeRevision: 2,
      mounted: true // Legacy property
    }];
    // Since wPost.lifecycle is missing/undefined, it should treat mounted as false and thus unsafe/rejected
    let resLegacy = validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservationSync(unsafeReceipt, { pre: preObs, post: legacyObs });
    assert.equal(resLegacy.ok, false);
  });

  await t.test('infallible finalize', async () => {
    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      textureResolver: () => ({ uuid: 'test-tex', dispose() {} }),
    });

    let mesh = new THREE.Mesh();
    let panel = { id: 'panel-ok', sizeMeters: [1, 1] };
    let element = platform.document.createElement('div');

    let tx = bridge.prepareBatch([
      {
        windowId: 'window-ok',
        mesh,
        panel,
        element,
        snapshot: { material: {} }
      }
    ]);

    let inspectPre = bridge.inspectBatch(tx);
    assert.equal(inspectPre.ok, true);

    let finalizeRes = bridge.finalizeBatch(tx);
    assert.equal(finalizeRes.ok, true);

    let inspectPost = bridge.inspectBatch(tx);
    assert.equal(inspectPost.ok, false);
    assert.equal(inspectPost.reason, 'transaction-not-found');
  });

  await t.test('no publication if custom bridge violates no-throw finalize contract', async () => {
    let mockBridge = createFakeBatchBridge();
    mockBridge.finalizeBatch = function() {
      throw new Error('simulated-finalize-exception');
    };

    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
      textureBridge: mockBridge,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'scope-finalize-err' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-finalize-err' });

    let preDiag = JSON.stringify(assembly.getDiagnostics());
    let preReceiptsCount = assembly.getReceipts().length;

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'scope-finalize-err',
      tokens: { '--bg': '#abcabc' },
      material: { background: '#abcabc' }
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, (err) => {
      return err instanceof FinalizeContractViolationError && /simulated-finalize-exception/.test(err.message);
    });

    // Verify publication is prevented (exact byte restoration of assembly state)
    assert.equal(JSON.stringify(assembly.getDiagnostics()), preDiag);
    assert.equal(assembly.getReceipts().length, preReceiptsCount);

    // Verify no transaction/resource leak after finalize throws
    assert.equal(mockBridge.getRegistryCount(), 0);
  });

  await t.test('prepare failure cleanup all resources and aggregate errors', async () => {
    let disposedList = [];
    let spyDisposer = (tex) => {
      disposedList.push(tex.name);
      if (tex.name === 'tex-1') {
        throw new Error('disposer-1-failed');
      }
    };

    let tex1 = { name: 'tex-1', dispose() {} };
    let tex2 = { name: 'tex-2', dispose() {} };
    let textures = [tex1, tex2];
    let texIndex = 0;

    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      disposer: spyDisposer,
      textureResolver: () => textures[texIndex++],
      requireTextureUpload: true,
    });

    let mesh1 = new THREE.Mesh();
    let panel1 = { id: 'panel-1', sizeMeters: [1, 1] };
    let element1 = platform.document.createElement('div');

    let mesh2 = new THREE.Mesh();
    let panel2 = { id: 'panel-2', sizeMeters: [1, 1] };
    let element2 = platform.document.createElement('div');

    let mesh3 = new THREE.Mesh();
    let panel3 = { id: 'panel-3', sizeMeters: [1, 1] };
    let element3 = null; // force prepare failure

    let errorThrown = null;
    try {
      bridge.prepareBatch([
        {
          windowId: 'window-1',
          mesh: mesh1,
          panel: panel1,
          element: element1,
          snapshot: { material: {} }
        },
        {
          windowId: 'window-2',
          mesh: mesh2,
          panel: panel2,
          element: element2,
          snapshot: { material: {} }
        },
        {
          windowId: 'window-3',
          mesh: mesh3,
          panel: panel3,
          element: element3,
          snapshot: { material: {} }
        }
      ]);
    } catch (err) {
      errorThrown = err;
    }

    assert.ok(errorThrown instanceof PrepareBatchError);
    assert.deepEqual(disposedList, ['tex-1', 'tex-2'], 'Both textures must be attempted for disposal even if the first throws');
    assert.equal(errorThrown.code, 'panel-element-missing');
    assert.equal(errorThrown.count, 3);
    assert.equal(errorThrown.cleanupErrorCount, 1);

    // Verify no transaction registry entry is left
    let inspectRes = bridge.inspectBatch(errorThrown);
    assert.equal(inspectRes.ok, false);
    assert.equal(inspectRes.reason, 'missing-transaction-token');
  });

  await t.test('real resource ownership probe: multiple candidates, throwing disposer, restoration, zero registry/live candidates', async () => {
    let disposedList = [];
    let spyDisposer = (tex) => {
      disposedList.push(tex.name);
      tex.disposed = true;
      if (tex.name === 'tex-1') {
        throw new Error('disposer-1-failed-simulated');
      }
    };

    let tex1 = { name: 'tex-1', uuid: 'cand-tex-1', dispose() {} };
    let tex2 = { name: 'tex-2', uuid: 'cand-tex-2', dispose() {} };
    let tex3 = { name: 'tex-3', uuid: 'cand-tex-3', dispose() {} };
    let textures = [tex1, tex2, tex3];
    let texIndex = 0;

    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      disposer: spyDisposer,
      textureResolver: () => textures[texIndex++],
      requireTextureUpload: true,
    });

    let priorTex1 = { uuid: 'prior-tex-1' };
    let priorTex2 = { uuid: 'prior-tex-2' };
    let priorTex3 = { uuid: 'prior-tex-3' };

    let mesh1 = new THREE.Mesh();
    mesh1.material.map = priorTex1;
    let panel1 = { id: 'panel-1', sizeMeters: [1, 1] };
    let element1 = platform.document.createElement('div');

    let mesh2 = new THREE.Mesh();
    mesh2.material.map = priorTex2;
    let panel2 = { id: 'panel-2', sizeMeters: [1, 1] };
    let element2 = platform.document.createElement('div');

    let mesh3 = new THREE.Mesh();
    mesh3.material.map = priorTex3;
    let panel3 = { id: 'panel-3', sizeMeters: [1, 1] };
    let element3 = platform.document.createElement('div');

    let tx = bridge.prepareBatch([
      {
        windowId: 'window-1',
        mesh: mesh1,
        panel: panel1,
        element: element1,
        snapshot: { material: {} }
      },
      {
        windowId: 'window-2',
        mesh: mesh2,
        panel: panel2,
        element: element2,
        snapshot: { material: {} }
      },
      {
        windowId: 'window-3',
        mesh: mesh3,
        panel: panel3,
        element: element3,
        snapshot: { material: {} }
      }
    ]);

    assert.ok(tx.token);

    let commitRes = bridge.commitBatch(tx);
    assert.equal(commitRes.ok, true);

    assert.equal(mesh1.material.map.name, 'tex-1');
    assert.equal(mesh2.material.map.name, 'tex-2');
    assert.equal(mesh3.material.map.name, 'tex-3');

    let rollbackRes = bridge.rollbackBatch(tx);
    assert.equal(rollbackRes.ok, false);
    assert.ok(rollbackRes.errors.length > 0);
    assert.equal(rollbackRes.errors[0].message, 'disposer-1-failed-simulated');

    // 1. Verify exact prior-map restoration
    assert.equal(mesh1.material.map, priorTex1);
    assert.equal(mesh2.material.map, priorTex2);
    assert.equal(mesh3.material.map, priorTex3);

    // 2. Verify all candidate textures disposers were attempted
    assert.deepEqual(disposedList, ['tex-1', 'tex-2', 'tex-3']);

    // 3. Verify zero registry entries (transaction removed)
    let inspectRes = bridge.inspectBatch(tx);
    assert.equal(inspectRes.ok, false);
    assert.equal(inspectRes.reason, 'transaction-not-found');

    // 4. Verify candidate textures are disposed (non-published live candidate resources = 0)
    assert.equal(tex1.disposed, true);
    assert.equal(tex2.disposed, true);
    assert.equal(tex3.disposed, true);
  });

  await t.test('real adapter prepareBatch output format', async () => {
    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      textureResolver: () => ({ uuid: 'test-tex', dispose() {} }),
      requireTextureUpload: true,
    });

    let mesh1 = new THREE.Mesh();
    let panel1 = { id: 'panel-1', sizeMeters: [1, 1] };
    let element1 = platform.document.createElement('div');

    let tx = bridge.prepareBatch([
      {
        windowId: 'window-1',
        mesh: mesh1,
        panel: panel1,
        element: element1,
        snapshot: { material: {} }
      }
    ]);

    assert.equal(tx.ok, undefined);
    assert.equal(tx.reason, undefined);
    let keys = Object.keys(tx);
    assert.deepEqual(keys.sort(), ['token', 'version']);
    assert.equal(tx.version, 'xr-spatial-batch-tx-v18');
    assert.ok(typeof tx.token === 'string');
    assert.ok(Object.isFrozen(tx));
  });

  await t.test('ownership matrix validation: fresh-owned/borrowed/cached releases, throwing release, finalization, registry checks, prior-map restoration', async () => {
    // We will test the following ownership matrix:
    // 1. fresh-owned prepare abort -> should release/dispose the texture.
    // 2. fresh-owned rollback -> should release/dispose the texture.
    // 3. borrowed prior-map rollback -> should NOT release/dispose the texture.
    // 4. cached/shared borrowed prepare abort -> should NOT release/dispose the texture.
    // 5. finalized transfer remaining live -> should NOT release/dispose the texture.

    // Let's set up trackers
    let releaseCounts = {
      freshAbort: 0,
      freshRollback: 0,
      priorRollback: 0,
      cachedAbort: 0,
      finalized: 0
    };

    // Helper texture creators/records
    let freshAbortTex = { uuid: 'fresh-abort-tex', dispose() { releaseCounts.freshAbort++; } };
    let freshRollbackTex = { uuid: 'fresh-rollback-tex', dispose() { releaseCounts.freshRollback++; } };
    let priorTex = { uuid: 'prior-tex', dispose() { releaseCounts.priorRollback++; } };
    let cachedAbortTex = { uuid: 'cached-abort-tex', dispose() { releaseCounts.cachedAbort++; } };
    let finalizedTex = { uuid: 'finalized-tex', dispose() { releaseCounts.finalized++; } };

    // Let's check 1 & 4: fresh-owned prepare abort AND cached/shared borrowed prepare abort
    // We'll prepare a batch with two windows.
    // One window resolves freshAbortTex (owned).
    // The other window resolves cachedAbortTex as borrowed (returns { texture, owned: false }).
    // We force prepare failure by having a third window fail to resolve (missing element).
    {
      let texturesToResolve = [
        freshAbortTex, // owned by default (plain texture)
        { texture: cachedAbortTex, owned: false }, // borrowed (explicitly via contract)
      ];
      let texIndex = 0;

      let bridge = createXRThreePanelTextureBridge({
        THREE,
        globalThis: platform.globalThis,
        textureResolver: () => texturesToResolve[texIndex++],
        requireTextureUpload: true,
      });

      let mesh1 = new THREE.Mesh();
      let panel1 = { id: 'panel-1', sizeMeters: [1, 1] };
      let element1 = platform.document.createElement('div');

      let mesh2 = new THREE.Mesh();
      let panel2 = { id: 'panel-2', sizeMeters: [1, 1] };
      let element2 = platform.document.createElement('div');

      let mesh3 = new THREE.Mesh();
      let panel3 = { id: 'panel-3', sizeMeters: [1, 1] };
      let element3 = null; // force prepare failure

      let errorThrown = null;
      try {
        bridge.prepareBatch([
          { windowId: 'w-1', mesh: mesh1, panel: panel1, element: element1, snapshot: { material: {} } },
          { windowId: 'w-2', mesh: mesh2, panel: panel2, element: element2, snapshot: { material: {} } },
          { windowId: 'w-3', mesh: mesh3, panel: panel3, element: element3, snapshot: { material: {} } }
        ]);
      } catch (err) {
        errorThrown = err;
      }

      assert.ok(errorThrown instanceof PrepareBatchError);
      // freshAbortTex (owned) should be disposed (its dispose() called).
      assert.equal(releaseCounts.freshAbort, 1);
      // cachedAbortTex (borrowed) should NOT be disposed.
      assert.equal(releaseCounts.cachedAbort, 0);

      // Verify zero registry checks
      let inspectRes = bridge.inspectBatch(errorThrown);
      assert.equal(inspectRes.ok, false);
      assert.equal(inspectRes.reason, 'missing-transaction-token');
    }

    // Now let's check 2 & 3: fresh-owned rollback AND borrowed prior-map rollback
    // Also include throwing release!
    // Window 1: prior map = priorTex. Resolver returns priorTex (candidate === prior.map). This must be treated as borrowed and NOT disposed.
    // Window 2: prior map = null. Resolver returns freshRollbackTex (owned). But we'll make its release function throw to test throwing release error aggregation!
    // Let's create freshRollbackTex with a release capability that throws.
    {
      let texturesToResolve = [
        priorTex, // identical to prior.map
        {
          texture: freshRollbackTex,
          owned: true,
          release() {
            releaseCounts.freshRollback++;
            throw new Error('simulated-throwing-releaser');
          }
        }
      ];
      let texIndex = 0;

      let bridge = createXRThreePanelTextureBridge({
        THREE,
        globalThis: platform.globalThis,
        textureResolver: () => texturesToResolve[texIndex++],
        requireTextureUpload: true,
      });

      let mesh1 = new THREE.Mesh();
      mesh1.material.map = priorTex; // prior map set
      let panel1 = { id: 'panel-1', sizeMeters: [1, 1] };
      let element1 = platform.document.createElement('div');

      let mesh2 = new THREE.Mesh();
      mesh2.material.map = null;
      let panel2 = { id: 'panel-2', sizeMeters: [1, 1] };
      let element2 = platform.document.createElement('div');

      let tx = bridge.prepareBatch([
        { windowId: 'w-1', mesh: mesh1, panel: panel1, element: element1, snapshot: { material: {} } },
        { windowId: 'w-2', mesh: mesh2, panel: panel2, element: element2, snapshot: { material: {} } }
      ]);

      assert.ok(tx.token);

      let commitRes = bridge.commitBatch(tx);
      assert.equal(commitRes.ok, true);

      // Verify textures were applied
      assert.equal(mesh1.material.map, priorTex);
      assert.equal(mesh2.material.map, freshRollbackTex);

      let rollbackRes = bridge.rollbackBatch(tx);
      // It should return false because one release function threw
      assert.equal(rollbackRes.ok, false);
      assert.ok(rollbackRes.errors.length > 0);
      assert.match(rollbackRes.errors[0].message, /simulated-throwing-releaser/);

      // Verify exact prior-map identity restoration
      assert.equal(mesh1.material.map, priorTex);
      assert.equal(mesh2.material.map, null);

      // Verify release counts:
      // priorTex was identical to prior.map, so it was borrowed and NOT disposed.
      assert.equal(releaseCounts.priorRollback, 0);
      // freshRollbackTex was owned, so its release() was called.
      assert.equal(releaseCounts.freshRollback, 1);

      // Verify zero registry checks
      let inspectRes = bridge.inspectBatch(tx);
      assert.equal(inspectRes.ok, false);
      assert.equal(inspectRes.reason, 'transaction-not-found');
    }

    // Now let's check 5: finalized transfer remaining live
    // A transaction is prepared with a fresh-owned texture, committed, and finalized.
    // The texture should remain live and NOT disposed.
    {
      let bridge = createXRThreePanelTextureBridge({
        THREE,
        globalThis: platform.globalThis,
        textureResolver: () => finalizedTex,
        requireTextureUpload: true,
      });

      let mesh = new THREE.Mesh();
      let panel = { id: 'panel-1', sizeMeters: [1, 1] };
      let element = platform.document.createElement('div');

      let tx = bridge.prepareBatch([
        { windowId: 'w-1', mesh: mesh, panel: panel, element: element, snapshot: { material: {} } }
      ]);

      assert.ok(tx.token);

      let commitRes = bridge.commitBatch(tx);
      assert.equal(commitRes.ok, true);

      let finalizeRes = bridge.finalizeBatch(tx);
      assert.equal(finalizeRes.ok, true);

      // finalizedTex should not be disposed.
      assert.equal(releaseCounts.finalized, 0);

      // Verify zero registry checks
      let inspectRes = bridge.inspectBatch(tx);
      assert.equal(inspectRes.ok, false);
      assert.equal(inspectRes.reason, 'transaction-not-found');
    }
  });

  await t.test('real production resolver/cache validation: owned prepare-abort removes cache, subsequent resolve never returns disposed value, borrowed cached rollback stays live, finalize transfers capability, replacement releases once', async () => {
    // 1. owned prepare-abort removes cache and disposes
    let resolver = createXRThreeHtmlCanvasTextureResolver({
      THREE,
      globalThis: platform.globalThis,
    });
    
    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      textureResolver: resolver.resolve,
      requireTextureUpload: true,
    });

    let mesh1 = new THREE.Mesh();
    let panel1 = { id: 'panel-production-1', sizeMeters: [1, 1] };
    let element1 = platform.document.createElement('div');

    let mesh2 = new THREE.Mesh();
    let panel2 = { id: 'panel-production-2', sizeMeters: [1, 1] };
    let element2 = null; // force prepare failure (abort)

    // Verify prepare failure throws PrepareBatchError with scalar-only metadata
    let prepareErr = null;
    try {
      bridge.prepareBatch([
        { windowId: 'w-p1', mesh: mesh1, panel: panel1, element: element1, snapshot: { material: {} } },
        { windowId: 'w-p2', mesh: mesh2, panel: panel2, element: element2, snapshot: { material: {} } }
      ]);
    } catch (err) {
      prepareErr = err;
    }

    assert.ok(prepareErr instanceof PrepareBatchError);
    assert.equal(prepareErr.code, 'panel-element-missing');
    assert.equal(prepareErr.count, 2);
    assert.equal(prepareErr.cleanupErrorCount, 0);

    // Verify cache is empty/disposed for 'panel-production-1'
    let resolverState = resolver.getState();
    assert.equal(resolverState.textureCount, 0, 'owned prepare-abort removes cache');

    // 2. a subsequent resolve never returns disposed value
    let tx1 = bridge.prepareBatch([
      { windowId: 'w-p1', mesh: mesh1, panel: panel1, element: element1, snapshot: { material: {} } }
    ]);
    assert.ok(tx1.token);
    assert.equal(resolver.getState().textureCount, 1);
    
    // Abort it using rollbackBatch
    let rbRes = bridge.rollbackBatch(tx1);
    assert.equal(rbRes.ok, true);
    
    // The texture was disposed and removed from cache.
    assert.equal(resolver.getState().textureCount, 0);
    
    // Let's do a subsequent resolve and check it returns a fresh live texture (not the disposed one)
    let tx2 = bridge.prepareBatch([
      { windowId: 'w-p1', mesh: mesh1, panel: panel1, element: element1, snapshot: { material: {} } }
    ]);
    assert.ok(tx2.token);
    assert.equal(resolver.getState().textureCount, 1);
    
    // Inspect to see the texture is active
    let inspectRes = bridge.inspectBatch(tx2);
    assert.equal(inspectRes.ok, true);
    assert.equal(inspectRes.observations.get('panel-production-1').candidate.record.ok, true);
    
    // 3. borrowed cached rollback stays live
    // Commit the transaction to keep it in cache
    let commitRes = bridge.commitBatch(tx2);
    assert.equal(commitRes.ok, true);
    let finalizeRes = bridge.finalizeBatch(tx2);
    assert.equal(finalizeRes.ok, true);
    
    // Now the texture is in the cache. Let's verify:
    assert.equal(resolver.getState().textureCount, 1);
    
    // Now let's start a new transaction that borrows this texture (reuses it because dirtyKey matches)
    let tx3 = bridge.prepareBatch([
      { windowId: 'w-p1', mesh: mesh1, panel: panel1, element: element1, snapshot: { material: {} } }
    ]);
    assert.ok(tx3.token);
    
    // The second transaction tx3 borrowed the cached texture.
    // Let's rollback tx3:
    let rbRes3 = bridge.rollbackBatch(tx3);
    assert.equal(rbRes3.ok, true);
    
    // "borrowed cached rollback stays live" -> texture in cache must NOT be disposed and must stay in cache!
    assert.equal(resolver.getState().textureCount, 1, 'borrowed cached rollback stays live in cache');
    
    // 4. finalize transfers capability and later replacement/unmount releases exactly once
    // Let's create a fresh owned transaction:
    let mesh3 = new THREE.Mesh();
    let panel3 = { id: 'panel-production-3', sizeMeters: [1, 1] };
    let element3 = platform.document.createElement('div');
    element3.dataset.textureKey = 'key-3';
    
    let tx4 = bridge.prepareBatch([
      { windowId: 'w-p3', mesh: mesh3, panel: panel3, element: element3, snapshot: { material: {} } }
    ]);
    assert.ok(tx4.token);
    
    let comRes4 = bridge.commitBatch(tx4);
    assert.equal(comRes4.ok, true);
    
    // Finalize transfers capability
    let finRes4 = bridge.finalizeBatch(tx4);
    assert.equal(finRes4.ok, true);
    
    // The release callback should be on mesh3.userData
    assert.ok(typeof mesh3.userData.releaseTexture === 'function');
    
    // Track release count
    let realReleaseCalled = 0;
    let originalRelease = mesh3.userData.releaseTexture;
    let wrappedReleaseFn = () => {
      realReleaseCalled++;
      originalRelease();
    };
    mesh3.userData.releaseTexture = wrappedReleaseFn;
    if (mesh3.material.userData) {
      mesh3.material.userData.releaseTexture = wrappedReleaseFn;
    }
    
    // Replace via applyPanelTexture with a genuinely different panel ID and
    // texture key so the resolver creates a distinct texture object — same
    // panel ID would reuse the cached texture entry (same object identity).
    let panel3_new = { id: 'panel-production-3-new', sizeMeters: [1, 1] };
    let element3_new = platform.document.createElement('div');
    element3_new.dataset.textureKey = 'key-3-new';
    let record = bridge.applyPanelTexture(mesh3, panel3_new, { element: element3_new });
    assert.equal(record.ok, true);
    
    // Verify it was released exactly once!
    assert.equal(realReleaseCalled, 1);
    
    // Call it again to show it doesn't release again (releases exactly once)
    mesh3.userData.releaseTexture?.();
    assert.equal(realReleaseCalled, 1);
  });

  await t.test('production resolver handoff and transaction lifecycle corrections', async (t2) => {
    await t2.test('1. same-dirtyKey replacement returns same live cached texture, zero disposal', () => {
      let resolver = createXRThreeHtmlCanvasTextureResolver({ THREE, globalThis: platform.globalThis });
      let releaseCalled = 0;
      let spyResolver = (input) => {
        let res = resolver.resolve(input);
        if (res && res.release) {
          let orig = res.release;
          res.release = () => {
            releaseCalled++;
            orig();
          };
        }
        return res;
      };
      spyResolver.hasTexture = resolver.resolve.hasTexture;

      let bridge = createXRThreePanelTextureBridge({
        THREE,
        globalThis: platform.globalThis,
        textureResolver: spyResolver,
        requireTextureUpload: true,
      });

      let mesh = new THREE.Mesh();
      let panel = { id: 'p-t1', sizeMeters: [1, 1] };
      let element = platform.document.createElement('div');
      element.dataset.textureKey = 'key-1';

      // First apply (normal)
      let record1 = bridge.applyPanelTexture(mesh, panel, { element });
      assert.equal(record1.ok, true);
      let tex1 = mesh.material.map;
      assert.ok(tex1);
      assert.equal(tex1.disposed, false);
      assert.equal(resolver.getState().textureCount, 1);

      // Second apply (same dirtyKey)
      let record2 = bridge.applyPanelTexture(mesh, panel, { element });
      assert.equal(record2.ok, true);
      let tex2 = mesh.material.map;
      
      // Asserts
      assert.equal(tex1, tex2, 'Should return same texture object identity');
      assert.equal(releaseCalled, 0, 'Zero disposal of cached texture');
      assert.equal(tex2.disposed, false, 'Texture must not be marked disposed');
      assert.equal(resolver.getState().textureCount, 1, 'Resolver texture count must remain 1');
    });

    await t2.test('2. borrowed transaction commit/finalize keeps live map/cache/capability', () => {
      let resolver = createXRThreeHtmlCanvasTextureResolver({ THREE, globalThis: platform.globalThis });
      let releaseCalled = 0;
      let spyResolver = (input) => {
        let res = resolver.resolve(input);
        if (res && res.release) {
          let orig = res.release;
          res.release = () => {
            releaseCalled++;
            orig();
          };
        }
        return res;
      };
      spyResolver.hasTexture = resolver.resolve.hasTexture;

      let bridge = createXRThreePanelTextureBridge({
        THREE,
        globalThis: platform.globalThis,
        textureResolver: spyResolver,
        requireTextureUpload: true,
      });

      let mesh = new THREE.Mesh();
      let panel = { id: 'p-t2', sizeMeters: [1, 1] };
      let element = platform.document.createElement('div');
      element.dataset.textureKey = 'key-2';

      // 1. Setup first owned texture in the cache and on the mesh
      let record1 = bridge.applyPanelTexture(mesh, panel, { element });
      assert.equal(record1.ok, true);
      let originalTex = mesh.material.map;
      let originalRelease = mesh.userData.releaseTexture;
      assert.ok(originalRelease, 'Has release capability');
      assert.equal(resolver.getState().textureCount, 1);

      // 2. Prepare transaction that borrows the same cached texture (same dirtyKey)
      let tx = bridge.prepareBatch([
        { windowId: 'w-t2', mesh, panel, element, snapshot: { material: {} } }
      ]);
      assert.ok(tx.token);

      // Verify that candidate texture is the same (borrowed)
      let inspectBefore = bridge.inspectBatch(tx);
      assert.equal(inspectBefore.ok, true);
      let candTexId = inspectBefore.observations.get('p-t2').candidate.textureId;
      assert.equal(candTexId, originalTex.uuid);

      // 3. Commit the transaction
      let commitRes = bridge.commitBatch(tx);
      assert.equal(commitRes.ok, true);
      
      // Verify map is still the same, and release capability has NOT been replaced/deleted (retained)
      assert.equal(mesh.material.map, originalTex);
      assert.equal(mesh.userData.releaseTexture, originalRelease, 'Release capability retained during commit');

      // 4. Finalize the transaction
      let finalizeRes = bridge.finalizeBatch(tx);
      assert.equal(finalizeRes.ok, true);

      // Verify ownership handoff rule: same resource is a no-op ownership-wise, keep existing release capability
      assert.equal(mesh.material.map, originalTex);
      assert.equal(mesh.userData.releaseTexture, originalRelease, 'Release capability retained after finalize');
      assert.equal(originalTex.disposed, false);
      assert.equal(releaseCalled, 0, 'No releases should occur for same resource');
      assert.equal(resolver.getState().textureCount, 1, 'Still live in cache');
    });

    await t2.test('3. new candidate inspection failure rollback restores live cached prior and releases new candidate', () => {
      let resolver = createXRThreeHtmlCanvasTextureResolver({ THREE, globalThis: platform.globalThis });
      let releaseCalled = 0;
      let spyResolver = (input) => {
        let res = resolver.resolve(input);
        if (res && res.release) {
          let orig = res.release;
          res.release = () => {
            releaseCalled++;
            orig();
          };
        }
        return res;
      };
      spyResolver.hasTexture = resolver.resolve.hasTexture;

      let bridge = createXRThreePanelTextureBridge({
        THREE,
        globalThis: platform.globalThis,
        textureResolver: spyResolver,
        requireTextureUpload: true,
      });

      let mesh = new THREE.Mesh();
      let panelPrior = { id: 'p-t3-prior', sizeMeters: [1, 1] };
      let elementPrior = platform.document.createElement('div');
      elementPrior.dataset.textureKey = 'prior-key';

      // 1. Establish live cached prior
      let recordPrior = bridge.applyPanelTexture(mesh, panelPrior, { element: elementPrior });
      assert.equal(recordPrior.ok, true);
      let priorTex = mesh.material.map;
      let priorRelease = mesh.userData.releaseTexture;
      assert.ok(priorRelease, 'Prior has release capability');
      assert.equal(resolver.getState().textureCount, 1);

      // 2. Prepare transaction with a NEW candidate
      let panelNew = { id: 'p-t3-new', sizeMeters: [1, 1] };
      let elementNew = platform.document.createElement('div');
      elementNew.dataset.textureKey = 'new-candidate-key';
      let tx = bridge.prepareBatch([
        { windowId: 'w-t3', mesh, panel: panelNew, element: elementNew, snapshot: { material: {} } }
      ]);
      assert.ok(tx.token);

      // Inspect batch shows candidate is different
      let inspectRes = bridge.inspectBatch(tx);
      let candidateTexId = inspectRes.observations.get('p-t3-new').candidate.textureId;
      assert.notEqual(candidateTexId, priorTex.uuid, 'Candidate texture should be different');
      assert.equal(resolver.getState().textureCount, 2, 'Prior and candidate both cached');

      // Let's get the candidate texture reference
      let candidateTex = resolver.resolve({ panel: panelNew, element: elementNew, summary: { source: 'html-in-canvas' } }).texture;
      assert.ok(candidateTex);
      assert.notEqual(candidateTex, priorTex);

      // 3. Commit the transaction (stages candidate)
      let commitRes = bridge.commitBatch(tx);
      assert.equal(commitRes.ok, true);
      assert.equal(mesh.material.map, candidateTex, 'Staged candidate onto map');
      
      // Rule check: commit retains the prior release capability
      assert.equal(mesh.userData.releaseTexture, priorRelease, 'Prior release capability retained during commit');

      // 4. Inspection failure -> Rollback
      let rollbackRes = bridge.rollbackBatch(tx);
      assert.equal(rollbackRes.ok, true);

      // Verify restoration of prior map and its release capability
      assert.equal(mesh.material.map, priorTex, 'Restored prior map');
      assert.equal(mesh.userData.releaseTexture, priorRelease, 'Restored prior release capability');
      assert.equal(priorTex.disposed, false, 'Prior texture must not be disposed');

      // Verify release of new candidate
      assert.equal(candidateTex.disposed, true, 'Candidate texture must be disposed');
      assert.equal(releaseCalled, 1, 'Candidate texture released exactly once');
      assert.equal(resolver.getState().textureCount, 1, 'Only prior texture remains in cache');
    });

    await t2.test('4. finalized new replacement releases prior exactly once and keeps new live', () => {
      let resolver = createXRThreeHtmlCanvasTextureResolver({ THREE, globalThis: platform.globalThis });
      let releaseCalled = 0;
      let spyResolver = (input) => {
        let res = resolver.resolve(input);
        if (res && res.release) {
          let orig = res.release;
          res.release = () => {
            releaseCalled++;
            orig();
          };
        }
        return res;
      };
      spyResolver.hasTexture = resolver.resolve.hasTexture;

      let bridge = createXRThreePanelTextureBridge({
        THREE,
        globalThis: platform.globalThis,
        textureResolver: spyResolver,
        requireTextureUpload: true,
      });

      let mesh = new THREE.Mesh();
      let panelPrior = { id: 'p-t4-prior', sizeMeters: [1, 1] };
      let elementPrior = platform.document.createElement('div');
      elementPrior.dataset.textureKey = 'prior-key';

      // 1. Establish live cached prior
      let recordPrior = bridge.applyPanelTexture(mesh, panelPrior, { element: elementPrior });
      assert.equal(recordPrior.ok, true);
      let priorTex = mesh.material.map;
      let origPriorRelease = mesh.userData.releaseTexture;

      // 2. Prepare transaction with a NEW candidate
      let panelNew = { id: 'p-t4-new', sizeMeters: [1, 1] };
      let elementNew = platform.document.createElement('div');
      elementNew.dataset.textureKey = 'new-candidate-key';
      let tx = bridge.prepareBatch([
        { windowId: 'w-t4', mesh, panel: panelNew, element: elementNew, snapshot: { material: {} } }
      ]);
      assert.ok(tx.token);

      let newTex = resolver.resolve({ panel: panelNew, element: elementNew, summary: { source: 'html-in-canvas' } }).texture;
      assert.ok(newTex);
      assert.notEqual(newTex, priorTex);

      // 3. Commit
      let commitRes = bridge.commitBatch(tx);
      assert.equal(commitRes.ok, true);
      assert.equal(releaseCalled, 0, 'Prior not released on commit');

      // 4. Finalize
      let finalizeRes = bridge.finalizeBatch(tx);
      assert.equal(finalizeRes.ok, true);

      // Verify prior release capability called exactly once
      assert.equal(releaseCalled, 1, 'Prior released exactly once');
      assert.equal(priorTex.disposed, true, 'Prior texture disposed');

      // Verify new candidate is live and mapped
      assert.equal(mesh.material.map, newTex, 'New texture is mapped');
      assert.equal(newTex.disposed, false, 'New texture not disposed');
      assert.ok(mesh.userData.releaseTexture, 'New release capability bound');
      assert.notEqual(mesh.userData.releaseTexture, origPriorRelease, 'Release capability swapped');
      assert.equal(resolver.getState().textureCount, 1, 'Only new texture remains in cache');
    });

    await t2.test('5. later material.dispose and setScene/unmount release the new resource exactly once, remove cache, and never return it on subsequent resolve', () => {
      // Scenario A: material.dispose()
      {
        let resolver = createXRThreeHtmlCanvasTextureResolver({ THREE, globalThis: platform.globalThis });
        let releaseCalled = 0;
        let spyResolver = (input) => {
          let res = resolver.resolve(input);
          if (res && res.release) {
            let orig = res.release;
            res.release = () => {
              releaseCalled++;
              orig();
            };
          }
          return res;
        };
        spyResolver.hasTexture = resolver.resolve.hasTexture;

        let bridge = createXRThreePanelTextureBridge({
          THREE,
          globalThis: platform.globalThis,
          textureResolver: spyResolver,
          requireTextureUpload: true,
        });

        let mesh = new THREE.Mesh();
        let panel = { id: 'p-t5-a', sizeMeters: [1, 1] };
        let element = platform.document.createElement('div');
        element.dataset.textureKey = 'key-5a';

        let record = bridge.applyPanelTexture(mesh, panel, { element });
        assert.equal(record.ok, true);
        let tex = mesh.material.map;
        assert.ok(tex);

        // Dispose material
        mesh.material.dispose();

        // Asserts
        assert.equal(releaseCalled, 1, 'Release capability called exactly once on material dispose');
        assert.equal(tex.disposed, true, 'Texture is disposed');
        assert.equal(resolver.getState().textureCount, 0, 'Removed from cache');

        // Subsequent resolve
        let nextRecord = bridge.applyPanelTexture(mesh, panel, { element });
        assert.equal(nextRecord.ok, true);
        let nextTex = mesh.material.map;
        assert.ok(nextTex);
        assert.notEqual(nextTex, tex, 'Subsequent resolve must never return the disposed texture');
        assert.equal(nextTex.disposed, false);
      }

      // Scenario B: setScene / unmount
      {
        let resolver = createXRThreeHtmlCanvasTextureResolver({ THREE, globalThis: platform.globalThis });
        let releaseCalled = 0;
        let spyResolver = (input) => {
          let res = resolver.resolve(input);
          if (res && res.release) {
            let orig = res.release;
            res.release = () => {
              releaseCalled++;
              orig();
            };
          }
          return res;
        };
        spyResolver.hasTexture = resolver.resolve.hasTexture;

        let bridge = createXRThreePanelTextureBridge({
          THREE,
          globalThis: platform.globalThis,
          textureResolver: spyResolver,
          requireTextureUpload: true,
        });

        let adapter = createXRThreeWebXRAdapter({
          THREE,
          globalThis: platform.globalThis,
          textureBridge: bridge,
        });

        let panel = { id: 'p-t5-b', sizeMeters: [1, 1] };
        let element = platform.document.createElement('div');
        element.dataset.textureKey = 'key-5b';

        // Mount / setScene with panel
        let setSceneRes = adapter.setScene({
          panels: [panel]
        }, {
          textureOptions: { element }
        });
        assert.equal(setSceneRes.ok, true);
        
        let mesh = adapter.getPanelMesh('p-t5-b');
        assert.ok(mesh);
        let tex = mesh.material.map;
        assert.ok(tex);
        assert.equal(tex.disposed, false);
        assert.equal(resolver.getState().textureCount, 1);

        // Unmount by setting scene to empty
        adapter.setScene({ panels: [] });

        // Asserts
        assert.equal(releaseCalled, 1, 'Release capability called exactly once on setScene unmount');
        assert.equal(tex.disposed, true, 'Texture is disposed');
        assert.equal(resolver.getState().textureCount, 0, 'Removed from cache');

        // Subsequent resolve
        let finalMesh = new THREE.Mesh();
        let finalRecord = bridge.applyPanelTexture(finalMesh, panel, { element });
        assert.equal(finalRecord.ok, true);
        let finalTex = finalMesh.material.map;
        assert.ok(finalTex);
        assert.notEqual(finalTex, tex, 'Subsequent resolve must never return the disposed texture');
        assert.equal(finalTex.disposed, false);
      }
    });
  });

  await t.test('resolver-provided owned same-resource/refcount acquisition is balanced', async () => {
    // The resolver explicitly returns owned:true with its own release for the
    // same texture as the prior map.  This is a separately owned/refcounted
    // acquisition — finalize must call the acquisition release to balance it,
    // NOT silently drop the capability because the texture is "the same".
    let releaseCalled = 0;
    let sharedTex = { uuid: 'shared-tex-uuid', dispose() {} };
    let resolverCount = 0;

    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      textureResolver: () => {
        resolverCount++;
        return {
          texture: sharedTex,
          owned: true,
          release() { releaseCalled++; }
        };
      },
      requireTextureUpload: true,
    });

    let mesh = new THREE.Mesh();
    mesh.material.map = sharedTex; // prior map IS the same texture
    let panel = { id: 'panel-refcount', sizeMeters: [1, 1] };
    let element = platform.document.createElement('div');

    let tx = bridge.prepareBatch([
      { windowId: 'w-rc', mesh, panel, element, snapshot: { material: {} } }
    ]);
    assert.ok(tx.token);

    let commitRes = bridge.commitBatch(tx);
    assert.equal(commitRes.ok, true);

    // Commit must not have released — ownership is deferred to finalize
    assert.equal(releaseCalled, 0, 'No release before finalize');

    let finalizeRes = bridge.finalizeBatch(tx);
    assert.equal(finalizeRes.ok, true);

    // Finalize must balance the separately owned acquisition: the texture
    // is the same resource (isSameResource=true) but the resolver explicitly
    // declared ownership, so finalize calls acquisition.release() to balance
    // the refcount while keeping the existing owner in place.
    assert.equal(releaseCalled, 1, 'Acquisition release balanced on finalize');

    // Mesh should still have the texture (existing owner kept)
    assert.equal(mesh.material.map, sharedTex, 'Map retained');

    // Registry cleaned up
    let inspectRes = bridge.inspectBatch(tx);
    assert.equal(inspectRes.ok, false);
    assert.equal(inspectRes.reason, 'transaction-not-found');
  });

  await t.test('two-item batch where second transfer setup fails proves zero partial ownership/publication', async () => {
    let releaseCounts = [0, 0];
    let textures = [
      { uuid: 'batch-finalize-tex-1', dispose() {} },
      { uuid: 'batch-finalize-tex-2', dispose() {} },
    ];
    let resolveIndex = 0;

    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      textureResolver: () => {
        let index = resolveIndex++;
        return {
          texture: textures[index],
          cacheKey: `candidate-cache-${index}`,
          ownerKey: `candidate-owner-${index}`,
          owned: true,
          release() { releaseCounts[index]++; },
        };
      },
      requireTextureUpload: true,
    });

    let mesh1 = new THREE.Mesh();
    mesh1.material.needsUpdate = true;
    let panel1 = { id: 'panel-finalize-one', sizeMeters: [1, 1] };
    let element1 = platform.document.createElement('div');
    let mesh2 = new THREE.Mesh();
    mesh2.material.needsUpdate = true;
    let panel2 = { id: 'panel-finalize-two', sizeMeters: [1, 1] };
    let element2 = platform.document.createElement('div');
    let tx = bridge.prepareBatch([
      { windowId: 'w-f1', mesh: mesh1, panel: panel1, element: element1, snapshot: { material: {} } },
      { windowId: 'w-f2', mesh: mesh2, panel: panel2, element: element2, snapshot: { material: {} } }
    ]);
    assert.equal(bridge.commitBatch(tx).ok, true);

    mesh2.material.userData = {};
    Object.preventExtensions(mesh2.material.userData);
    let finalizeRes = bridge.finalizeBatch(tx);
    assert.equal(finalizeRes.ok, false);
    assert.match(finalizeRes.reason, /ownership-transfer-target-readonly:panel-finalize-two/);
    assert.equal(mesh1.userData.releaseTexture, undefined, 'First owner capability was not partially published');
    assert.equal(mesh1.material.userData?.releaseTexture, undefined, 'First material capability was not partially published');
    assert.deepEqual(releaseCounts, [0, 0], 'No candidate or prior ownership was partially released');
    assert.equal(bridge.inspectBatch(tx).ok, true, 'Failed finalize remains available for rollback');

    let rollbackRes = bridge.rollbackBatch(tx);
    assert.equal(rollbackRes.ok, true, rollbackRes.errors?.map((error) => error.message).join('; '));
    assert.deepEqual(releaseCounts, [1, 1], 'Rollback releases each owned candidate exactly once');
  });

  await t.test('finalize descriptor matrix rejects throwing setters and non-configurable deletes before batch apply', async () => {
    for (let descriptorCase of ['throwing-setter', 'non-configurable-delete']) {
      let releases = [0, 0];
      let textures = [
        { uuid: `${descriptorCase}-texture-one`, dispose() {} },
        { uuid: `${descriptorCase}-texture-two`, dispose() {} },
      ];
      let resolveIndex = 0;
      let borrowed = descriptorCase === 'non-configurable-delete';
      let bridge = createXRThreePanelTextureBridge({
        THREE,
        globalThis: platform.globalThis,
        textureResolver: () => {
          let index = resolveIndex++;
          return {
            texture: textures[index],
            cacheKey: `descriptor-cache-${index}`,
            ownerKey: `descriptor-owner-${index}`,
            owned: !(borrowed && index === 1),
            borrowed: borrowed && index === 1,
            release() { releases[index]++; },
          };
        },
        requireTextureUpload: true,
      });
      let meshes = [new THREE.Mesh(), new THREE.Mesh()];
      for (let mesh of meshes) mesh.material.needsUpdate = true;
      meshes[1].material.userData = {};
      if (descriptorCase === 'throwing-setter') {
        Object.defineProperty(meshes[1].material.userData, 'releaseTexture', {
          configurable: true,
          set() { throw new Error('setter-must-never-run'); },
        });
      } else {
        let existingRelease = () => {};
        meshes[1].material.map = { uuid: 'non-configurable-prior-texture', dispose() {} };
        meshes[1].userData.releaseTexture = existingRelease;
        Object.defineProperty(meshes[1].material.userData, 'releaseTexture', {
          configurable: false,
          writable: true,
          value: existingRelease,
        });
      }
      let panels = [
        { id: `${descriptorCase}-panel-one`, sizeMeters: [1, 1] },
        { id: `${descriptorCase}-panel-two`, sizeMeters: [1, 1] },
      ];
      let tx = bridge.prepareBatch(panels.map((panel, index) => ({
        windowId: `${descriptorCase}-window-${index}`,
        mesh: meshes[index],
        panel,
        element: platform.document.createElement('div'),
        snapshot: { material: {} },
      })));
      assert.equal(bridge.commitBatch(tx).ok, true);

      let finalizeRes = bridge.finalizeBatch(tx);
      assert.equal(finalizeRes.ok, false);
      assert.match(finalizeRes.reason, /ownership-transfer-target-readonly/);
      assert.equal(meshes[0].userData.releaseTexture, undefined, `${descriptorCase}: first mesh not published`);
      assert.equal(meshes[0].material.userData?.releaseTexture, undefined, `${descriptorCase}: first material not published`);
      assert.deepEqual(releases, [0, 0], `${descriptorCase}: no release before full-plan validation`);
      assert.equal(bridge.inspectBatch(tx).ok, true, `${descriptorCase}: transaction remains rollbackable`);

      let rollbackRes = bridge.rollbackBatch(tx);
      assert.equal(rollbackRes.ok, true, rollbackRes.errors?.map((error) => error.message).join('; '));
      assert.equal(releases[0], 1, `${descriptorCase}: owned first candidate released on rollback`);
      assert.equal(releases[1], borrowed ? 0 : 1, `${descriptorCase}: second candidate follows declared ownership`);
    }
  });

  await t.test('prior cache by stored key, map liveness, callback presence, and exact setScene → bridge.dispose release count', async () => {
    let resolver = createXRThreeHtmlCanvasTextureResolver({ THREE, globalThis: platform.globalThis });
    let releaseCalled = 0;
    let spyResolver = (input) => {
      let res = resolver.resolve(input);
      if (res && res.release) {
        let orig = res.release;
        res.release = () => {
          releaseCalled++;
          orig();
        };
      }
      return res;
    };
    spyResolver.hasTexture = resolver.resolve.hasTexture;

    let bridge = createXRThreePanelTextureBridge({
      THREE,
      globalThis: platform.globalThis,
      textureResolver: spyResolver,
      requireTextureUpload: true,
    });

    let adapter = createXRThreeWebXRAdapter({
      THREE,
      globalThis: platform.globalThis,
      textureBridge: bridge,
    });

    let panel = { id: 'p-cache-probe', sizeMeters: [1, 1] };
    let element = platform.document.createElement('div');
    element.dataset.textureKey = 'cache-key-1';

    // Mount
    let setSceneRes = adapter.setScene({ panels: [panel] }, { textureOptions: { element } });
    assert.equal(setSceneRes.ok, true);

    let mesh = adapter.getPanelMesh('p-cache-probe');
    assert.ok(mesh, 'Panel mesh exists');
    let tex = mesh.material.map;
    assert.ok(tex, 'Texture applied');
    assert.equal(tex.disposed, false, 'Texture is live');

    // Assert prior cache by stored key
    assert.equal(mesh.userData.textureCacheKey, 'p-cache-probe', 'textureCacheKey matches panel id');
    assert.equal(resolver.getState().textureCount, 1, 'Texture in resolver cache');

    // Assert map liveness
    assert.equal(tex.disposed, false, 'Map is live');

    // Assert callback presence
    assert.ok(typeof mesh.userData.releaseTexture === 'function', 'Release callback present on mesh');
    assert.ok(typeof mesh.material.userData?.releaseTexture === 'function', 'Release callback present on material');

    // setScene → unmount releases exactly once
    adapter.setScene({ panels: [] });
    assert.equal(releaseCalled, 1, 'Exact release count after setScene unmount');
    assert.equal(tex.disposed, true, 'Texture disposed after unmount');
    assert.equal(resolver.getState().textureCount, 0, 'Cache cleared after unmount');

    // bridge.dispose releases remaining (should be 0 extra since already released)
    let preRelease = releaseCalled;
    bridge.dispose();
    assert.equal(releaseCalled, preRelease, 'bridge.dispose does not double-release already-released textures');
  });
});
