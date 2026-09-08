import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  COMPONENT_EVIDENCE_VERSION,
  COMPONENT_EVIDENCE_REFERENCE_VERSION,
  listComponentEvidence,
  getComponentEvidence,
  deriveComponentMaturity
} from '../manifest/component-evidence.js';

test('Component Evidence: constants check', () => {
  assert.equal(COMPONENT_EVIDENCE_VERSION, 'component-evidence-v1');
  assert.equal(COMPONENT_EVIDENCE_REFERENCE_VERSION, 'component-evidence-reference-v1');
});

test('Component Evidence: listComponentEvidence basic behavior', () => {
  let list1 = listComponentEvidence();
  let list2 = listComponentEvidence();

  assert.ok(Array.isArray(list1));
  assert.ok(list1.length > 0);
  assert.deepEqual(list1, list2);
  assert.notEqual(list1, list2); // Should be deep copies
  assert.notEqual(list1[0], list2[0]);
});

test('Component Evidence: getComponentEvidence validation and lookup', () => {
  // Valid lookup
  let evidence = getComponentEvidence('sn-badge');
  assert.ok(evidence);
  assert.equal(evidence.tagName, 'sn-badge');

  // Clone verification
  let evidence2 = getComponentEvidence('sn-badge');
  assert.notEqual(evidence, evidence2);

  // Unknown but well-formed tag name
  let unknownEvidence = getComponentEvidence('unknown-component-tag');
  assert.equal(unknownEvidence, null);

  // Invalid tag names (must throw TypeError)
  assert.throws(() => getComponentEvidence(''), TypeError);
  assert.throws(() => getComponentEvidence('invalid'), TypeError);
  assert.throws(() => getComponentEvidence('Invalid-Tag'), TypeError);
  assert.throws(() => getComponentEvidence(123), TypeError);
  assert.throws(() => getComponentEvidence(null), TypeError);
});

test('Component Evidence: deriveComponentMaturity argument validation', () => {
  let validComponent = { tagName: 'sn-badge', category: 'content' };
  let validReferences = {};
  let validCurrent = { packageVersion: '1.0.0' };

  // Invalid component
  assert.throws(() => deriveComponentMaturity({ component: null, facts: {}, references: validReferences, current: validCurrent }), TypeError);
  assert.throws(() => deriveComponentMaturity({ component: {}, facts: {}, references: validReferences, current: validCurrent }), TypeError);
  assert.throws(() => deriveComponentMaturity({ component: { tagName: 'invalid' }, facts: {}, references: validReferences, current: validCurrent }), TypeError);

  // Invalid references
  assert.throws(() => deriveComponentMaturity({ component: validComponent, facts: {}, references: null, current: validCurrent }), TypeError);
  assert.throws(() => deriveComponentMaturity({ component: validComponent, facts: {}, references: { 'invalid-ref-grammar': {} }, current: validCurrent }), TypeError);
  assert.throws(() => deriveComponentMaturity({ component: validComponent, facts: {}, references: { 'component-evidence-reference-v1:test:ok': null }, current: validCurrent }), TypeError);

  // Invalid current
  assert.throws(() => deriveComponentMaturity({ component: validComponent, facts: {}, references: validReferences, current: null }), TypeError);

  // Invalid facts
  assert.throws(() => deriveComponentMaturity({ component: validComponent, facts: 'invalid', references: validReferences, current: validCurrent }), TypeError);
  assert.throws(() => deriveComponentMaturity({ component: validComponent, facts: { 'invalid facet': { status: 'pass' } }, references: validReferences, current: validCurrent }), TypeError);
  assert.throws(() => deriveComponentMaturity({ component: validComponent, facts: { 'schema validity': { status: 'invalid-status' } }, references: validReferences, current: validCurrent }), TypeError);
  assert.throws(() => deriveComponentMaturity({ component: validComponent, facts: { 'schema validity': { status: 'pass', reference: 'invalid' } }, references: validReferences, current: validCurrent }), TypeError);
});

