import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateXRSpatialWindowThemeRedrawReceipt,
  validateXRSpatialWindowThemeRedrawReceiptSelfConsistency,
  validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservation,
  validateXRSpatialWindowDiagnostics,
  validateXRSpatialWindowDiagnosticsSelfConsistency,
  validateXRSpatialWindowDiagnosticsAgainstTrustedObservation,
  computeXREvidenceDigest,
  computeXREvidenceDigestSync,
  digest,
  sha256Sync,
} from '../xr/spatial-window-contract.js';
import { createXRSpatialWindowAssembly } from '../xr/spatial-window-assembly.js';
import {
  createFakeXrPlatform,
  createLayoutDescriptor,
  createWindowContentElement,
  createFakeThree,
} from './xr-spatial-window-fixtures.js';

test('Focused adversarial validation corrections v5', async (t) => {
  // Setup standard assembly and windows
  let platform = createFakeXrPlatform({ mode: 'webgl' });
  let THREE = createFakeThree();
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

  assembly.enter({ sessionId: 'session-focused' });

  // Apply theme to generate a valid theme-redraw receipt
  let themeInput = {
    version: 'xr-theme-snapshot-v1',
    themeScope: 'alpha-scope',
    tokens: { '--bg': '#ff0000' },
    material: { background: '#ff0000', backgroundColor: 0xff0000 },
  };

  let preObservation = JSON.parse(JSON.stringify(assembly.getDiagnostics().windows));

  assembly.applyTheme(themeInput);

  let redrawReceipt = assembly.getReceipts().find((r) => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
  assert.ok(redrawReceipt, 'Theme redraw receipt must be emitted');

  // Let's get the trusted windows state (observation)
  let postObservation = JSON.parse(JSON.stringify(assembly.getDiagnostics().windows));
  let trustedObservation = { pre: preObservation, post: postObservation };

  await t.test('1. Mutated receipt with full digest recomputation fails against original observation', async () => {
    // 1.1 Scope mutation
    let mutatedScope = JSON.parse(JSON.stringify(redrawReceipt));
    mutatedScope.themeScope = 'beta-scope'; // Change top-level scope
    // Recompute everything internally to make it self-consistent
    let temp = { ...mutatedScope };
    delete temp.evidenceDigest;
    mutatedScope.evidenceDigest = await computeXREvidenceDigest(temp);

    let resScope = await validateXRSpatialWindowThemeRedrawReceipt(mutatedScope, trustedObservation);
    assert.equal(resScope.ok, false);
    assert.equal(resScope.reason, 'window-window:layout-alpha-unexpectedly-affected-for-scope-beta-scope');

    // 1.2 Window partition mutation (swap affected and reused)
    let mutatedPartition = JSON.parse(JSON.stringify(redrawReceipt));
    mutatedPartition.affectedWindows = ['window:layout-beta'];
    mutatedPartition.reusedWindows = ['window:layout-alpha'];
    // Recompute
    let tempPart = { ...mutatedPartition };
    delete tempPart.evidenceDigest;
    mutatedPartition.evidenceDigest = await computeXREvidenceDigest(tempPart);

    let resPart = await validateXRSpatialWindowThemeRedrawReceipt(mutatedPartition, trustedObservation);
    assert.equal(resPart.ok, false);

    // 1.3 ok mutation
    let mutatedOk = JSON.parse(JSON.stringify(redrawReceipt));
    mutatedOk.ok = false;
    let tempOk = { ...mutatedOk };
    delete tempOk.evidenceDigest;
    mutatedOk.evidenceDigest = await computeXREvidenceDigest(tempOk);

    let resOk = await validateXRSpatialWindowThemeRedrawReceipt(mutatedOk, trustedObservation);
    assert.equal(resOk.ok, false);
    assert.equal(resOk.reason, 'final-verdict-mismatch-with-trusted-observation');

    // 1.4 Material mutation
    let mutatedMaterial = JSON.parse(JSON.stringify(redrawReceipt));
    mutatedMaterial.windowResults[0].actualMaterial = { mutated: true };
    mutatedMaterial.windowResults[0].requestedMaterial = { mutated: true };
    mutatedMaterial.windowResults[0].snapshot.material = { mutated: true };
    // Recompute window result hash, bindingHash and evidenceDigest
    let recordToHash = {
      windowId: mutatedMaterial.windowResults[0].windowId,
      themeScope: mutatedMaterial.windowResults[0].themeScope,
      beforeRevision: mutatedMaterial.windowResults[0].beforeRevision,
      afterRevision: mutatedMaterial.windowResults[0].afterRevision,
      snapshot: mutatedMaterial.windowResults[0].snapshot,
      requestedMaterial: mutatedMaterial.windowResults[0].requestedMaterial,
      actualMaterial: mutatedMaterial.windowResults[0].actualMaterial,
      outcome: mutatedMaterial.windowResults[0].outcome,
      counters: mutatedMaterial.windowResults[0].counters,
    };
    mutatedMaterial.windowResults[0].hash = await computeXREvidenceDigest(recordToHash);
    mutatedMaterial.bindingHash = await computeXREvidenceDigest(mutatedMaterial.windowResults.map(r => r.hash).sort());
    let tempMat = { ...mutatedMaterial };
    delete tempMat.evidenceDigest;
    mutatedMaterial.evidenceDigest = await computeXREvidenceDigest(tempMat);

    let resMat = await validateXRSpatialWindowThemeRedrawReceipt(mutatedMaterial, trustedObservation);
    assert.equal(resMat.ok, false);
    assert.equal(resMat.reason, 'windowResults-snapshot-at-index-0-disallowed-material-property-mutated');

    // 1.5 Revision mutation
    let mutatedRev = JSON.parse(JSON.stringify(redrawReceipt));
    mutatedRev.windowResults[0].afterRevision = 999;
    mutatedRev.windowResults[0].beforeRevision = 998; // keep delta at exactly 1 for self-consistency
    mutatedRev.beforeRevision[mutatedRev.windowResults[0].windowId] = 998;
    mutatedRev.afterRevision[mutatedRev.windowResults[0].windowId] = 999;
    recordToHash = {
      windowId: mutatedRev.windowResults[0].windowId,
      themeScope: mutatedRev.windowResults[0].themeScope,
      beforeRevision: mutatedRev.windowResults[0].beforeRevision,
      afterRevision: mutatedRev.windowResults[0].afterRevision,
      snapshot: mutatedRev.windowResults[0].snapshot,
      requestedMaterial: mutatedRev.windowResults[0].requestedMaterial,
      actualMaterial: mutatedRev.windowResults[0].actualMaterial,
      outcome: mutatedRev.windowResults[0].outcome,
      counters: mutatedRev.windowResults[0].counters,
    };
    mutatedRev.windowResults[0].hash = await computeXREvidenceDigest(recordToHash);
    mutatedRev.bindingHash = await computeXREvidenceDigest(mutatedRev.windowResults.map(r => r.hash).sort());
    let tempRev = { ...mutatedRev };
    delete tempRev.evidenceDigest;
    mutatedRev.evidenceDigest = await computeXREvidenceDigest(tempRev);

    let resRev = await validateXRSpatialWindowThemeRedrawReceipt(mutatedRev, trustedObservation);
    assert.equal(resRev.ok, false);
    assert.equal(resRev.reason, 'canonical-record-mismatch-for-window:layout-alpha');

    // 1.6 Counters mutation
    let mutatedCounters = JSON.parse(JSON.stringify(redrawReceipt));
    mutatedCounters.windowResults[0].counters.afterUploads = 999;
    mutatedCounters.windowResults[0].counters.beforeUploads = 998; // keep delta at exactly 1 for self-consistency
    recordToHash = {
      windowId: mutatedCounters.windowResults[0].windowId,
      themeScope: mutatedCounters.windowResults[0].themeScope,
      beforeRevision: mutatedCounters.windowResults[0].beforeRevision,
      afterRevision: mutatedCounters.windowResults[0].afterRevision,
      snapshot: mutatedCounters.windowResults[0].snapshot,
      requestedMaterial: mutatedCounters.windowResults[0].requestedMaterial,
      actualMaterial: mutatedCounters.windowResults[0].actualMaterial,
      outcome: mutatedCounters.windowResults[0].outcome,
      counters: mutatedCounters.windowResults[0].counters,
    };
    mutatedCounters.windowResults[0].hash = await computeXREvidenceDigest(recordToHash);
    mutatedCounters.bindingHash = await computeXREvidenceDigest(mutatedCounters.windowResults.map(r => r.hash).sort());
    mutatedCounters.counters.afterUploads = mutatedCounters.windowResults.reduce((acc, r) => acc + r.counters.afterUploads, 0);
    mutatedCounters.counters.beforeUploads = mutatedCounters.windowResults.reduce((acc, r) => acc + r.counters.beforeUploads, 0);
    let tempCounters = { ...mutatedCounters };
    delete tempCounters.evidenceDigest;
    mutatedCounters.evidenceDigest = await computeXREvidenceDigest(tempCounters);

    let resCounters = await validateXRSpatialWindowThemeRedrawReceipt(mutatedCounters, trustedObservation);
    assert.equal(resCounters.ok, false);
    assert.equal(resCounters.reason, 'canonical-record-mismatch-for-window:layout-alpha');
  });

  await t.test('2. Diagnostics from second assembly fails against first observation', async () => {
    let platform2 = createFakeXrPlatform({ mode: 'webgl' });
    let THREE2 = createFakeThree();
    let assembly2 = createXRSpatialWindowAssembly({
      globalThis: platform2.globalThis,
      document: platform2.document,
      THREE: THREE2,
    });
    let contentGamma = createWindowContentElement(platform2.document);
    
    // Different window set and size
    assembly2.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-gamma', themeScope: 'gamma-scope' }),
    ], [contentGamma]);
    assembly2.enter({ sessionId: 'session-focused-2' });

    let diag2 = assembly2.getDiagnostics();
    
    // Try validating diag2 against trusted observation of assembly 1
    let resDiag = await validateXRSpatialWindowDiagnostics(diag2, trustedObservation);
    assert.equal(resDiag.ok, false);
    assert.equal(resDiag.reason, 'windows-count-mismatch-with-trusted-observation');
  });

  await t.test('3. Missing observation fails closed', async () => {
    let resReceipt = await validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservation(redrawReceipt, null);
    assert.equal(resReceipt.ok, false);
    assert.equal(resReceipt.reason, 'missing-trusted-observation');

    let diag = assembly.getDiagnostics();
    let resDiag = await validateXRSpatialWindowDiagnosticsAgainstTrustedObservation(diag, null);
    assert.equal(resDiag.ok, false);
    assert.equal(resDiag.reason, 'missing-trusted-observation');
  });

  await t.test('4. Empty transition has typed no-op and never redraw/pass', async () => {
    let emptyAssembly = createXRSpatialWindowAssembly(createFakeXrPlatform());
    assert.throws(() => {
      emptyAssembly.applyTheme(themeInput);
    }, /zero-handle\/no-op/);
    let emptyReceipts = emptyAssembly.getReceipts().filter((r) => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
    assert.equal(emptyReceipts.length, 0, "No redraw receipts must be emitted for zero-handle/no-op");
  });

  await t.test('5. Production boundary test proves validators execute and failure propagates', async () => {
    let prodPlatform = createFakeXrPlatform();
    let prodThree = createFakeThree();
    let prodAssembly = createXRSpatialWindowAssembly({
      globalThis: prodPlatform.globalThis,
      document: prodPlatform.document,
      THREE: prodThree,
      textureBridge: {
        applyPanelTexture() {
          return { ok: false, textureApplied: false, reason: 'simulated-texture-failure' };
        }
      }
    });
    prodAssembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [createWindowContentElement(prodPlatform.document)]);
    prodAssembly.enter({ sessionId: 'session-prod' });

    // 5.1 applyTheme validator failure propagates (throws) naturally when texture bridge fails
    assert.throws(() => {
      prodAssembly.applyTheme(themeInput);
    }, /Theme redraw receipt validation failed:/);
  });

  await t.test('6. Browser and Node SHA-256 vectors are identical and FNV covered', async () => {
    let testStr = "test-sha-vector";
    let hashSync = computeXREvidenceDigestSync(testStr);
    let hashAsync = await computeXREvidenceDigest(testStr);
    assert.equal(hashSync, hashAsync, 'SHA-256 vectors must be identical between sync and async implementations');

    // FNV collision coverage
    let strA = "2112789";
    let strB = "2349192";
    assert.equal(digest(strA), digest(strB), 'FNV collision pair must collide under FNV');
    
    let shaA = await computeXREvidenceDigest(strA);
    let shaB = await computeXREvidenceDigest(strB);
    assert.notEqual(shaA, shaB, 'FNV collision pair must NOT collide under SHA-256');
  });

  await t.test('7. Bounded fixtures for v7 locked correction validation', async (t7) => {
    async function recomputeAllDigests(receipt) {
      let windowHashes = [];
      for (let r of receipt.windowResults) {
        let recordToHash = {
          windowId: r.windowId,
          themeScope: r.themeScope,
          beforeRevision: r.beforeRevision,
          afterRevision: r.afterRevision,
          snapshot: r.snapshot,
          requestedMaterial: r.requestedMaterial,
          actualMaterial: r.actualMaterial,
          outcome: r.outcome,
          counters: r.counters,
        };
        r.hash = await computeXREvidenceDigest(recordToHash);
        windowHashes.push(r.hash);
      }
      receipt.bindingHash = await computeXREvidenceDigest(windowHashes.sort());
      let tempEnv = { ...receipt };
      delete tempEnv.evidenceDigest;
      receipt.evidenceDigest = await computeXREvidenceDigest(tempEnv);
      return receipt;
    }

    await t7.test('7.1 Changing nested tokens fails validation even with recomputed digests', async () => {
      let mutated = JSON.parse(JSON.stringify(redrawReceipt));
      mutated.windowResults[0].snapshot.tokens['--bg'] = '#000000';
      await recomputeAllDigests(mutated);

      let res = await validateXRSpatialWindowThemeRedrawReceipt(mutated, trustedObservation);
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'canonical-record-mismatch-for-window:layout-alpha');
    });

    await t7.test('7.2 Changing scope fails validation even with recomputed digests', async () => {
      let mutated = JSON.parse(JSON.stringify(redrawReceipt));
      mutated.windowResults[0].themeScope = 'different-scope';
      await recomputeAllDigests(mutated);

      let res = await validateXRSpatialWindowThemeRedrawReceipt(mutated, trustedObservation);
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'canonical-record-mismatch-for-window:layout-alpha');
    });

    await t7.test('7.3 Changing material fails validation even with recomputed digests', async () => {
      let mutated = JSON.parse(JSON.stringify(redrawReceipt));
      mutated.windowResults[0].actualMaterial = { mutated: true };
      mutated.windowResults[0].requestedMaterial = { mutated: true };
      mutated.windowResults[0].snapshot.material = { mutated: true };
      await recomputeAllDigests(mutated);

      let res = await validateXRSpatialWindowThemeRedrawReceipt(mutated, trustedObservation);
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'windowResults-snapshot-at-index-0-disallowed-material-property-mutated');
    });

    await t7.test('7.4 Changing result ordering fails validation even with recomputed digests', async () => {
      let alphaScopeTheme = {
        version: 'xr-theme-snapshot-v1',
        themeScope: 'alpha-scope',
        tokens: { '--bg': '#ff0000' },
        material: { background: '#ff0000', backgroundColor: 0xff0000 },
      };
      
      let doubleAssembly = createXRSpatialWindowAssembly({
        globalThis: platform.globalThis,
        document: platform.document,
        THREE,
      });
      doubleAssembly.syncLayouts([
        createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
        createLayoutDescriptor({ layoutId: 'layout-beta', themeScope: 'beta-scope' }),
      ], [contentAlpha, contentBeta]);
      doubleAssembly.enter({ sessionId: 'session-double' });

      let preObs = JSON.parse(JSON.stringify(doubleAssembly.getDiagnostics().windows));
      doubleAssembly.applyTheme(alphaScopeTheme);
      let postObs = JSON.parse(JSON.stringify(doubleAssembly.getDiagnostics().windows));
      
      let doubleReceipt = doubleAssembly.getReceipts().find((r) => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
      let doubleObservation = { pre: preObs, post: postObs };

      let mutated = JSON.parse(JSON.stringify(doubleReceipt));
      mutated.windowResults = [mutated.windowResults[1], mutated.windowResults[0]];
      let tempEnv = { ...mutated };
      delete tempEnv.evidenceDigest;
      mutated.evidenceDigest = await computeXREvidenceDigest(tempEnv);

      let res = await validateXRSpatialWindowThemeRedrawReceipt(mutated, doubleObservation);
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'windowResult-windowId-mismatch-at-index-0');
    });

    await t7.test('7.5 Changing window set fails validation even with recomputed digests', async () => {
      let mutated = JSON.parse(JSON.stringify(redrawReceipt));
      mutated.windowIds.push('window:fake-id');
      mutated.reusedWindows.push('window:fake-id');
      let fakeResult = {
        windowId: 'window:fake-id',
        themeScope: 'alpha-scope',
        beforeRevision: 0,
        afterRevision: 0,
        snapshot: null,
        requestedMaterial: null,
        actualMaterial: null,
        outcome: 'skipped',
        counters: { beforeUploads: 0, afterUploads: 0, beforeReuses: 0, afterReuses: 0 },
        hash: ''
      };
      mutated.windowResults.push(fakeResult);
      await recomputeAllDigests(mutated);

      let res = await validateXRSpatialWindowThemeRedrawReceipt(mutated, trustedObservation);
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'revision-maps-size-mismatch-with-windowIds');
    });

    await t7.test('7.6 Changing pre/post revisions fails validation even with recomputed digests', async () => {
      let mutated = JSON.parse(JSON.stringify(redrawReceipt));
      let id = mutated.windowResults[0].windowId;
      mutated.windowResults[0].afterRevision += 1;
      mutated.windowResults[0].beforeRevision += 1;
      mutated.beforeRevision[id] += 1;
      mutated.afterRevision[id] += 1;
      await recomputeAllDigests(mutated);

      let res = await validateXRSpatialWindowThemeRedrawReceipt(mutated, trustedObservation);
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'canonical-record-mismatch-for-window:layout-alpha');
    });

    await t7.test('7.7 Proves pre-state must be captured before mutation and post after completion', async () => {
      let invalidObservation = { pre: postObservation, post: postObservation };
      let res = await validateXRSpatialWindowThemeRedrawReceipt(redrawReceipt, invalidObservation);
      assert.equal(res.ok, false);
      assert.equal(res.reason, 'transition-type-mismatch-expected-no-op-got-redraw');
    });
  });
});
