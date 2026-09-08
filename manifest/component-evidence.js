export const COMPONENT_EVIDENCE_VERSION = 'component-evidence-v1';
export const COMPONENT_EVIDENCE_REFERENCE_VERSION = 'component-evidence-reference-v1';

const CLIENT_ONLY_CATEGORIES = new Set([
  'canvas',
  'effects',
  'inspector',
  'menu',
  'navigation',
  'node',
  'palette',
  'toolbar',
]);

const VALID_FACETS = new Set([
  'schema validity',
  'registry/CEM/export parity',
  'import/runtime checks',
  'SSR',
  'accessibility',
  'theme/motion behavior',
  'first-party scenario',
]);

const VALID_STATUSES = new Set(['pass', 'fail', 'unknown', 'not-applicable']);

const REFERENCE_GRAMMAR_REGEX = /^component-evidence-reference-v1:(test|ssr-fixture|catalog-fixture|scenario):([a-zA-Z0-9._/:@-]+)$/;

const TAG_NAME_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;

function isValidTagName(tagName) {
  return typeof tagName === 'string' && TAG_NAME_REGEX.test(tagName);
}

const CURATED_EVIDENCE = [
  {
    tagName: 'sn-badge',
    facets: {
      'schema validity': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-badge-schema-test',
      },
      'registry/CEM/export parity': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-badge-parity-test',
      },
      'import/runtime checks': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-badge-runtime-test',
      },
      'SSR': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:ssr-fixture:sn-badge-ssr-fixture',
      },
      'accessibility': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-badge-a11y-test',
      },
      'theme/motion behavior': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-badge-theme-test',
      },
      'first-party scenario': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:scenario:sn-badge-scenario',
      },
    },
  },
  {
    tagName: 'sn-card',
    facets: {
      'schema validity': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-card-schema-test',
      },
      'registry/CEM/export parity': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-card-parity-test',
      },
      'import/runtime checks': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-card-runtime-test',
      },
      'SSR': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:ssr-fixture:sn-card-ssr-fixture',
      },
      'accessibility': {
        status: 'unknown',
      },
      'theme/motion behavior': {
        status: 'unknown',
      },
      'first-party scenario': {
        status: 'unknown',
      },
    },
  },
  {
    tagName: 'quick-open',
    facets: {
      'schema validity': {
        status: 'fail',
        reference: 'component-evidence-reference-v1:test:quick-open-schema-test',
      },
      'registry/CEM/export parity': {
        status: 'unknown',
      },
      'import/runtime checks': {
        status: 'unknown',
      },
      'SSR': {
        status: 'unknown',
      },
      'accessibility': {
        status: 'unknown',
      },
      'theme/motion behavior': {
        status: 'unknown',
      },
      'first-party scenario': {
        status: 'unknown',
      },
    },
  },
  {
    tagName: 'canvas-viewport',
    facets: {
      'schema validity': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:canvas-viewport-schema-test',
      },
      'registry/CEM/export parity': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:canvas-viewport-parity-test',
      },
      'import/runtime checks': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:canvas-viewport-runtime-test',
      },
      'accessibility': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:canvas-viewport-a11y-test',
      },
      'theme/motion behavior': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:canvas-viewport-theme-test',
      },
      'first-party scenario': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:scenario:canvas-viewport-scenario',
      },
    },
  },
  {
    tagName: 'sn-banner',
    facets: {
      'schema validity': {
        status: 'pass',
        reference: 'component-evidence-reference-v1:test:sn-banner-schema-test',
      },
      'registry/CEM/export parity': {
        status: 'unknown',
      },
      'import/runtime checks': {
        status: 'unknown',
      },
      'SSR': {
        status: 'unknown',
      },
      'accessibility': {
        status: 'unknown',
      },
      'theme/motion behavior': {
        status: 'unknown',
      },
      'first-party scenario': {
        status: 'unknown',
      },
    },
  },
];

let seenTags = new Set();
for (let record of CURATED_EVIDENCE) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('Curated record must be a non-null object');
  }
  if (!isValidTagName(record.tagName)) {
    throw new TypeError(`Curated record has invalid or malformed tagName: "${record.tagName}"`);
  }
  if (seenTags.has(record.tagName)) {
    throw new TypeError(`Duplicate curated record for tagName: "${record.tagName}"`);
  }
  seenTags.add(record.tagName);

  if (!record.facets || typeof record.facets !== 'object' || Array.isArray(record.facets)) {
    throw new TypeError(`Curated record "${record.tagName}" must have a facets object`);
  }
  for (let [facet, fact] of Object.entries(record.facets)) {
    if (!VALID_FACETS.has(facet)) {
      throw new TypeError(`Curated record "${record.tagName}" has invalid facet: "${facet}"`);
    }
    if (!fact || typeof fact !== 'object' || Array.isArray(fact)) {
      throw new TypeError(`Curated record "${record.tagName}" facet "${facet}" must be a non-null object`);
    }
    if (!VALID_STATUSES.has(fact.status)) {
      throw new TypeError(`Curated record "${record.tagName}" facet "${facet}" has invalid status: "${fact.status}"`);
    }
    if (fact.reference !== undefined) {
      if (typeof fact.reference !== 'string') {
        throw new TypeError(`Curated record "${record.tagName}" facet "${facet}" reference must be a string`);
      }
      if (!REFERENCE_GRAMMAR_REGEX.test(fact.reference)) {
        throw new TypeError(`Curated record "${record.tagName}" facet "${facet}" has invalid reference grammar: "${fact.reference}"`);
      }
    } else if (fact.status === 'pass') {
      throw new TypeError(`Curated record "${record.tagName}" facet "${facet}" status is "pass" but reference is missing`);
    }
  }
}

