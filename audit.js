import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RULES } from './manifest/rule-catalog.js';
import { listComponents } from './manifest/component-registry.js';
import { lintComponentCss } from './tokens/geometry-lint.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Regex to find literal hex, rgb, rgba, hsl, hsla colors
const COLOR_REG = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)/g;

// Safe regex for common named colors in property values (e.g., color: red)
const NAMED_COLOR_REG = /:\s*(?:red|blue|green|yellow|orange|purple|pink|brown|black|white|cyan|magenta|transparent)\b/gi;

function findCssFiles(dir, files = []) {
  let entries = readdirSync(dir);
  for (let entry of entries) {
    // Skip non-component trees: deps, the internal demo/catalog showcase apps,
    // assembled build output, and scratch. The geometry/color contract applies
    // to shippable component CSS, not these.
    if (
      entry === 'node_modules' ||
      entry === 'demo' ||
      entry === 'catalog' ||
      entry === '_site' ||
      entry === 'tmp' ||
      entry.startsWith('.')
    ) {
      continue;
    }
    let fullPath = resolve(dir, entry);
    let stat = statSync(fullPath);
    if (stat.isDirectory()) {
      findCssFiles(fullPath, files);
    } else if (entry.endsWith('.css.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Audit symbiote-ui rules, components, and CSS files.
 * @param {Object} [options]
 * @returns {Promise<Object>}
 */
export async function cmdAudit(options = {}) {
  let errors = [];
  let warnings = [];

  // 1. Rule Catalog Synchronization Check
  try {
    let jsonRulesPath = resolve(__dirname, 'rules/symbiote-3x.json');
    let jsonRulesData = JSON.parse(readFileSync(jsonRulesPath, 'utf-8'));
    let jsonRules = jsonRulesData.rules || [];

    // Map by ID
    let catalogMap = new Map(RULES.map(r => [r.id, r]));
    let jsonMap = new Map(jsonRules.map(r => [r.id, r]));

    // Check catalog rules in json
    for (let rule of RULES) {
      let jsonRule = jsonMap.get(rule.id);
      if (!jsonRule) {
        errors.push({
          type: 'rule-sync',
          message: `Rule '${rule.id}' (${rule.name}) exists in manifest/rule-catalog.js but is missing from rules/symbiote-3x.json.`
        });
      } else {
        // Verify fields
        if (rule.name !== jsonRule.name) {
          errors.push({
            type: 'rule-sync',
            message: `Rule name mismatch for '${rule.id}': catalog='${rule.name}', json='${jsonRule.name}'.`
          });
        }
        if (rule.severity !== jsonRule.severity) {
          errors.push({
            type: 'rule-sync',
            message: `Rule severity mismatch for '${rule.id}': catalog='${rule.severity}', json='${jsonRule.severity}'.`
          });
        }
      }
    }

    // Check json rules in catalog
    for (let rule of jsonRules) {
      if (!catalogMap.has(rule.id)) {
        errors.push({
          type: 'rule-sync',
          message: `Rule '${rule.id}' (${rule.name}) exists in rules/symbiote-3x.json but is missing from manifest/rule-catalog.js.`
        });
      }
    }
  } catch (err) {
    errors.push({
      type: 'rule-sync',
      message: `Failed to verify rules sync: ${err.message}`
    });
  }

  // 2. Component Manifest ↔ Custom-Elements Sync Check
  try {
    let customElementsPath = resolve(__dirname, 'custom-elements.json');
    let customElements = JSON.parse(readFileSync(customElementsPath, 'utf-8'));
    let customElementTags = new Set();

    if (customElements.modules) {
      for (let mod of customElements.modules) {
        if (mod.declarations) {
          for (let dec of mod.declarations) {
            if (dec.tagName) {
              customElementTags.add(dec.tagName);
            }
          }
        }
      }
    }

    let catalogComponents = listComponents({ includeInternal: true, includeExperimental: true });
    let catalogTags = new Set(catalogComponents.map(c => c.tagName));

    // Check catalog components in custom-elements
    for (let tagName of catalogTags) {
      if (!customElementTags.has(tagName)) {
        warnings.push({
          type: 'component-sync',
          message: `Component '${tagName}' is registered in manifest/component-registry.js but is missing from custom-elements.json.`
        });
      }
    }

    // Check custom-elements in catalog (only for sn-* prefix or known registry tags to avoid third-party element conflicts)
    for (let tagName of customElementTags) {
      if (tagName.startsWith('sn-') && !catalogTags.has(tagName)) {
        warnings.push({
          type: 'component-sync',
          message: `Component '${tagName}' exists in custom-elements.json but is missing from manifest/component-registry.js.`
        });
      }
    }
  } catch (err) {
    errors.push({
      type: 'component-sync',
      message: `Failed to verify component manifest sync: ${err.message}`
    });
  }

  // 3. Hardcoded CSS Color Linting
  try {
    let cssFiles = findCssFiles(__dirname);
    for (let file of cssFiles) {
      let content = readFileSync(file, 'utf-8');
      let lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Skip line if it contains an exclusion comment
        if (
          line.includes('lint-allow') ||
          line.includes('audit-ok') ||
          line.includes('audit-allow') ||
          line.includes('lint-ok')
        ) {
          continue;
        }

        // Check for color expressions
        let colorMatches = line.match(COLOR_REG);
        if (colorMatches) {
          for (let match of colorMatches) {
            warnings.push({
              type: 'css-lint',
              file: file.replace(__dirname + '/', ''),
              line: i + 1,
              message: `Hardcoded color '${match}' found in CSS. Use CSS custom properties (--sn-*) instead.`
            });
          }
        }

        // Check for named color assignments
        let namedColorMatches = line.match(NAMED_COLOR_REG);
        if (namedColorMatches) {
          for (let match of namedColorMatches) {
            let colorWord = match.split(':')[1].trim();
            warnings.push({
              type: 'css-lint',
              file: file.replace(__dirname + '/', ''),
              line: i + 1,
              message: `Hardcoded named color '${colorWord}' found in CSS property. Use CSS custom properties (--sn-*) instead.`
            });
          }
        }
      }
    }
  } catch (err) {
    errors.push({
      type: 'css-lint',
      message: `Failed to scan CSS files: ${err.message}`
    });
  }

  // 4. Hardcoded geometry / motion linting (SYM-015 consumption side)
  try {
    let cssFiles = findCssFiles(__dirname);
    let profile = options.profile;
    for (let file of cssFiles) {
      let content = readFileSync(file, 'utf-8');
      let relative = file.replace(__dirname + '/', '');
      let { findings } = lintComponentCss({ content, file: relative, profile });
      for (let finding of findings) {
        if (finding.severity === 'error') errors.push(finding);
        else warnings.push(finding);
      }
    }
  } catch (err) {
    errors.push({
      type: 'geometry-lint',
      message: `Failed to lint component geometry: ${err.message}`
    });
  }

  return {
    command: 'audit',
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
