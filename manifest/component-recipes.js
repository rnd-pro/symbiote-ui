import { hasComponent } from './component-registry.js';
import { listComponentSelections } from './component-selection.js';

/**
 * @typedef {object} ComponentRecipe
 * @property {string} intent Short need phrase an author would describe ("tabular data", "modal dialog").
 * @property {string} component Existing component tagName to reuse for this intent.
 * @property {string} when One-line "use when…" guidance for picking this component.
 * @property {string} antipattern One-line "don't hand-roll a …" reminder.
 */

const RECIPES_ORDER = [
  'sn-data-table',
  'sn-description-list',
  'sn-status-light',
  'sn-badge',
  'sn-card',
  'sn-dialog',
  'sn-drawer',
  'sn-toast',
  'sn-banner',
  'sn-empty-state',
  'sn-metric',
  'sn-tree-view',
  'sn-listbox',
  'sn-accordion',
  'sn-popover',
  'sn-field',
  'sn-select',
  'sn-combobox',
  'sn-switch',
  'sn-progress-bar',
  'sn-progress-ring',
  'sn-avatar',
  'sn-tag',
  'code-block',
  'sn-tooltip',
  'sn-timeline',
  'sn-stepper',
  'sn-breadcrumb',
  'sn-pagination',
  'sn-skeleton'
];

/**
 * Live intent → component reuse index, projected at runtime from selection guidance
 * and filtered against the live registry.
 *
 * @returns {ComponentRecipe[]} Grounded recipes whose component passes `hasComponent`.
 */
export function listComponentRecipes() {
  let selections = listComponentSelections();
  let recipeMap = new Map();
  for (let s of selections) {
    if (s.guidance !== null && hasComponent(s.tagName)) {
      recipeMap.set(s.tagName, {
        intent: s.guidance.intent,
        component: s.tagName,
        when: s.guidance.when,
        antipattern: s.guidance.antipattern,
      });
    }
  }

  let ordered = [];
  for (let tagName of RECIPES_ORDER) {
    let recipe = recipeMap.get(tagName);
    if (recipe) {
      ordered.push(recipe);
    }
  }
  return ordered;
}

/**
 * Versioned descriptor wrapping the grounded recipe index for discovery output.
 *
 * @returns {{ version: string, count: number, recipes: ComponentRecipe[] }} Recipe descriptor.
 */
export function getComponentRecipesDescriptor() {
  let recipes = listComponentRecipes();
  return {
    version: 'component-recipes-v1',
    count: recipes.length,
    recipes,
  };
}

/**
 * Find the best-matching recipe for a free-text intent query.
 *
 * Scores each query word by whole-word match against the intent words and the
 * component tag words (so "table" finds `sn-data-table`), with a substring
 * fallback. Higher score wins; ties prefer the shorter, more specific intent.
 *
 * @param {string} query Free-text description of the UI need.
 * @returns {ComponentRecipe | null} Best matching recipe, or null when none match.
 */
export function recipeForIntent(query) {
  let needle = String(query ?? '').trim().toLowerCase();
  if (!needle) return null;
  let queryWords = needle.split(/\s+/).filter(Boolean);
  let best = null;
  let bestScore = 0;
  for (let recipe of listComponentRecipes()) {
    let intent = recipe.intent.toLowerCase();
    let intentWords = intent.split(/\s+/);
    let tagWords = recipe.component.toLowerCase().replace(/^sn-/, '').split('-');
    let score = 0;
    for (let word of queryWords) {
      if (intentWords.includes(word) || tagWords.includes(word)) score += 2;
      else if (intent.includes(word)) score += 1;
    }
    if (score > bestScore || (score === bestScore && score > 0 && recipe.intent.length < best.intent.length)) {
      best = recipe;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}
