import { acquireCurrentTestFileLock } from './test-lock.js';
await acquireCurrentTestFileLock(import.meta.url);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { RND, RND_PALETTE } from '../themes/rnd.js';
import { RND_DARK, RND_DARK_PALETTE } from '../themes/rnd-dark.js';
import { hoverMarksBackgroundImage, hoverMarksStyles } from '../themes/hover-marks-styles.js';
import * as themeCatalog from '../manifest/theme-catalog.js';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readTokenFile(name) {
  return JSON.parse(readFileSync(resolve(rootDir, 'tokens/themes', `${name}.json`), 'utf8'));
}

const HARD_SHADOW_RE = /^(-?\d+(?:\.\d+)?px -?\d+(?:\.\d+)?px 0 0)( var\(--sn-shadow-color\))?$/;

function forEachLeaf(node, visit, path = []) {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('$') || key === 'name' || key === 'extends') continue;
    if (value && typeof value === 'object' && '$value' in value) {
      visit([...path, key], value);
    } else if (value && typeof value === 'object') {
      forEachLeaf(value, visit, [...path, key]);
    }
  }
}

test('rnd and rnd-dark export ThemeDefinition objects', () => {
  assert.equal(RND.name, 'rnd');
  assert.equal(RND_DARK.name, 'rnd-dark');
  for (const theme of [RND, RND_DARK]) {
    assert.ok(theme.tokens && typeof theme.tokens === 'object');
    assert.ok(Object.keys(theme.tokens).length > 40, `${theme.name} carries a full token set`);
    for (const [token, value] of Object.entries(theme.tokens)) {
      assert.ok(token.startsWith('--sn-'), `${theme.name}: ${token} is an --sn-* token`);
      assert.equal(typeof value, 'string', `${theme.name}: ${token} value is a string`);
    }
  }
  assert.equal(RND_PALETTE.name, 'rnd');
  assert.equal(RND_DARK_PALETTE.name, 'rnd-dark');
});

test('rnd brand tokens: square radii', () => {
  for (const token of [
    '--sn-node-radius',
    '--sn-card-radius',
    '--sn-comment-radius',
    '--sn-dialog-radius',
    '--sn-button-radius',
  ]) {
    assert.equal(RND.tokens[token], '0', `rnd ${token} is 0`);
    assert.equal(RND_DARK.tokens[token], '0', `rnd-dark ${token} is 0`);
  }
});

test('rnd shadows are hard offsets: no blur, no rgba', () => {
  for (const theme of [RND, RND_DARK]) {
    for (const token of [
      '--sn-shadow-sm',
      '--sn-shadow-md',
      '--sn-shadow-lg',
      '--sn-shadow-xl',
      '--sn-node-shadow',
      '--sn-card-shadow',
      '--sn-card-shadow-hover',
    ]) {
      const value = theme.tokens[token];
      assert.ok(value, `${theme.name} defines ${token}`);
      assert.doesNotMatch(value, /rgba|hsl/, `${theme.name} ${token} carries no rgba/hsl blur color`);
      assert.match(value, HARD_SHADOW_RE, `${theme.name} ${token} is an offset-only hard shadow`);
    }
    assert.equal(theme.tokens['--sn-shadow-color'], 'currentColor', `${theme.name} shadow color is currentColor`);
    assert.equal(theme.tokens['--sn-shadow-lg'], '5px 5px 0 0 var(--sn-shadow-color)', `${theme.name} card shadow is 5px`);
    assert.match(theme.tokens['--sn-effect-focus-ring'], /^3px 3px 0 0 /, `${theme.name} focus ring is a 3px hard offset`);
  }
});

test('rnd keeps the binary accent flip readable', () => {
  assert.equal(RND.tokens['--sn-sys-accent'], '#2b2b2b');
  assert.equal(RND.tokens['--sn-sys-on-accent'], '#dddddd');
  assert.equal(RND_DARK.tokens['--sn-sys-accent'], '#dddddd');
  assert.equal(RND_DARK.tokens['--sn-sys-on-accent'], '#2b2b2b');
  assert.doesNotMatch(RND.tokens['--sn-sys-accent'], /[1-9][0-9]?\s*,\s*[1-9]/, 'accent carries no chroma');
});

