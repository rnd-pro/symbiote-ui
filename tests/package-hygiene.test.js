import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args, options = {}) {
  let result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...options,
  });
  assert.equal(
    result.status,
    0,
    `${command} ${args.join(' ')} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  return result;
}

function assertNoPrivatePackFiles(files) {
  let blockedPatterns = [
    /^\.agent-portal(?:\/|$)/,
    /^\.gitmodules$/,
    /^tmp(?:\/|$)/,
    /(?:^|\/)delegation(?:\/|$)/,
    /(?:^|\/)(?:audit|scratch|probe|screenshot|session|private-memory)/i,
    /\.(?:png|jpe?g|webp|gif)$/i,
  ];
  for (let file of files) {
    assert.equal(file.includes('/Users/'), false, `packed file leaks local path: ${file}`);
    assert.equal(file.includes('team-memory'), false, `packed file leaks private memory name: ${file}`);
    assert.equal(
      blockedPatterns.some((pattern) => pattern.test(file)),
      false,
      `private or scratch file included in pack output: ${file}`
    );
  }
}

async function listTextFiles(root, dir = root) {
  let entries = await readdir(dir, { withFileTypes: true });
  let files = [];
  for (let entry of entries) {
    let fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTextFiles(root, fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (/\.(?:ttf|png|jpe?g|webp|gif|tgz)$/i.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

async function assertNoPrivatePackContent(packageDir) {
  let blockedPatterns = [
    /\/Users\//,
    /\.agent-portal/,
    /team-memory/i,
    /private memory/i,
    /Bearer\s+[A-Za-z0-9._-]+/,
    /(?:api[_-]?key|secret|token)\s*[:=]\s*['"][A-Za-z0-9._-]{12,}/i,
    /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/,
    /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
    /\bnpm_[A-Za-z0-9]{20,}\b/,
  ];
  for (let file of await listTextFiles(packageDir)) {
    let text = await readFile(file, 'utf8');
    for (let pattern of blockedPatterns) {
      assert.equal(pattern.test(text), false, `packed file content failed hygiene scan: ${file}`);
    }
  }
}

test('npm pack output excludes private memory and scratch artifacts', async () => {
  let result = run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts']);
  let [pack] = JSON.parse(result.stdout);
  let files = pack.files.map((file) => file.path);

  assert.equal(pack.name, 'symbiote-ui');
  assert.ok(files.includes('package.json'));
  assert.ok(files.includes('custom-elements.json'));
  assert.ok(files.includes('index.js'));
  assert.ok(files.includes('ui/index.js'));
  assert.ok(files.includes('runtime/index.js'));
  assert.ok(files.includes('manifest/component-registry.js'));
  assertNoPrivatePackFiles(files);
});

test('packed package imports from a consumer project with SSR-safe entrypoints', async () => {
  let tmpRoot = await mkdtemp(join(tmpdir(), 'symbiote-ui-pack-'));
  try {
    let packResult = run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', tmpRoot]);
    let [pack] = JSON.parse(packResult.stdout);
    let tarball = join(tmpRoot, pack.filename);
    let packageDir = join(tmpRoot, 'package');
    let consumerDir = join(tmpRoot, 'consumer');

    run('tar', ['-xzf', tarball, '-C', tmpRoot]);
    await assertNoPrivatePackContent(packageDir);
    await mkdir(join(consumerDir, 'node_modules', '@symbiotejs'), { recursive: true });
    await symlink(packageDir, join(consumerDir, 'node_modules', 'symbiote-ui'), 'dir');
    await symlink(
      resolve(repoRoot, 'node_modules', '@symbiotejs', 'symbiote'),
      join(consumerDir, 'node_modules', '@symbiotejs', 'symbiote'),
      'dir'
    );
    await symlink(
      resolve(repoRoot, 'node_modules', 'symbiote-engine'),
      join(consumerDir, 'node_modules', 'symbiote-engine'),
      'dir'
    );

    let smoke = `
      const root = await import('symbiote-ui');
      const core = await import('symbiote-ui/core');
      const basePath = await import('symbiote-ui/core/base-path.js');
      const runtime = await import('symbiote-ui/runtime');
      const manifest = await import('symbiote-ui/manifest');
      const webmcp = await import('symbiote-ui/webmcp');
      if (typeof root.NodeEditor !== 'function') throw new Error('missing root NodeEditor');
      if (typeof core.NodeEditor !== 'function') throw new Error('missing core NodeEditor');
      if (typeof basePath.withAppBasePath !== 'function') throw new Error('missing core base-path helper');
      if (runtime.RUNTIME_UI_CONTRACT.version !== 'runtime-ui-v1') throw new Error('bad runtime contract');
      if (typeof manifest.listComponents !== 'function') throw new Error('missing manifest listComponents');
      if (typeof webmcp.createToolDescriptor !== 'function') throw new Error('missing webmcp helper');
    `;
    run(process.execPath, ['--input-type=module', '-e', smoke], { cwd: consumerDir });
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
});

test('all public core subpath modules import in Node without DOM globals', async () => {
  let coreDir = resolve(repoRoot, 'core');
  let files = (await readdir(coreDir))
    .filter((file) => file.endsWith('.js'))
    .sort();
  assert.ok(files.includes('base-path.js'));

  for (let file of files) {
    await import(new URL(`../core/${file}`, import.meta.url).href);
  }
});

test('JSDA integration stays outside mandatory runtime dependencies', async () => {
  let pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies?.['jsda-kit'], undefined);
  assert.equal(pkg.peerDependencies?.['jsda-kit'], undefined);
  assert.equal(pkg.optionalDependencies?.['jsda-kit'], undefined);
  assert.equal(pkg.dependencies?.linkedom, undefined);
  assert.equal(pkg.peerDependencies?.linkedom, undefined);
});

test('browser component modules stay behind the explicit UI entrypoint DOM guard', async () => {
  let [rootSource, coreSource, uiSource] = await Promise.all([
    readFile(new URL('../index.js', import.meta.url), 'utf8'),
    readFile(new URL('../core/index.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui/index.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(rootSource, /from ['"]\.\/ui(?:\/index\.js)?['"]/);
  assert.doesNotMatch(coreSource, /from ['"]\.\.\/ui(?:\/index\.js)?['"]/);
  for (let browserComponentImport of [
    "import('../chat/ChatComposer/ChatComposer.js')",
    "import('../canvas/NodeCanvas/NodeCanvas.js')",
    "import('../layout/Layout/Layout.js')",
    "import('../effects/CellBg/CellBg.js')",
    "import('../themes/CascadeThemeEditor/CascadeThemeEditor.js')",
  ]) {
    let guardIndex = uiSource.indexOf('if (hasDOMGlobals)');
    let importIndex = uiSource.indexOf(browserComponentImport);
    assert.ok(importIndex > guardIndex, `${browserComponentImport} must stay behind hasDOMGlobals`);
  }
  assert.match(uiSource, /typeof window !== 'undefined'/);
  assert.match(uiSource, /typeof customElements !== 'undefined'/);
});
