#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { cmdDiscover } from './discover.js';
import { cmdAudit } from './audit.js';

let command = process.argv[2] || 'discover';
let modulePath = fileURLToPath(import.meta.url);
let argvPath = process.argv[1] || '';
let isMain = modulePath === argvPath;

if (!isMain && argvPath) {
  try {
    isMain = modulePath === realpathSync(argvPath);
  } catch (error) {
    void error;
  }
}

if (isMain && command === 'discover') {
  let result = await cmdDiscover({});
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
} else if (isMain && command === 'audit') {
  let result = await cmdAudit({});
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!result.valid) {
    process.exit(1);
  }
} else if (isMain) {
  console.log(`symbiote-ui CLI

Commands:
  discover    Output provider metadata as JSON
  audit       Audit package rules, metadata, and CSS style tokens
`);
  if (command && command !== '--help' && command !== '-h') process.exit(1);
}