test('Component Evidence: deriveComponentMaturity verified logic', () => {
  let component = { tagName: 'sn-badge', category: 'content' };
  let facts = {
    'schema validity': { status: 'pass', reference: 'component-evidence-reference-v1:test:schema-ref' },
    'registry/CEM/export parity': { status: 'pass', reference: 'component-evidence-reference-v1:test:parity-ref' },
    'import/runtime checks': { status: 'pass', reference: 'component-evidence-reference-v1:test:runtime-ref' },
    'SSR': { status: 'pass', reference: 'component-evidence-reference-v1:ssr-fixture:ssr-ref' },
    'accessibility': { status: 'pass', reference: 'component-evidence-reference-v1:test:a11y-ref' },
    'theme/motion behavior': { status: 'pass', reference: 'component-evidence-reference-v1:test:theme-ref' },
    'first-party scenario': { status: 'pass', reference: 'component-evidence-reference-v1:scenario:scenario-ref' }
  };
  let references = {
    'component-evidence-reference-v1:test:schema-ref': { packageVersion: '1.0.0', status: 'pass' },
    'component-evidence-reference-v1:test:parity-ref': { contractVersion: 'v2', status: 'pass' },
    'component-evidence-reference-v1:test:runtime-ref': { hash: 'abc', status: 'pass' },
    'component-evidence-reference-v1:ssr-fixture:ssr-ref': { packageVersion: '1.0.0', status: 'pass' },
    'component-evidence-reference-v1:test:a11y-ref': { packageVersion: '1.0.0', status: 'pass' },
    'component-evidence-reference-v1:test:theme-ref': { packageVersion: '1.0.0', status: 'pass' },
    'component-evidence-reference-v1:scenario:scenario-ref': { packageVersion: '1.0.0', status: 'pass' }
  };
  let current = { packageVersion: '1.0.0', contractVersion: 'v2', hash: 'abc' };

  let result = deriveComponentMaturity({ component, facts, references, current });
  assert.equal(result.maturity, 'verified');
});

test('Component Evidence: deriveComponentMaturity client-only category bypasses SSR requirement', () => {
  let component = { tagName: 'canvas-viewport', category: 'canvas' }; // 'canvas' is in CLIENT_ONLY_CATEGORIES
  let facts = {
    'schema validity': { status: 'pass', reference: 'component-evidence-reference-v1:test:schema-ref' },
    'registry/CEM/export parity': { status: 'pass', reference: 'component-evidence-reference-v1:test:parity-ref' },
    'import/runtime checks': { status: 'pass', reference: 'component-evidence-reference-v1:test:runtime-ref' },
    'accessibility': { status: 'pass', reference: 'component-evidence-reference-v1:test:a11y-ref' },
    'theme/motion behavior': { status: 'pass', reference: 'component-evidence-reference-v1:test:theme-ref' },
    'first-party scenario': { status: 'pass', reference: 'component-evidence-reference-v1:scenario:scenario-ref' }
  };
  let references = {
    'component-evidence-reference-v1:test:schema-ref': { packageVersion: '1.0.0', status: 'pass' },
    'component-evidence-reference-v1:test:parity-ref': { contractVersion: 'v2', status: 'pass' },
    'component-evidence-reference-v1:test:runtime-ref': { hash: 'abc', status: 'pass' },
    'component-evidence-reference-v1:test:a11y-ref': { packageVersion: '1.0.0', status: 'pass' },
    'component-evidence-reference-v1:test:theme-ref': { packageVersion: '1.0.0', status: 'pass' },
    'component-evidence-reference-v1:scenario:scenario-ref': { packageVersion: '1.0.0', status: 'pass' }
  };
  let current = { packageVersion: '1.0.0', contractVersion: 'v2', hash: 'abc' };

  let result = deriveComponentMaturity({ component, facts, references, current });
  assert.equal(result.maturity, 'verified');
  assert.equal(result.facets['SSR'], 'not-applicable');
});

