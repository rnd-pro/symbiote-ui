import { listComponents, hasPublicComponent } from './component-registry.js';
import { getComponentEvidence } from './component-evidence.js';
import { listComponentScenariosForComponent } from './component-scenarios.js';

const CURATED_GUIDANCE = {
  'sn-data-table': {
    intent: 'tabular data',
    when: 'use when rows and columns need sorting, selection, or aligned cells',
    antipattern: "don't hand-roll a <table> grid with custom row markup",
    alternatives: []
  },
  'sn-description-list': {
    intent: 'key/value details',
    when: 'use when showing labelled term/value pairs for a single record',
    antipattern: "don't hand-roll a two-column <dl> or label/value flex layout",
    alternatives: []
  },
  'sn-status-light': {
    intent: 'status indicator',
    when: 'use when surfacing a discrete health or state dot (online, error, idle)',
    antipattern: "don't hand-roll a colored <span> dot with bespoke state classes",
    alternatives: []
  },
  'sn-badge': {
    intent: 'count or label badge',
    when: 'use when annotating an item with a small count, tag, or state label',
    antipattern: "don't hand-roll a pill <span> with custom background colors",
    alternatives: ['sn-tag']
  },
  'sn-card': {
    intent: 'titled bordered container',
    when: 'use when grouping related content in a bordered, optionally titled surface',
    antipattern: "don't hand-roll a <div> with border, radius, and padding tokens",
    alternatives: []
  },
  'sn-dialog': {
    intent: 'modal dialog',
    when: 'use when a focused, blocking task or confirmation interrupts the flow',
    antipattern: "don't hand-roll a fixed overlay <div> with manual focus trapping",
    alternatives: ['sn-drawer', 'sn-popover']
  },
  'sn-drawer': {
    intent: 'slide-over panel',
    when: 'use when secondary content slides in from an edge without leaving the page',
    antipattern: "don't hand-roll an off-canvas <aside> with manual transitions",
    alternatives: ['sn-dialog', 'sn-popover']
  },
  'sn-toast': {
    intent: 'transient notification',
    when: 'use when confirming an action with a brief, auto-dismissing message',
    antipattern: "don't hand-roll a floating <div> with a setTimeout dismiss",
    alternatives: []
  },
  'sn-banner': {
    intent: 'inline alert',
    when: 'use when a persistent in-flow message warns or informs about context',
    antipattern: "don't hand-roll a colored callout <div> with an icon and message",
    alternatives: []
  },
  'sn-empty-state': {
    intent: 'empty or zero state',
    when: 'use when a list or view has no data and needs guidance or a next action',
    antipattern: "don't hand-roll a centered <div> with an icon and 'nothing here' text",
    alternatives: []
  },
  'sn-metric': {
    intent: 'single metric',
    when: 'use when highlighting one headline number with a label and optional delta',
    antipattern: "don't hand-roll a stat block with bespoke number and caption styles",
    alternatives: []
  },
  'sn-tree-view': {
    intent: 'hierarchical data',
    when: 'use when nested, expandable parent/child nodes need to be navigated',
    antipattern: "don't hand-roll nested <ul> lists with manual expand/collapse state",
    alternatives: []
  },
  'sn-listbox': {
    intent: 'selectable list',
    when: 'use when a single- or multi-select list needs keyboard and roving focus',
    antipattern: "don't hand-roll a <ul> of clickable items with custom selection logic",
    alternatives: ['sn-select', 'sn-combobox']
  },
  'sn-accordion': {
    intent: 'collapsible sections',
    when: 'use when stacked sections expand and collapse to manage vertical space',
    antipattern: "don't hand-roll <details>/<summary> blocks with bespoke animation",
    alternatives: []
  },
  'sn-popover': {
    intent: 'contextual overlay',
    when: 'use when transient content anchors to a trigger and dismisses on outside click',
    antipattern: "don't hand-roll an absolutely positioned <div> with manual placement",
    alternatives: ['sn-dialog', 'sn-drawer', 'sn-tooltip']
  },
  'sn-field': {
    intent: 'form text input',
    when: 'use when collecting a labelled text value with validation and help text',
    antipattern: "don't hand-roll a <label> + <input> pair with custom error markup",
    alternatives: []
  },
  'sn-select': {
    intent: 'choice from many options',
    when: 'use when picking one value from a known, bounded list of options',
    antipattern: "don't hand-roll a styled native <select> or custom dropdown menu",
    alternatives: ['sn-combobox', 'sn-listbox']
  },
  'sn-combobox': {
    intent: 'searchable choice from many',
    when: 'use when picking from a long list that benefits from type-ahead filtering',
    antipattern: "don't hand-roll an <input> with a filtered results <ul> beneath it",
    alternatives: ['sn-select', 'sn-listbox']
  },
  'sn-switch': {
    intent: 'on/off toggle',
    when: 'use when toggling a single boolean setting on or off immediately',
    antipattern: "don't hand-roll a checkbox restyled to look like a toggle track",
    alternatives: []
  },
  'sn-progress-bar': {
    intent: 'determinate progress',
    when: 'use when showing linear completion toward a known total',
    antipattern: "don't hand-roll a track <div> with a width-percentage fill",
    alternatives: ['sn-progress-ring']
  },
  'sn-progress-ring': {
    intent: 'compact circular progress',
    when: 'use when completion is shown in a small, radial footprint',
    antipattern: "don't hand-roll an SVG circle with stroke-dashoffset math",
    alternatives: ['sn-progress-bar']
  },
  'sn-avatar': {
    intent: 'user avatar',
    when: 'use when representing a person or entity with an image or initials',
    antipattern: "don't hand-roll a rounded <img> with initials fallback logic",
    alternatives: []
  },
  'sn-tag': {
    intent: 'tag or chip',
    when: 'use when labelling or categorizing an item with a small, optionally removable chip',
    antipattern: "don't hand-roll a pill <span> with a close button and remove handler",
    alternatives: ['sn-badge']
  },
  'code-block': {
    intent: 'code snippet',
    when: 'use when displaying syntax-highlighted code with copy affordance',
    antipattern: "don't hand-roll a <pre><code> block with bespoke highlighting",
    alternatives: []
  },
  'sn-tooltip': {
    intent: 'tooltip',
    when: 'use when a brief hint appears on hover or focus of a trigger',
    antipattern: "don't hand-roll a title attribute or absolutely positioned hint <div>",
    alternatives: ['sn-popover']
  },
  'sn-timeline': {
    intent: 'chronological timeline',
    when: 'use when events are shown in ordered, time-anchored steps',
    antipattern: "don't hand-roll a vertical rail with bespoke dot-and-line markup",
    alternatives: []
  },
  'sn-stepper': {
    intent: 'multi-step progress',
    when: 'use when guiding through ordered stages of a task or wizard',
    antipattern: "don't hand-roll numbered step circles with manual active state",
    alternatives: []
  },
  'sn-breadcrumb': {
    intent: 'navigation breadcrumb',
    when: 'use when showing the current location within a hierarchy path',
    antipattern: "don't hand-roll a separator-joined list of links",
    alternatives: []
  },
  'sn-pagination': {
    intent: 'paginated navigation',
    when: 'use when splitting a long result set across navigable pages',
    antipattern: "don't hand-roll prev/next buttons with custom page-number state",
    alternatives: []
  },
  'sn-skeleton': {
    intent: 'loading placeholder',
    when: 'use when reserving layout with a shimmer while content loads',
    antipattern: "don't hand-roll gray placeholder <div>s with a custom shimmer animation",
    alternatives: []
  }
};

