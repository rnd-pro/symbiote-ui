#!/usr/bin/env node

import { fileURLToPath } from 'node:url';

import { cmdDiscover } from './discover.js';

let command = process.argv[2] || 'discover';
let isMain = fileURLToPath(import.meta.url) === process.argv[1];

if (isMain && command === 'discover') {
  let result = await cmdDiscover({});
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else if (isMain) {
  console.log(`symbiote-ui CLI

Commands:
  discover    Output provider metadata as JSON
`);
  if (command && command !== '--help' && command !== '-h') process.exit(1);
}