test('rnd typography starts with Roboto and maps body to a type rung', () => {
  for (const theme of [RND, RND_DARK]) {
    assert.ok(theme.tokens['--sn-font'].startsWith("'Roboto'"), `${theme.name} font stack starts with Roboto`);
    assert.equal(theme.tokens['--sn-font-size'], 'var(--sn-text-xl)', `${theme.name} body maps to the 16px rung`);
  }
});

test('rnd control height is the brand 40px and borders are 2px', () => {
  for (const theme of [RND, RND_DARK]) {
    assert.equal(theme.tokens['--sn-button-min-height'], '40px', `${theme.name} button min-height`);
    assert.equal(theme.tokens['--sn-node-border-width'], '2px', `${theme.name} surface border width`);
    assert.equal(theme.tokens['--sn-card-border-width'], '2px', `${theme.name} card border width`);
    assert.equal(theme.tokens['--sn-button-border-width'], '2px', `${theme.name} button border width`);
  }
});

test('rnd hover marks arrive through the shared helper token', () => {
  for (const theme of [RND, RND_DARK]) {
    const marks = theme.tokens['--sn-button-hover-marks'];
    assert.equal(marks, hoverMarksBackgroundImage, `${theme.name} consumes the shared helper`);
    assert.equal(marks.match(/linear-gradient/g).length, 8, '8 corner marks');
    assert.match(marks, /var\(--sn-hover-mark-thickness, 2px\)/, 'mark thickness is tokenized with a 2px fallback');
  }
  assert.match(hoverMarksStyles, /background-size: var\(--sn-hover-mark-size, 12px\)/, 'mark size is tokenized with a 12px fallback');
  assert.match(hoverMarksStyles, /background-position: 0 0, 0 100%, 100% 0, 100% 100%, 0 0, 100% 0, 0 100%, 100% 100%/);
  assert.match(hoverMarksStyles, /currentColor/);
});

test('rnd-dark keeps the brand rules and only flips the pair', () => {
  assert.equal(RND_DARK.tokens['--sn-sys-surface'], '#2b2b2b');
  assert.equal(RND_DARK.tokens['--sn-sys-on-surface'], '#dddddd');
  assert.equal(RND.tokens['--sn-sys-surface'], '#dddddd');
  assert.equal(RND.tokens['--sn-sys-on-surface'], '#2b2b2b');
  for (const token of ['--sn-sys-success', '--sn-sys-warning', '--sn-sys-danger']) {
    assert.equal(RND_DARK.tokens[token], RND.tokens[token], `${token} is the same in both variants`);
  }
});

test('tokens/themes/rnd.json is a valid DTCG mirror (same shape carbon.json passes)', () => {
  const carbon = readTokenFile('carbon');
  for (const name of ['rnd', 'rnd-dark']) {
    const doc = readTokenFile(name);
    assert.equal(doc.name, name);
    assert.equal(doc.extends, '../base.json');
    assert.equal(doc.$schema, undefined, 'theme mirrors stay silent on schema like carbon');
    for (const group of Object.keys(carbon)) {
      if (group === 'name' || group === 'extends') continue;
      assert.ok(doc[group], `${name}.json keeps the ${group} group carbon.json uses`);
    }
    forEachLeaf(doc, (path, leaf) => {
      assert.ok(leaf.$type, `${name}: ${path.join('.')} has $type`);
      assert.equal(typeof leaf.$value, 'string', `${name}: ${path.join('.')} has a string $value`);
    });
    const base = JSON.parse(readFileSync(resolve(rootDir, 'tokens/base.json'), 'utf8'));
    forEachLeaf(base, (path, leaf) => {
      const mirror = path.reduce((node, key) => (node ? node[key] : undefined), doc);
      assert.ok(mirror?.$value !== undefined, `${name}: ${path.join('.')} mirrors a base role`);
    });
  }
});