const SELECTIONS = listComponents({ includeInternal: false, includeExperimental: false }).map((component) => {
  let tagName = component.tagName;
  let className = component.className;
  let category = component.category;
  let description = component.description;

  let agent = {
    roles: component.agent?.semanticRole ? [component.agent.semanticRole] : [],
    usage: component.agent?.usage || null,
    dataOwnership: component.agent?.dataOwnership || null
  };

  let contract = component.contract || null;

  let rawGuidance = CURATED_GUIDANCE[tagName] || null;
  let guidance = null;
  if (rawGuidance) {
    guidance = {
      intent: rawGuidance.intent,
      when: rawGuidance.when,
      antipattern: rawGuidance.antipattern,
      alternatives: rawGuidance.alternatives || []
    };
  }

  let evidence = getComponentEvidence(tagName);
  let scenarios = listComponentScenariosForComponent(tagName);

  return {
    tagName,
    className,
    category,
    description,
    agent,
    contract,
    guidance,
    evidence,
    scenarios
  };
});

// Validate at module load time to catch any catalog curation bugs.
(function validateSelections() {
  let seenTags = new Set();

  for (let tag of Object.keys(CURATED_GUIDANCE)) {
    if (!hasPublicComponent(tag)) {
      throw new TypeError(`Curated guidance targets component "${tag}" which is not a public component in the registry.`);
    }
  }

  for (let item of SELECTIONS) {
    let { tagName, guidance, evidence } = item;
    if (!hasPublicComponent(tagName)) {
      throw new TypeError(`Component "${tagName}" is not a public component in the registry.`);
    }
    if (seenTags.has(tagName)) {
      throw new TypeError(`Duplicate component selection entry for "${tagName}".`);
    }
    seenTags.add(tagName);

    if (guidance) {
      if (guidance.alternatives) {
        let seenAlts = new Set();
        for (let alt of guidance.alternatives) {
          if (!hasPublicComponent(alt)) {
            throw new TypeError(`Alternative component "${alt}" for "${tagName}" is not a public component in the registry.`);
          }
          if (seenAlts.has(alt)) {
            throw new TypeError(`Duplicate alternative component "${alt}" for "${tagName}".`);
          }
          if (alt === tagName) {
            throw new TypeError(`Alternative component "${alt}" cannot be the same as the target component.`);
          }
          seenAlts.add(alt);
        }
      }
    }

    if (evidence) {
      if (!hasPublicComponent(evidence.tagName)) {
        throw new TypeError(`Evidence component "${evidence.tagName}" for "${tagName}" is not a public component in the registry.`);
      }
      if (evidence.tagName !== tagName) {
        throw new TypeError(`Evidence component "${evidence.tagName}" does not match target component "${tagName}".`);
      }
    }
  }
})();

/**
 * List all component selections.
 * @returns {any[]} List of selections.
 */
export function listComponentSelections() {
  return JSON.parse(JSON.stringify(SELECTIONS));
}

/**
 * Retrieve a specific component selection by tagName.
 * @param {string} tagName Component tag name.
 * @returns {any|null} The selection object or null.
 */
export function getComponentSelection(tagName) {
  if (typeof tagName !== 'string') {
    throw new TypeError('tagName must be a string');
  }
  let found = SELECTIONS.find((s) => s.tagName === tagName);
  if (!found) return null;
  return JSON.parse(JSON.stringify(found));
}

/**
 * Return versioned descriptor of component selections.
 * @param {object} options
 * @param {string} options.name Package name.
 * @param {string} options.version Package version.
 * @returns {object} Descriptor.
 */
export function getComponentSelectionDescriptor(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be a non-null object');
  }
  let { name, version } = options;
  if (typeof name !== 'string') {
    throw new TypeError('package name must be a string');
  }
  if (typeof version !== 'string') {
    throw new TypeError('package version must be a string');
  }
  let components = listComponentSelections();
  return {
    version: 'component-selection-v1',
    package: { name, version },
    count: components.length,
    components
  };
}