test('Component Evidence: deriveComponentMaturity blocked logic', () => {
  let component = { tagName: 'sn-badge', category: 'content' };
  let facts = {
    'schema validity': { status: 'fail', reference: 'component-evidence-reference-v1:test:schema-ref' },
    'registry/CEM/export parity': { status: 'pass', reference: 'component-evidence-reference-v1:test:parity-ref' },
  };
  let references = {
    'component-evidence-reference-v1:test:schema-ref': { packageVersion: '1.0.0', status: 'fail' },
    'component-evidence-reference-v1:test:parity-ref': { contractVersion: 'v2', status: 'pass' }
  };
  let current = { packageVersion: '1.0.0', contractVersion: 'v2' };

  let result = deriveComponentMaturity({ component, facts, references, current });
  assert.equal(result.maturity, 'blocked');
  assert.equal(result.facets['schema validity'], 'fail');
});

test('Component Evidence: deriveComponentMaturity incomplete vs unknown logic', () => {
  let component = { tagName: 'sn-badge', category: 'content' };
  let facts = {
    'schema validity': { status: 'pass', reference: 'component-evidence-reference-v1:test:schema-ref' },
    'registry/CEM/export parity': { status: 'unknown' }
  };
  let references = {
    'component-evidence-reference-v1:test:schema-ref': { packageVersion: '1.0.0', status: 'pass' }
  };
  let current = { packageVersion: '1.0.0' };

  // Some pass, some unknown => incomplete
  let result = deriveComponentMaturity({ component, facts, references, current });
  assert.equal(result.maturity, 'incomplete');

  // No pass, all unknown => unknown
  let result2 = deriveComponentMaturity({ component, facts: {}, references: {}, current });
  assert.equal(result2.maturity, 'unknown');
});

test('Component Evidence: deriveComponentMaturity context mismatch behaves as unknown', () => {
  let component = { tagName: 'sn-badge', category: 'content' };
  let facts = {
    'schema validity': { status: 'pass', reference: 'component-evidence-reference-v1:test:schema-ref' }
  };
  let references = {
    'component-evidence-reference-v1:test:schema-ref': { packageVersion: '2.0.0', status: 'pass' }
  };
  let current = { packageVersion: '1.0.0' };

  let result = deriveComponentMaturity({ component, facts, references, current });
  assert.equal(result.facets['schema validity'], 'unknown');
  assert.equal(result.maturity, 'unknown');
});

test('Component Evidence: deriveComponentMaturity best-effort/swallowed references are ignored (unknown)', () => {
  let component = { tagName: 'sn-badge', category: 'content' };
  let facts = {
    'schema validity': { status: 'pass', reference: 'component-evidence-reference-v1:test:schema-ref' }
  };
  let references = {
    'component-evidence-reference-v1:test:schema-ref': { packageVersion: '1.0.0', status: 'pass', bestEffort: true }
  };
  let current = { packageVersion: '1.0.0' };

  let result = deriveComponentMaturity({ component, facts, references, current });
  assert.equal(result.facets['schema validity'], 'unknown');
  assert.equal(result.maturity, 'unknown');
});

test('Component Evidence: deriveComponentMaturity stable contract validation throws TypeError on unverified', () => {
  let component = {
    tagName: 'sn-badge',
    category: 'content',
    contract: { status: 'stable' }
  };
  let facts = {
    'schema validity': { status: 'pass', reference: 'component-evidence-reference-v1:test:schema-ref' }
  };
  let references = {
    'component-evidence-reference-v1:test:schema-ref': { packageVersion: '1.0.0', status: 'pass' }
  };
  let current = { packageVersion: '1.0.0' };

  assert.throws(() => {
    deriveComponentMaturity({ component, facts, references, current });
  }, TypeError);
});