test('rnd mirrors agree with the runtime theme values', () => {
  const rnd = readTokenFile('rnd');
  assert.equal(rnd.color.background.$value, RND.tokens['--sn-sys-surface']);
  assert.equal(rnd.color.text.$value, RND.tokens['--sn-sys-on-surface']);
  assert.equal(rnd.color.accent.$value, RND.tokens['--sn-sys-accent']);
  assert.equal(rnd.color.onAccent.$value, RND.tokens['--sn-sys-on-accent']);
  assert.equal(rnd.radius.node.$value, '0px');
  assert.equal(rnd.size.control.$value, RND.tokens['--sn-button-min-height']);
  assert.match(rnd.shadow.node.$value, /^5px 5px 0 0 /, 'DTCG card shadow stays blurless');
  const rndDark = readTokenFile('rnd-dark');
  assert.equal(rndDark.color.background.$value, RND_DARK.tokens['--sn-sys-surface']);
  assert.equal(rndDark.color.accent.$value, RND_DARK.tokens['--sn-sys-accent']);
});

test('rnd is registered for discovery: catalog, token files, and recipes', () => {
  assert.deepEqual(themeCatalog.THEME_NAMES, ['default-provider', 'rnd', 'rnd-dark']);
  for (const name of ['rnd', 'rnd-dark']) {
    const entry = themeCatalog.getTheme(name);
    assert.ok(entry, `${name} listed in TOKEN_FILES`);
    assert.equal(entry.path, `tokens/themes/${name}.json`);
    assert.ok(entry.description, `${name} carries a discover description`);
    assert.ok(themeCatalog.getThemeTokens(name), `${name} carries THEME_TOKENS`);
    const recipe = themeCatalog.getThemeRecipe(name);
    assert.equal(recipe.cssTokenSource, 'runtime-theme', `${name} resolves to its runtime tokens`);
    assert.ok(recipe.cssTokens['--sn-sys-on-accent'], `${name} recipe exposes on-accent`);
    assert.ok(themeCatalog.THEME_RULE_BLOCKS.some((block) => block.theme === name), `${name} is built from a named rule block`);
  }
});

test('rnd recipe CSS tokens classify into the provider rule-block kinds', () => {
  const unclassified = themeCatalog.listThemeCssTokenClassifications('rnd')
    .filter((row) => row.kind === 'unclassified')
    .map((row) => row.cssVar);
  for (const cssVar of unclassified) {
    assert.ok(
      cssVar.startsWith('--sn-sys-'),
      `only sys roles may be unclassified in the rnd recipe, got ${cssVar}`
    );
  }
});

test('default provider registers the hover hooks rnd consumes with inert fallbacks', async () => {
  const { DEFAULT_PROVIDER_THEME } = await import('../themes/default-provider.js');
  const tokens = DEFAULT_PROVIDER_THEME.tokens;
  assert.equal(tokens['--sn-button-hover-marks'], 'none');
  assert.equal(tokens['--sn-card-shadow'], 'none');
  assert.equal(tokens['--sn-card-shadow-hover'], 'none');
  assert.equal(tokens['--sn-card-border-width'], '1px');
  assert.equal(tokens['--sn-button-border-width'], '1px');
  assert.equal(tokens['--sn-hover-mark-size'], '12px');
  assert.equal(tokens['--sn-hover-mark-thickness'], '2px');

  const buttonCss = readFileSync(resolve(rootDir, 'control/Button/Button.css.js'), 'utf8');
  const cardCss = readFileSync(resolve(rootDir, 'surface/Card/Card.css.js'), 'utf8');
  assert.match(buttonCss, /background-image: var\(--sn-button-hover-marks, none\);/);
  assert.match(buttonCss, /border: var\(--sn-button-border-width, 1px\) solid/);
  assert.match(cardCss, /box-shadow: var\(--sn-card-shadow, none\);/);
  assert.match(cardCss, /box-shadow: var\(--sn-card-shadow-hover, none\);/);
});
