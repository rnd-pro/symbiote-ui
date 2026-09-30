import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  listComponentSelections,
  getComponentSelection,
  getComponentSelectionDescriptor,
} from '../manifest/component-selection.js';
import { hasPublicComponent } from '../manifest/component-registry.js';
import { UI_SCHEMA_VERSIONS, getUiSchema } from '../manifest/ui-schema-catalog.js';

test('listComponentSelections returns a complete list of 123 public components', () => {
  let selections = listComponentSelections();
  assert.ok(Array.isArray(selections));
  assert.equal(selections.length, 123);

  let guidanceCount = 0;
  for (let selection of selections) {
    assert.equal(typeof selection.tagName, 'string');
    assert.equal(typeof selection.className, 'string');
    assert.equal(typeof selection.category, 'string');
    assert.equal(typeof selection.description, 'string');

    // agent field check
    assert.ok(selection.agent && typeof selection.agent === 'object');
    assert.ok(Array.isArray(selection.agent.roles));
    for (let role of selection.agent.roles) {
      assert.equal(typeof role, 'string');
    }
    assert.ok(selection.agent.usage === null || typeof selection.agent.usage === 'string');
    assert.ok(selection.agent.dataOwnership === null || typeof selection.agent.dataOwnership === 'string');

    // contract check
    assert.ok(selection.contract === null || typeof selection.contract === 'object');

    // guidance check
    assert.ok(selection.guidance === null || typeof selection.guidance === 'object');
    if (selection.guidance) {
      guidanceCount++;
      assert.equal(typeof selection.guidance.intent, 'string');
      assert.ok(selection.guidance.intent.length > 0);
      assert.equal(typeof selection.guidance.when, 'string');
      assert.ok(selection.guidance.when.length > 0);
      assert.equal(typeof selection.guidance.antipattern, 'string');
      assert.ok(selection.guidance.antipattern.length > 0);
      assert.ok(Array.isArray(selection.guidance.alternatives));
      for (let alt of selection.guidance.alternatives) {
        assert.equal(typeof alt, 'string');
        assert.ok(hasPublicComponent(alt), `Alternative component "${alt}" must be a public component`);
      }
    }

    // evidence check
    assert.ok(selection.evidence === null || typeof selection.evidence === 'object');
    if (selection.evidence) {
      assert.equal(selection.evidence.tagName, selection.tagName);
      assert.ok(selection.evidence.facets && typeof selection.evidence.facets === 'object');
    }

    // scenarios check
    assert.ok(Array.isArray(selection.scenarios));
  }

  assert.equal(guidanceCount, 30, 'Exactly 30 components must have curated selection guidance');
});

test('listComponentSelections returns deep clones', () => {
  let list1 = listComponentSelections();
  let list2 = listComponentSelections();

  assert.notEqual(list1, list2);
  assert.notEqual(list1[0], list2[0]);
  assert.notEqual(list1[0].agent, list2[0].agent);

  // Modify list1 element and check that list2 is unaffected
  let originalTagName = list1[0].tagName;
  list1[0].tagName = 'mutated-tag';
  assert.equal(list2[0].tagName, originalTagName);
});

test('getComponentSelection returns correct selection or null, validating input', () => {
  // Valid public component
  let badgeSelection = getComponentSelection('sn-badge');
  assert.ok(badgeSelection);
  assert.equal(badgeSelection.tagName, 'sn-badge');
  assert.ok(badgeSelection.guidance);
  assert.equal(badgeSelection.guidance.intent, 'count or label badge');

  // Valid component but no guidance
  let layoutSelection = getComponentSelection('layout-shell-menu');
  assert.ok(layoutSelection);
  assert.equal(layoutSelection.tagName, 'layout-shell-menu');
  assert.equal(layoutSelection.guidance, null);

  // Unknown tag name
  assert.equal(getComponentSelection('sn-nonexistent-component-tag'), null);

  // TypeError assertions
  assert.throws(() => getComponentSelection(123), TypeError);
  assert.throws(() => getComponentSelection(null), TypeError);
  assert.throws(() => getComponentSelection(undefined), TypeError);
  assert.throws(() => getComponentSelection({}), TypeError);
});

test('getComponentSelectionDescriptor wraps component selections under component-selection-v1 envelope', () => {
  let desc = getComponentSelectionDescriptor({ name: 'symbiote-ui', version: '2.4.0' });
  assert.equal(desc.version, 'component-selection-v1');
  assert.deepEqual(desc.package, { name: 'symbiote-ui', version: '2.4.0' });
  assert.equal(desc.count, 123);
  assert.equal(desc.components.length, 123);

  // TypeError assertions
  assert.throws(() => getComponentSelectionDescriptor(null), TypeError);
  assert.throws(() => getComponentSelectionDescriptor({}), TypeError);
  assert.throws(() => getComponentSelectionDescriptor({ name: 'symbiote-ui' }), TypeError);
  assert.throws(() => getComponentSelectionDescriptor({ version: '1.0.0' }), TypeError);
  assert.throws(() => getComponentSelectionDescriptor({ name: 123, version: '1.0.0' }), TypeError);
  assert.throws(() => getComponentSelectionDescriptor({ name: 'symbiote-ui', version: null }), TypeError);
});

test('component-selection-v1 schema is registered and valid', () => {
  let versionEntry = UI_SCHEMA_VERSIONS.find(v => v.version === 'component-selection-v1');
  assert.ok(versionEntry);
  assert.equal(versionEntry.path, 'schemas/component-selection-v1.json');

  let schema = getUiSchema('component-selection-v1');
  assert.ok(schema);
  assert.equal(schema.$id, 'https://rnd-pro.github.io/symbiote-ui/schemas/component-selection-v1.json');
  assert.equal(schema.title, 'Symbiote UI Component Selection Descriptor');
  assert.ok(schema.$defs && schema.$defs.selectionComponent);
  assert.ok(schema.$defs.componentEvidence);
  assert.ok(schema.$defs.componentScenario);
});