export function listComponentEvidence() {
  return JSON.parse(JSON.stringify(CURATED_EVIDENCE));
}

export function getComponentEvidence(tagName) {
  if (!isValidTagName(tagName)) {
    throw new TypeError(`Invalid or malformed tagName: "${tagName}"`);
  }
  let record = CURATED_EVIDENCE.find((r) => r.tagName === tagName);
  if (!record) {
    return null;
  }
  return JSON.parse(JSON.stringify(record));
}

export function deriveComponentMaturity({ component, facts, references, current }) {
  if (!component || typeof component !== 'object' || Array.isArray(component)) {
    throw new TypeError('component must be a non-null object');
  }
  if (!isValidTagName(component.tagName)) {
    throw new TypeError(`component.tagName is invalid or missing: "${component.tagName}"`);
  }
  if (!references || typeof references !== 'object' || Array.isArray(references)) {
    throw new TypeError('references must be a non-null object');
  }
  for (let [refKey, refRecord] of Object.entries(references)) {
    if (!REFERENCE_GRAMMAR_REGEX.test(refKey)) {
      throw new TypeError(`Invalid reference key grammar in references: "${refKey}"`);
    }
    if (!refRecord || typeof refRecord !== 'object' || Array.isArray(refRecord)) {
      throw new TypeError(`Reference record for key "${refKey}" must be a non-null object`);
    }
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) {
    throw new TypeError('current must be a non-null object');
  }
  if (facts !== undefined && facts !== null) {
    if (typeof facts !== 'object' || Array.isArray(facts)) {
      throw new TypeError('facts must be a non-null object');
    }
    for (let [facet, fact] of Object.entries(facts)) {
      if (!VALID_FACETS.has(facet)) {
        throw new TypeError(`Invalid facet name: "${facet}"`);
      }
      if (!fact || typeof fact !== 'object' || Array.isArray(fact)) {
        throw new TypeError(`Fact for facet "${facet}" must be a non-null object`);
      }
      if (fact.status !== undefined && !VALID_STATUSES.has(fact.status)) {
        throw new TypeError(`Invalid status "${fact.status}" for facet "${facet}"`);
      }
      if (fact.reference !== undefined) {
        if (typeof fact.reference !== 'string') {
          throw new TypeError(`Reference for facet "${facet}" must be a string`);
        }
        if (!REFERENCE_GRAMMAR_REGEX.test(fact.reference)) {
          throw new TypeError(`Invalid reference grammar for facet "${facet}": "${fact.reference}"`);
        }
      }
    }
  }

  let derivedFacets = {};
  let isClientOnly = CLIENT_ONLY_CATEGORIES.has(component.category);
  let isSsrRequired = !isClientOnly;

  let requiredFacets = [
    'schema validity',
    'registry/CEM/export parity',
    'import/runtime checks',
    'accessibility',
    'theme/motion behavior',
    'first-party scenario',
  ];
  if (isSsrRequired) {
    requiredFacets.push('SSR');
  }

  for (let facet of VALID_FACETS) {
    if (facet === 'SSR' && !isSsrRequired) {
      derivedFacets[facet] = 'not-applicable';
      continue;
    }

    let fact = facts ? facts[facet] : null;
    if (!fact) {
      derivedFacets[facet] = 'unknown';
      continue;
    }

    let status = fact.status || 'unknown';

    if (status === 'pass') {
      let ref = fact.reference;
      if (!ref) {
        derivedFacets[facet] = 'unknown';
        continue;
      }

      let refRecord = references[ref];
      if (!refRecord) {
        derivedFacets[facet] = 'unknown';
        continue;
      }

      if (refRecord.bestEffort === true || refRecord.swallowed === true) {
        derivedFacets[facet] = 'unknown';
        continue;
      }

      let matches = false;
      if (refRecord.packageVersion !== undefined && refRecord.packageVersion === current.packageVersion) {
        matches = true;
      }
      if (refRecord.contractVersion !== undefined && refRecord.contractVersion === current.contractVersion) {
        matches = true;
      }
      if (refRecord.hash !== undefined && refRecord.hash === current.hash) {
        matches = true;
      }

      if (!matches) {
        derivedFacets[facet] = 'unknown';
        continue;
      }

      let refStatus = refRecord.status || 'pass';
      if (!VALID_STATUSES.has(refStatus)) {
        derivedFacets[facet] = 'unknown';
      } else {
        derivedFacets[facet] = refStatus;
      }
    } else {
      derivedFacets[facet] = status;
    }
  }

  let hasFail = false;
  let hasUnknown = false;
  let hasPass = false;

  for (let facet of requiredFacets) {
    let derivedStatus = derivedFacets[facet];
    if (derivedStatus === 'fail') {
      hasFail = true;
    } else if (derivedStatus === 'unknown') {
      hasUnknown = true;
    } else if (derivedStatus === 'pass') {
      hasPass = true;
    }
  }

  let maturity;
  if (hasFail) {
    maturity = 'blocked';
  } else if (hasUnknown) {
    if (hasPass) {
      maturity = 'incomplete';
    } else {
      maturity = 'unknown';
    }
  } else {
    maturity = 'verified';
  }

  if (component.contract?.status === 'stable' && maturity !== 'verified') {
    throw new TypeError(`Component "${component.tagName}" is marked "stable" but its derived maturity is "${maturity}" instead of "verified".`);
  }

  return {
    maturity,
    facets: derivedFacets,
  };
}
