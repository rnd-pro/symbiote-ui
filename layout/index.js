/**
 * @fileoverview SSR-safe layout primitives.
 *
 * This entrypoint exposes pure layout tree, routing, and section registry
 * helpers. Browser custom elements are exposed from `symbiote-ui/ui`.
 */

export * as LayoutTree from './LayoutTree.js';
export {
  buildHash,
  buildQuery,
  getRoute,
  navigate,
  parseQuery,
  registerGlobalParam,
  setDefaultPanel,
  setGlobalParam,
  updateParams,
} from './LayoutRouter/LayoutRouter.js';
export {
  setupPanelRouting,
  syncWithRouter,
} from './LayoutRouter/routerSync.js';
export {
  SECTION_SCOPES,
  SectionRegistry,
  createSectionRegistry,
  normalizeSectionScope,
  sectionMatchesScope,
  withGlobalPanel,
  registerSection,
  getSection,
  getSections,
  getHomeSections,
  getProjectSections,
  getSectionsForScope,
  getLayout,
  hasSection,
  clearSections,
} from './LayoutRouter/SectionRegistry.js';
