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

test('show header actions expose the shared icon-button state recipe', async () => {
  let styles = await readFile(playerStyles, 'utf8');

  assert.match(styles, /\.chat-show-header-action:hover[\s\S]*?--sn-sys-state-hover-mix/);
  assert.match(styles, /\.chat-show-header-action:focus-visible\s*\{[\s\S]*?outline:\s*var\(--sn-effect-focus-ring/);
  assert.match(styles, /\.chat-show-header-action:active\s*\{[\s\S]*?--sn-sys-state-pressed-mix/);
});
