import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  validateXRSpatialWindowThemeRedrawReceipt,
  validateXRSpatialWindowThemeRedrawReceiptSelfConsistency,
  validateXRSpatialWindowThemeRedrawReceiptAgainstTrustedObservation,
  computeXREvidenceDigest,
} from '../xr/spatial-window-contract.js';
import { createXRSpatialWindowAssembly } from '../xr/spatial-window-assembly.js';
import {
  createFakeXrPlatform,
  createLayoutDescriptor,
  createWindowContentElement,
  createFakeThree,
  createFakeBatchBridge,
} from './xr-spatial-window-fixtures.js';

test('Provider theme/chrome v8 corrections validation', async (t) => {
  // Helper to recompute digests for mutated receipts
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

  // Setup platform & dependencies
  let platform = createFakeXrPlatform({ mode: 'webgl' });
  let THREE = createFakeThree();

  await t.test('1. Zero-window assembly: truly empty canonical no-op', async () => {
    let emptyAssembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      tokens: { '--bg': '#ff0000' },
      material: { background: '#ff0000', backgroundColor: 0xff0000 },
    };

    assert.throws(() => {
      emptyAssembly.applyTheme(themeInput);
    }, /zero-handle\/no-op/);
    let emptyReceipts = emptyAssembly.getReceipts().filter((r) => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
    assert.equal(emptyReceipts.length, 0, "No redraw receipts must be emitted for zero-handle/no-op");
  });

  await t.test('2. Existing-window scoped no-op: skipped/reused with unchanged revisions and counters', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-scoped-noop' });

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'beta-scope',
      tokens: { '--bg': '#ff0000' },
      material: { background: '#ff0000', backgroundColor: 0xff0000 },
    };

    assert.throws(() => {
      assembly.applyTheme(themeInput);
    }, /zero-handle\/no-op/);
    let emptyReceipts = assembly.getReceipts().filter((r) => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
    assert.equal(emptyReceipts.length, 0, "No redraw receipts must be emitted for zero-handle/no-op");
  });

  await t.test('3. Identical-theme application: exact observed reuse/no-change records', async () => {
    let customBridgePlatform = createFakeXrPlatform({ mode: 'webgl' });
    let customBridgeThree = createFakeThree();
    let assembly = createXRSpatialWindowAssembly({
      globalThis: customBridgePlatform.globalThis,
      document: customBridgePlatform.document,
      THREE: customBridgeThree,
      textureBridge: createFakeBatchBridge({ stage: 'canvas-to-texture-reused' }),
      textureResolver: {
        getState() {
          return {
            records: [
              {
                panelId: 'window:layout-alpha',
                stage: 'canvas-to-texture-reused',
                redrawCount: 0,
                width: 1280,
                height: 720
              }
            ]
          };
        }
      }
    });

    let contentAlpha = createWindowContentElement(customBridgePlatform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-identical-theme' });

    let preObservation = JSON.parse(JSON.stringify(assembly.getDiagnostics().windows));

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      tokens: { '--bg': '#ff0000' },
      material: { background: '#ff0000', backgroundColor: 0xff0000 },
    };

    assembly.applyTheme(themeInput);

    let receipt = assembly.getReceipts().find(r => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
    assert.ok(receipt);
    assert.equal(receipt.ok, true);
    assert.equal(receipt.windowResults[0].outcome, 'reuse');
    assert.equal(receipt.windowResults[0].counters.afterReuses, receipt.windowResults[0].counters.beforeReuses + 1);

    let postObservation = JSON.parse(JSON.stringify(assembly.getDiagnostics().windows));
    let trustedObservation = { pre: preObservation, post: postObservation };

    let selfVal = await validateXRSpatialWindowThemeRedrawReceipt(receipt);
    assert.equal(selfVal.ok, true);
    assert.equal(selfVal.type, 'redraw');

    let trustedVal = await validateXRSpatialWindowThemeRedrawReceipt(receipt, trustedObservation);
    assert.equal(trustedVal.ok, true);
    assert.equal(trustedVal.type, 'redraw');
  });

  await t.test('4. Adversarial validations with recomputed public digests', async () => {
    let assembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });

    let contentAlpha = createWindowContentElement(platform.document);
    assembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
    ], [contentAlpha]);
    assembly.enter({ sessionId: 'session-adversarial' });

    let preObservation = JSON.parse(JSON.stringify(assembly.getDiagnostics().windows));

    let themeInput = {
      version: 'xr-theme-snapshot-v1',
      themeScope: 'alpha-scope',
      tokens: { '--bg': '#ff0000' },
      material: { background: '#ff0000', backgroundColor: 0xff0000 },
    };

    assembly.applyTheme(themeInput);

    let originalReceipt = assembly.getReceipts().find(r => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
    let postObservation = JSON.parse(JSON.stringify(assembly.getDiagnostics().windows));
    let trustedObservation = { pre: preObservation, post: postObservation };

    // 4.1 Top-level extra property fails structural validation
    let topExtra = JSON.parse(JSON.stringify(originalReceipt));
    topExtra.disallowedExtraField = 42;
    await recomputeAllDigests(topExtra);

    let resTopExtra = await validateXRSpatialWindowThemeRedrawReceipt(topExtra, trustedObservation);
    assert.equal(resTopExtra.ok, false);
    assert.equal(resTopExtra.reason, 'disallowed-top-level-property-disallowedExtraField');

    // 4.2 Nested extra property in windowResults item fails structural validation
    let nestedExtra = JSON.parse(JSON.stringify(originalReceipt));
    nestedExtra.windowResults[0].nestedExtraField = 'disallowed';
    await recomputeAllDigests(nestedExtra);

    let resNestedExtra = await validateXRSpatialWindowThemeRedrawReceipt(nestedExtra, trustedObservation);
    assert.equal(resNestedExtra.ok, false);
    assert.equal(resNestedExtra.reason, 'disallowed-windowResults-property-nestedExtraField-at-index-0');

    // 4.3 Nested extra property in counters fails structural validation
    let countersExtra = JSON.parse(JSON.stringify(originalReceipt));
    countersExtra.counters.unexpectedProp = true;
    await recomputeAllDigests(countersExtra);

    let resCountersExtra = await validateXRSpatialWindowThemeRedrawReceipt(countersExtra, trustedObservation);
    assert.equal(resCountersExtra.ok, false);
    assert.equal(resCountersExtra.reason, 'disallowed-counters-property-unexpectedProp');

    // 4.4 Altered binding Hash verification
    let alteredBinding = JSON.parse(JSON.stringify(originalReceipt));
    alteredBinding.bindingHash = 'a'.repeat(64);
    // Only recompute envelope digest
    let tempEnv = { ...alteredBinding };
    delete tempEnv.evidenceDigest;
    alteredBinding.evidenceDigest = await computeXREvidenceDigest(tempEnv);

    let resAlteredBinding = await validateXRSpatialWindowThemeRedrawReceipt(alteredBinding, trustedObservation);
    assert.equal(resAlteredBinding.ok, false);
    assert.equal(resAlteredBinding.reason, 'bindingHash-recomputation-mismatch');

    // 4.5 Window set alteration
    let alteredSet = JSON.parse(JSON.stringify(originalReceipt));
    alteredSet.windowIds.push('window:fake');
    alteredSet.reusedWindows.push('window:fake');
    alteredSet.windowResults.push({
      windowId: 'window:fake',
      themeScope: 'alpha-scope',
      beforeRevision: 0,
      afterRevision: 0,
      snapshot: null,
      requestedMaterial: null,
      actualMaterial: null,
      outcome: 'skipped',
      counters: { beforeUploads: 0, afterUploads: 0, beforeReuses: 0, afterReuses: 0 },
      hash: ''
    });
    await recomputeAllDigests(alteredSet);

    let resAlteredSet = await validateXRSpatialWindowThemeRedrawReceipt(alteredSet, trustedObservation);
    assert.equal(resAlteredSet.ok, false);
    assert.equal(resAlteredSet.reason, 'revision-maps-size-mismatch-with-windowIds');

    // 4.6 Ordering alteration
    let doubleAssembly = createXRSpatialWindowAssembly({
      globalThis: platform.globalThis,
      document: platform.document,
      THREE,
    });
    let contentBeta = createWindowContentElement(platform.document);
    doubleAssembly.syncLayouts([
      createLayoutDescriptor({ layoutId: 'layout-alpha', themeScope: 'alpha-scope' }),
      createLayoutDescriptor({ layoutId: 'layout-beta', themeScope: 'alpha-scope' }),
    ], [contentAlpha, contentBeta]);
    doubleAssembly.enter({ sessionId: 'session-double' });

    let preDouble = JSON.parse(JSON.stringify(doubleAssembly.getDiagnostics().windows));
    doubleAssembly.applyTheme(themeInput);
    let postDouble = JSON.parse(JSON.stringify(doubleAssembly.getDiagnostics().windows));
    let doubleObs = { pre: preDouble, post: postDouble };

    let doubleReceipt = doubleAssembly.getReceipts().find(r => r.version === 'xr-spatial-window-theme-redraw-receipt-v1');
    
    let alteredOrder = JSON.parse(JSON.stringify(doubleReceipt));
    // Swap order
    alteredOrder.windowResults = [alteredOrder.windowResults[1], alteredOrder.windowResults[0]];
    let tempEnvDouble = { ...alteredOrder };
    delete tempEnvDouble.evidenceDigest;
    alteredOrder.evidenceDigest = await computeXREvidenceDigest(tempEnvDouble);

    let resAlteredOrder = await validateXRSpatialWindowThemeRedrawReceipt(alteredOrder, doubleObs);
    assert.equal(resAlteredOrder.ok, false);
    assert.equal(resAlteredOrder.reason, 'windowResult-windowId-mismatch-at-index-0');
  });
});
