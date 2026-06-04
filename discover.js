import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAllSocketTypes,
  getNodeMenu,
  listDrivers,
  listPacks,
  loadHandlers,
} from 'symbiote-engine';

import { HTML_IN_CANVAS_RENDERER } from './canvas/html-in-canvas.js';
import {
  getTheme,
  getThemeControls,
  getThemeRecipe,
  getThemeTokens,
  getUiSchema,
  listComponents,
  listGraphSchemas,
  listProjectSchemas,
  listRules,
  listThemeElementGroups,
  listThemeRuntimeDescriptors,
  listThemeRuleBlocks,
  listTokenFiles,
  RULESETS,
  THEME_NAMES,
  UI_SCHEMA_VERSIONS,
} from './manifest/index.js';
import { DEFAULT_LOCALE, LOCALE_CATALOG_KEYS, SUPPORTED_LOCALES } from './locale/index.js';
import { WEBXR_RENDERER, XR_THREE_WEBXR_ADAPTER } from './xr/index.js';

let __dirname = dirname(fileURLToPath(import.meta.url));
let PKG_PATH = resolve(__dirname, 'package.json');
let PKG = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));

const EXPORT_ENTRYPOINTS = [
  {
    specifier: 'symbiote-ui',
    kind: 'node-safe',
    description: 'Node-safe provider graph/core API, themes, shapes, plugins, and pure UI utilities.',
  },
  {
    specifier: 'symbiote-ui/core',
    kind: 'node-safe',
    description: 'Core graph editor data model primitives.',
  },
  {
    specifier: 'symbiote-engine',
    kind: 'node-safe',
    description: 'Server-side graph runtime, registry, executor, and serialization helpers.',
  },
  {
    specifier: 'symbiote-ui/graph',
    kind: 'node-safe',
    description: 'Universal graph model normalization for UI, workflow, automation, and media projects.',
  },
  {
    specifier: 'symbiote-ui/locale',
    kind: 'node-safe',
    description: 'Node-safe localization catalogs and translation helpers for built-in UI strings.',
  },
  {
    specifier: 'symbiote-ui/manifest',
    kind: 'node-safe',
    description: 'Agent-readable component, theme, token, rule, and schema catalogs.',
  },
  {
    specifier: 'symbiote-ui/layout',
    kind: 'ssr-entry-safe',
    description: 'Layout tree, section registry, and router helpers without browser components.',
  },
  {
    specifier: 'symbiote-ui/xr',
    kind: 'ssr-entry-safe',
    description: 'WebXR capability, spatial layout projection, and XR pointer helpers without renderer lock-in.',
  },
  {
    specifier: 'symbiote-ui/ui',
    kind: 'browser',
    description: 'Browser Web Components, layout modules, themes, router helpers, chat, navigation, and display modules.',
  },
  {
    specifier: 'symbiote-ui/webmcp',
    kind: 'ssr-entry-safe',
    description: 'Explicit WebMCP descriptor helpers and native registration utilities that no-op without a model context.',
  },
  {
    specifier: 'symbiote-ui/custom-elements.json',
    kind: 'metadata',
    description: 'Custom Elements manifest for editor/docs/design-system tooling.',
  },
  {
    specifier: 'symbiote-ui/tokens/*',
    kind: 'metadata',
    description: 'Design token JSON files.',
  },
  {
    specifier: 'symbiote-ui/rules/*',
    kind: 'metadata',
    description: 'Machine-readable library and Symbiote rules.',
  },
  {
    specifier: 'symbiote-ui/schemas/*',
    kind: 'metadata',
    description: 'Graph, UI, runtime, theme, and WebMCP schema JSON files.',
  },
];

function listPackageExportSubpaths() {
  return Object.keys(PKG.exports || {}).sort().map((subpath) => {
    let target = PKG.exports[subpath];
    let importTarget = typeof target === 'string' ? target : target?.import || target?.default || null;
    return {
      subpath,
      specifier: subpath === '.' ? PKG.name : `${PKG.name}/${subpath.replace(/^\.\//, '')}`,
      target: importTarget,
    };
  });
}

