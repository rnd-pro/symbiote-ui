import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const playerStyles = new URL('../chat/ChatShowPlayer/ChatShowPlayer.css.js', import.meta.url);
const playerTemplate = new URL('../chat/ChatShowPlayer/ChatShowPlayer.tpl.js', import.meta.url);

test('show transport buttons reuse the shared button-state recipe', async () => {
  let [styles, template] = await Promise.all([
    readFile(playerStyles, 'utf8'),
    readFile(playerTemplate, 'utf8'),
  ]);

  // Actual container: transport buttons are direct children of
  // .chat-show-controls; no singular .chat-show-control wrapper exists.
  assert.match(template, /class="chat-show-controls"/);
  assert.match(template, /chat-show-primary-control/);
  assert.doesNotMatch(template, /class="chat-show-control"/);

  // Selectors nested inside `.chat-show-controls` must not repeat the
  // container prefix: `.chat-show-controls button:hover` nested in the block
  // compiles to a doubled `.chat-show-controls .chat-show-controls` scope
  // that never matches a direct-child button.
  assert.doesNotMatch(styles, /\.chat-show-controls\s+\.chat-show-controls/);

  // Shared state recipe on the real container (hover, keyboard focus,
  // pressed, disabled) — no independent CV-side button rule set.
  assert.match(styles, /button:hover:not\(:disabled\)\s*\{[\s\S]*?--sn-sys-state-hover-mix/);
  assert.match(styles, /\.chat-show-primary-control:hover[\s\S]*?--sn-sys-state-pressed-mix/);
  assert.match(styles, /button:focus-visible\s*\{[\s\S]*?outline:\s*var\(--sn-effect-focus-ring/);
  assert.match(styles, /button:active\s*\{[\s\S]*?--sn-sys-state-pressed-mix/);
  assert.match(styles, /button:disabled\s*\{[\s\S]*?opacity:\s*var\(--sn-button-disabled-opacity/);
  // Touch: no sticky hover — resting backgrounds restored.
  assert.match(styles, /@media \(hover: none\)\s*\{[\s\S]*?button:hover\s*\{[\s\S]*?background:\s*var\(--sn-node-bg\);/);
  assert.doesNotMatch(styles, /\.chat-show-control\s+button/);
});

test('current row carries an animated dashed contour marker', async () => {
  let styles = await readFile(playerStyles, 'utf8');

  // The marker lives on a dedicated ::after pseudo-element of the current row
  // so the row itself keeps its resting background/outline layout.
  assert.match(styles, /&\[current\]::after\s*\{/);

  // Dashed contour: repeating gradient stripes confined to the edges must be
  // animated ("marching ants"), not a static dash pattern.
  let marker = styles.match(/&\[current\]::after\s*\{[\s\S]*?\n {4}\}/);
  assert.ok(marker, 'current-row ::after block must exist');
  assert.match(marker[0], /repeating-linear-gradient/);
  assert.match(marker[0], /animation:\s*chat-show-active-marching\s+var\(--sn-chat-show-active-marching-duration/);

  // The keyframes advance background-position so the dashes cycle.
  assert.match(styles, /@keyframes chat-show-active-marching\s*\{[\s\S]*?background-position/);

  // Reduced-motion users get a static marker.
  assert.match(styles, /prefers-reduced-motion: reduce[\s\S]*?&\[current\]::after\s*\{\s*animation:\s*none/);
});

test('show header actions expose the shared icon-button state recipe', async () => {
  let styles = await readFile(playerStyles, 'utf8');

  assert.match(styles, /\.chat-show-header-action:hover[\s\S]*?--sn-sys-state-hover-mix/);
  assert.match(styles, /\.chat-show-header-action:focus-visible\s*\{[\s\S]*?outline:\s*var\(--sn-effect-focus-ring/);
  assert.match(styles, /\.chat-show-header-action:active\s*\{[\s\S]*?--sn-sys-state-pressed-mix/);
});
