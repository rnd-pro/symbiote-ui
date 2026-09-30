export const COMPONENT_SCENARIOS_VERSION = 'component-scenarios-v1';

/**
 * List all curated component integration scenarios.
 * Returns an empty array in the initial implementation.
 * @returns {any[]} List of scenarios.
 */
export function listComponentScenarios() {
  return [];
}

/**
 * Retrieve a specific scenario by its unique identifier.
 * @param {string} id Unique scenario identifier.
 * @returns {any|null} The scenario object or null.
 */
export function getComponentScenario(id) {
  if (typeof id !== 'string') {
    throw new TypeError('Scenario ID must be a string');
  }
  return null;
}

/**
 * Retrieve all scenarios targeting a specific component.
 * @param {string} tagName Component tag name.
 * @returns {any[]} List of scenarios matching the component.
 */
export function listComponentScenariosForComponent(tagName) {
  if (typeof tagName !== 'string') {
    throw new TypeError('Component tagName must be a string');
  }
  return [];
}