async function loadRuntimePacks(packs) {
  let packList = Array.isArray(packs) ? packs : String(packs).split(',');
  for (let pack of packList) {
    let packName = pack.trim();
    if (packName) {
      await import(`symbiote-engine/packs/${packName}-pack.js`);
    }
  }
}

/**
 * Discover provider catalogs, rules, themes, schemas, and runtime menu data.
 * @param {Object} [options]
 * @returns {Promise<object>}
 */
export async function cmdDiscover(options = {}) {
  if (options.pack) {
    await loadRuntimePacks(options.pack);
  }

  if (options.handlers) {
    let dir = resolve(/** @type {string} */ (options.handlers));
    await loadHandlers(dir);
  }

  let drivers = listDrivers();
  let menu = getNodeMenu();
  let socketTypes = getAllSocketTypes();
  let packs = listPacks();

  return {
    command: 'discover',
    package: {
      name: PKG.name,
      version: PKG.version,
      description: PKG.description,
    },
    exports: {
      subpaths: listPackageExportSubpaths(),
      entrypoints: EXPORT_ENTRYPOINTS,
    },
    registry: {
      totalDrivers: drivers.length,
      drivers: drivers.map((d) => ({
        type: d.type,
        category: d.category,
        icon: d.icon,
        inputs: (d.driver.inputs || []).map((inp) => ({ name: inp.name, type: inp.type, label: inp.label })),
        outputs: (d.driver.outputs || []).map((out) => ({ name: out.name, type: out.type, label: out.label })),
        description: d.driver.description,
        params: Object.entries(d.driver.params || {}).map(([name, p]) => ({ name, type: p.type, required: p.required, default: p.default })),
      })),
      menu: menu.map((group) => ({
        category: group.category,
        nodes: group.nodes,
      })),
      packs,
    },
    socketTypes: [...socketTypes.entries()].map(([name, s]) => ({
      name,
      label: s.label || name,
      color: s.color || null,
      description: s.description || null,
    })),
    manifest: {
      localization: {
        defaultLocale: DEFAULT_LOCALE,
        supportedLocales: [...SUPPORTED_LOCALES],
        autoDetection: 'browser-navigator-languages',
        catalogKeys: [...LOCALE_CATALOG_KEYS],
      },
      renderers: [
        HTML_IN_CANVAS_RENDERER,
        WEBXR_RENDERER,
        XR_THREE_WEBXR_ADAPTER,
      ],
      components: listComponents().map((c) => ({
        tagName: c.tagName,
        className: c.className,
        module: c.module,
        specifier: c.specifier,
        exportName: c.exportName,
        importKind: c.importKind,
        category: c.category,
        description: c.description,
        contract: c.contract || null,
      })),
      themes: THEME_NAMES.map((name) => ({
        name,
        ...getTheme(name),
        tokens: getThemeTokens(name),
      })),
      themeRuntimeDescriptors: listThemeRuntimeDescriptors(),
      themeRuleBlocks: listThemeRuleBlocks(),
      themeControls: {
        ...Object.fromEntries(THEME_NAMES.map((name) => [name, getThemeControls(name)])),
        ...Object.fromEntries(listThemeRuntimeDescriptors().map((descriptor) => [descriptor.name, descriptor.controls])),
      },
      themeElementGroups: listThemeElementGroups(),
      themeRecipes: THEME_NAMES.map((name) => getThemeRecipe(name)).filter(Boolean),
      tokenFiles: listTokenFiles(),
      rulesets: RULESETS.map((rs) => ({
        name: rs.name,
        version: rs.version,
        path: rs.path,
        description: rs.description,
        rules: listRules({ ruleset: rs.name }),
      })),
      rules: listRules(),
      schemas: [
        ...listGraphSchemas(),
        ...listProjectSchemas(),
        ...UI_SCHEMA_VERSIONS.map((sv) => ({
          version: sv.version,
          path: sv.path,
          description: sv.description,
          ...getUiSchema(sv.version),
        })),
      ],
    },
  };
}
