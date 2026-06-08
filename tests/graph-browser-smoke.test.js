import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const CHROME_ENDPOINT_TIMEOUT_MS = 30000;
const BROWSER_SMOKE_TIMEOUT_MS = 180000;
const SHOWCASE_BROWSER_SMOKE_TIMEOUT_MS = 200000;
const chromeCandidates = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

function findChrome() {
  return chromeCandidates.find((candidate) => existsSync(candidate)) || '';
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function cssNumber(value) {
  const match = String(value || '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : Number.NaN;
}

function parseComputedRgb(value) {
  const match = String(value || '').match(/rgba?\(([^)]+)\)/);
  assert.ok(match, `expected computed rgb/rgba color, got ${value}`);
  const parts = match[1]
    .replaceAll(',', ' ')
    .split(/[ /\t]+/)
    .filter(Boolean);
  return parts.slice(0, 3).map(Number);
}

function relativeLuminance(rgb) {
  const channels = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(parseComputedRgb(foreground));
  const b = relativeLuminance(parseComputedRgb(background));
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

async function createStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
      const decodedPath = decodeURIComponent(requestUrl.pathname);
      const filePath = path.normalize(path.join(repoRoot, decodedPath));
      if (!filePath.startsWith(repoRoot)) {
        response.writeHead(403);
        response.end('Forbidden');
        return;
      }
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        response.writeHead(404);
        response.end('Not found');
        return;
      }
      response.writeHead(200, { 'content-type': contentType(filePath) });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500);
      response.end(error?.code === 'ENOENT' ? 'Not found' : 'Server error');
    }
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    url: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function waitForChromeEndpoint(chrome, timeoutMs = 10000, remoteDebuggingPort = 0) {
  return new Promise((resolve, reject) => {
    let output = '';
    let done = false;
    const finish = (callback, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      finish(reject, new Error(`Chrome DevTools endpoint was not reported. output:\n${output}`));
    }, timeoutMs);

    const onData = (chunk) => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      finish(resolve, match[1]);
    };

    chrome.stdout?.on('data', onData);
    chrome.stderr?.on('data', onData);

    const pollEndpoint = async () => {
      if (!remoteDebuggingPort || done) return;
      try {
        const response = await fetch(`http://127.0.0.1:${remoteDebuggingPort}/json/version`);
        if (response.ok) {
          const data = await response.json();
          if (data.webSocketDebuggerUrl) {
            finish(resolve, data.webSocketDebuggerUrl);
            return;
          }
        }
      } catch {
        // Chrome is still starting.
      }
      if (!done) setTimeout(pollEndpoint, 80);
    };
    pollEndpoint();

    chrome.once('error', (error) => {
      finish(reject, error);
    });

    chrome.once('exit', (code, signal) => {
      finish(
        reject,
        new Error(`Chrome exited before DevTools endpoint was ready: code=${code ?? 'null'} signal=${signal ?? 'none'}\n${output}`)
      );
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForChromeExit(chrome, timeoutMs = 2500) {
  if (!chrome || chrome.exitCode !== null || chrome.signalCode) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    chrome.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function stopChrome(chrome) {
  if (!chrome) return;
  if (chrome.exitCode === null && !chrome.signalCode) {
    chrome.kill('SIGTERM');
    await waitForChromeExit(chrome, 2500);
  }
  if (chrome.exitCode === null && !chrome.signalCode) {
    chrome.kill('SIGKILL');
    await waitForChromeExit(chrome, 1000);
  }
}

async function launchChromeSession(chromePath, label, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'symbiote-ui-chrome-'));
    const remoteDebuggingPort = await reservePort();
    const chrome = spawn(chromePath, [
      '--headless=new',
      '--disable-background-networking',
      '--disable-gpu',
      '--disable-sync',
      '--hide-scrollbars',
      '--no-default-browser-check',
      '--no-first-run',
      `--remote-debugging-port=${remoteDebuggingPort}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    try {
      const endpoint = await withTimeout(
        waitForChromeEndpoint(chrome, CHROME_ENDPOINT_TIMEOUT_MS, remoteDebuggingPort),
        CHROME_ENDPOINT_TIMEOUT_MS,
        `${label} Chrome DevTools endpoint`
      );
      return { chrome, userDataDir, endpoint };
    } catch (error) {
      lastError = error;
      await stopChrome(chrome);
      await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      if (attempt < attempts) await delay(500 * attempt);
    }
  }
  throw lastError;
}

async function closeChromeSession(session) {
  if (!session) return;
  await stopChrome(session.chrome);
  await rm(session.userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  await delay(300);
}

function createCdpClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const events = new Map();

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}: ${message.error.data || ''}`));
      } else {
        resolve(message.result || {});
      }
      return;
    }
    if (message.method && events.has(message.method)) {
      for (const listener of events.get(message.method)) listener(message.params || {});
    }
  });

  return {
    async send(method, params = {}) {
      await opened;
      const id = nextId++;
      const promise = new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
      socket.send(JSON.stringify({ id, method, params }));
      return promise;
    },
    waitFor(method, timeoutMs = 15000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(new Error(`Timed out waiting for ${method}`));
        }, timeoutMs);
        const listener = (params) => {
          cleanup();
          resolve(params);
        };
        const cleanup = () => {
          clearTimeout(timer);
          const listeners = events.get(method) || [];
          events.set(method, listeners.filter((item) => item !== listener));
        };
        events.set(method, [...(events.get(method) || []), listener]);
      });
    },
    close() {
      socket.close();
    },
  };
}

async function openPage(chromeEndpoint, url) {
  const endpoint = new URL(chromeEndpoint);
  const target = await fetch(`http://${endpoint.host}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
    signal: AbortSignal.timeout(5000),
  }).then((response) => response.json());
  const client = createCdpClient(target.webSocketDebuggerUrl);
  await withTimeout(client.send('Page.enable'), 5000, 'Page.enable');
  await withTimeout(client.send('Runtime.enable'), 5000, 'Runtime.enable');
  const load = client.waitFor('Page.loadEventFired');
  await withTimeout(client.send('Page.navigate', { url }), 5000, 'Page.navigate');
  await withTimeout(load, 15000, 'Page.loadEventFired');
  return client;
}

async function navigatePage(page, url) {
  const load = page.waitFor('Page.loadEventFired');
  await withTimeout(page.send('Page.navigate', { url }), 5000, 'Page.navigate');
  await withTimeout(load, 15000, 'Page.loadEventFired');
}

async function setPageViewport(page, { width, height, mobile = false }) {
  await withTimeout(page.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    mobile,
    deviceScaleFactor: 1,
    screenWidth: width,
    screenHeight: height,
  }), 5000, 'Emulation.setDeviceMetricsOverride');
}

async function evaluateGraphSmoke(page) {
  const expression = String.raw`
    (async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const settle = async () => {
        for (let index = 0; index < 6; index += 1) await frame();
      };
      await Promise.all([
        customElements.whenDefined('graph-explorer-shell'),
        customElements.whenDefined('node-canvas'),
        customElements.whenDefined('graph-node'),
      ]);
      await settle();

      const canvas = document.querySelector('cascade-graph-panel node-canvas');
      if (!canvas) return { error: 'missing node-canvas' };
      await settle();

      const nodes = [...canvas.querySelectorAll('graph-node')];
      const isVisibleBox = (el) => {
        if (!el) return false;
        const style = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none'
          && style.visibility !== 'hidden'
          && Number.parseFloat(style.opacity || '1') > 0
          && rect.width > 1
          && rect.height > 1;
      };
      const readBox = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          width: rect.width,
          height: rect.height,
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          color: style.color,
          backgroundColor: style.backgroundColor,
          fontSize: style.fontSize,
          padding: style.padding,
          visible: isVisibleBox(el),
        };
      };
      const readSvgBox = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          width: rect.width,
          height: rect.height,
          display: style.display,
          visibility: style.visibility,
          fill: style.fill,
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          color: style.color,
          visible: isVisibleBox(el),
        };
      };
      const readNode = (node) => {
        const rect = node.getBoundingClientRect();
        const style = getComputedStyle(node);
        const labelEl = node.querySelector('.sn-node-label');
        const iconEl = node.querySelector('.sn-node-icon, .sn-node-shape-icon');
        const mediaEl = node.querySelector('.sn-node-media-img');
        const bodyEl = node.querySelector('.sn-node-body');
        const svgEl = node.querySelector('.sn-shape-svg, svg');
        const svgPathEl = node.querySelector('.sn-shape-svg path, svg path');
        const label = labelEl?.textContent?.trim() || '';
        const visibleLabel = Boolean(label && isVisibleBox(labelEl));
        const visibleIcon = isVisibleBox(iconEl);
        const visibleMedia = isVisibleBox(mediaEl);
        const visibleBody = isVisibleBox(bodyEl);
        const visibleSvg = isVisibleBox(svgEl) || isVisibleBox(svgPathEl);
        const visibleBodyText = visibleBody ? bodyEl.textContent.trim() : '';
        return {
          id: node._nodeData?.id || node.id || node.getAttribute('node-id') || '',
          label,
          shape: node.getAttribute('node-shape') || '',
          width: rect.width,
          height: rect.height,
          layoutWidth: node.offsetWidth,
          layoutHeight: node.offsetHeight,
          display: style.display,
          visibility: style.visibility,
          visibleLabel,
          visibleIcon,
          visibleMedia,
          visibleBody,
          visibleSvg,
          visibleBodyText,
          hasVisibleContent: visibleLabel || visibleIcon || visibleMedia || visibleSvg || visibleBodyText.length > 0,
          shapeStroke: style.getPropertyValue('--sn-shape-stroke').trim(),
          shapeStrokeWidth: style.getPropertyValue('--sn-shape-stroke-width').trim(),
          nodeIconSize: style.getPropertyValue('--sn-node-icon-size').trim(),
          circleIconSize: style.getPropertyValue('--sn-node-circle-icon-size').trim(),
          circleMediaSize: style.getPropertyValue('--sn-node-circle-media-size').trim(),
          commentPadding: style.getPropertyValue('--sn-node-comment-body-padding').trim(),
          labelBox: readBox(labelEl),
          iconBox: readBox(iconEl),
          mediaBox: readBox(mediaEl),
          bodyBox: readBox(bodyEl),
          svgBox: readSvgBox(svgEl),
          svgPathBox: readSvgBox(svgPathEl),
        };
      };

      const routeSnapshot = async (style) => {
        canvas.setPathStyle(style);
        canvas.refreshConnections?.();
        await settle();
        const effectiveStyle = canvas.getPathStyle?.() || '';
        const paths = [...canvas.querySelectorAll('[data-conn-id]')]
          .map((path) => ({
            id: path.getAttribute('data-conn-id') || '',
            d: path.getAttribute('d') || '',
            stroke: getComputedStyle(path).stroke,
            strokeWidth: getComputedStyle(path).strokeWidth,
          }))
          .filter((path) => path.d);
        const dots = [...canvas.querySelectorAll('[data-conn-dot]')]
          .map((dot) => ({
            cx: Number.parseFloat(dot.getAttribute('cx') || 'NaN'),
            cy: Number.parseFloat(dot.getAttribute('cy') || 'NaN'),
            r: Number.parseFloat(dot.getAttribute('r') || 'NaN'),
          }));
        return { requestedStyle: style, effectiveStyle, paths, dots };
      };

      const routing = {
        pcb: await routeSnapshot('pcb'),
        bezier: await routeSnapshot('bezier'),
        straight: await routeSnapshot('straight'),
      };

      const preCompact = routing.straight;
      canvas.setCompactMode(true);
      canvas.refreshConnections?.();
      await settle();
      const compact = {
        effectiveStyle: canvas.getPathStyle?.() || '',
        hiddenBodies: [...canvas.querySelectorAll('graph-node:not([node-type="subgraph"]) .sn-node-body')]
          .filter((body) => getComputedStyle(body).display === 'none').length,
        paths: [...canvas.querySelectorAll('[data-conn-id]')]
          .map((path) => ({ id: path.getAttribute('data-conn-id') || '', d: path.getAttribute('d') || '' }))
          .filter((path) => path.d),
        dots: [...canvas.querySelectorAll('[data-conn-dot]')]
          .map((dot) => ({
            cx: Number.parseFloat(dot.getAttribute('cx') || 'NaN'),
            cy: Number.parseFloat(dot.getAttribute('cy') || 'NaN'),
            r: Number.parseFloat(dot.getAttribute('r') || 'NaN'),
          })),
      };
      canvas.setCompactMode(false);

      canvas.setPathStyle('pcb');
      const directPair = ['smoke-direct-source', 'smoke-direct-target'];
      let directConnection = null;
      try {
        const [{ Node, Connection, Input, Output, Socket }] = await Promise.all([
          import('/core/index.js'),
        ]);
        const editor = canvas._editor;
        const socket = new Socket('smoke-direct', { color: 'var(--sn-accent)' });
        const source = new Node('Direct', {
          id: directPair[0],
          shape: 'pill',
          icon: 'east',
        });
        const target = new Node('Direct', {
          id: directPair[1],
          shape: 'pill',
          icon: 'west',
        });
        source.addOutput('next', new Output(socket, 'next'));
        target.addInput('in', new Input(socket, 'in'));
        if (!editor.getNode(source.id)) editor.addNode(source);
        if (!editor.getNode(target.id)) editor.addNode(target);
        directConnection = new Connection(source, 'next', target, 'in');
        editor.addConnection(directConnection);
        await settle();

        const sourceEl = canvas._nodeViews?.get?.(source.id);
        const targetEl = canvas._nodeViews?.get?.(target.id);
        if (sourceEl && targetEl) {
          const sourceW = sourceEl.offsetWidth || sourceEl._cachedW || 160;
          const sourceY = 2400;
          canvas.setNodePosition(source.id, 120, sourceY);
          canvas.setNodePosition(target.id, 120 + sourceW + 16, sourceY);
          await settle();

          const sourceSocket = sourceEl.querySelector('.outputs port-item .sn-socket, .outputs .sn-socket');
          const targetSocket = targetEl.querySelector('.inputs port-item .sn-socket, .inputs .sn-socket');
          const sourceRect = sourceEl.getBoundingClientRect();
          const targetRect = targetEl.getBoundingClientRect();
          const sourceSocketRect = sourceSocket?.getBoundingClientRect?.();
          const targetSocketRect = targetSocket?.getBoundingClientRect?.();
          if (sourceSocketRect && targetSocketRect) {
            const sourceSocketY = sourceSocketRect.top - sourceRect.top + sourceSocketRect.height / 2;
            const targetSocketY = targetSocketRect.top - targetRect.top + targetSocketRect.height / 2;
            canvas.setNodePosition(
              target.id,
              120 + sourceW + 16,
              sourceY + sourceSocketY - targetSocketY
            );
          }
        }
        canvas._connRenderer?.refreshAll?.();
        canvas.refreshConnections?.();
        await settle();
      } catch (error) {
        directConnection = { id: '', error: error?.message || String(error) };
      }
      const directPath = [...canvas.querySelectorAll('[data-conn-id]')]
        .map((path) => ({ id: path.getAttribute('data-conn-id') || '', d: path.getAttribute('d') || '' }))
        .find((path) => path.id === directConnection?.id);

      return {
        nodeCount: nodes.length,
        nodes: nodes.map(readNode),
        routing,
        preCompact,
        compact,
        directPcb: {
          pathStyle: canvas.getPathStyle?.() || '',
          pair: directPair,
          error: directConnection?.error || '',
          path: directPath || null,
        },
      };
    })()
  `;

  const result = await withTimeout(page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), 15000, 'graph smoke Runtime.evaluate');
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Graph smoke evaluation failed');
  }
  return result.result.value;
}

async function evaluateCascadeThemeSmoke(page) {
  const expression = String.raw`
    (async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const settle = async () => {
        for (let index = 0; index < 8; index += 1) await frame();
      };
      const { applyCascadeTheme } = await import('/themes/cascade-theme.js');
      await Promise.all([
        customElements.whenDefined('sn-button'),
        customElements.whenDefined('project-tabs'),
        customElements.whenDefined('graph-explorer-shell'),
        customElements.whenDefined('sn-data-table'),
        customElements.whenDefined('sn-empty-state'),
        customElements.whenDefined('sn-event-feed'),
        customElements.whenDefined('source-viewer'),
        customElements.whenDefined('sn-status-ribbon'),
      ]);
      await settle();

      const read = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          selector,
          width: rect.width,
          height: rect.height,
          color: style.color,
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          borderTopWidth: style.borderTopWidth,
          borderLeftWidth: style.borderLeftWidth,
          fontSize: style.fontSize,
          padding: style.padding,
          gap: style.gap,
        };
      };

      const ensureStatus = () => {
        let status = document.querySelector('sn-status-ribbon');
        if (status) return status;
        status = document.createElement('sn-status-ribbon');
        status.setAttribute('visible', '');
        status.textContent = 'Status';
        document.body.append(status);
        return status;
      };
      ensureStatus();
      const ensureThemeFixture = () => {
        let fixture = document.querySelector('#theme-smoke-fixture');
        if (!fixture) {
          fixture = document.createElement('div');
          fixture.id = 'theme-smoke-fixture';
          fixture.style.cssText = 'position:fixed;left:0;bottom:0;z-index:-1;inline-size:720px;block-size:auto;opacity:0.01;pointer-events:none;';
          fixture.innerHTML = [
            '<sn-button variant="primary">primary</sn-button>',
            '<sn-button>default</sn-button>',
            '<project-tabs></project-tabs>',
            '<graph-explorer-shell>',
            '<button class="graph-explorer-btn" type="button"><span class="material-symbols-outlined">hub</span>Graph</button>',
            '<div class="graph-explorer-stats"><span>9 nodes</span><span>8 links</span></div>',
            '</graph-explorer-shell>',
            '<sn-data-table><div class="sn-data-table"><div class="sn-data-table-scroll"><table><thead><tr><th>State</th></tr></thead><tbody><tr><td><span class="sn-data-table-cell"><span class="sn-data-table-text">ready</span></span></td></tr></tbody></table></div></div></sn-data-table>',
            '<sn-empty-state><span class="material-symbols-outlined">inbox</span><span>No host data</span></sn-empty-state>',
            '<sn-event-feed><div class="sn-event-feed"><div class="sn-event-feed-header"><span>Events</span><span>3</span></div><div class="sn-event-feed-body-list"><sn-event-feed-item><div class="sn-event-feed-item"><div class="sn-event-feed-item-header"><span class="sn-event-feed-arrow">&gt;</span><span class="sn-event-feed-tool">tool</span><span class="sn-event-feed-time">now</span></div><div class="sn-event-feed-body">payload</div></div></sn-event-feed-item></div></div></sn-event-feed>',
            '<source-viewer><div class="sv-header"><span class="sv-filename">demo.js</span><span class="sv-stats">12 lines</span><button class="sv-action" type="button"><span class="material-symbols-outlined">code</span>Raw</button></div></source-viewer>',
            '<sn-status-ribbon visible><div class="fr-inner"><span class="fr-icon">sync</span><span class="fr-text">Status</span><span class="fr-dots"></span></div></sn-status-ribbon>',
          ].join('');
          document.body.append(fixture);
        }
        const tabs = fixture.querySelector('project-tabs');
        tabs?.setTabs?.([
          { id: 'home', name: 'Home', icon: 'home' },
          { id: 'graph', name: 'Graph', icon: 'hub' },
          { id: 'chat', name: 'Chat', icon: 'forum' },
          { id: 'theme', name: 'Theme', icon: 'palette' },
          { id: 'responsive', name: 'Responsive', icon: 'view_quilt' },
          { id: 'docs', name: 'Docs', icon: 'description' },
        ], 'graph');
        return fixture;
      };
      ensureThemeFixture();

      const snapshot = async (state) => {
        applyCascadeTheme(document.documentElement, state, { notify: false });
        await settle();
        const tabItems = [...document.querySelectorAll('project-tab-item')]
          .slice(0, 6)
          .map((tab) => ({
            accent: getComputedStyle(tab).getPropertyValue('--tab-accent').trim(),
            borderColor: getComputedStyle(tab).borderColor,
            iconColor: getComputedStyle(tab.querySelector('.material-symbols-outlined')).color,
          }));
        return {
          root: {
            typeScale: getComputedStyle(document.documentElement).getPropertyValue('--sn-theme-type-scale').trim(),
            headingScale: getComputedStyle(document.documentElement).getPropertyValue('--sn-theme-heading-scale').trim(),
            density: getComputedStyle(document.documentElement).getPropertyValue('--sn-theme-density').trim(),
            outline: getComputedStyle(document.documentElement).getPropertyValue('--sn-theme-outline-strength').trim(),
            primaryBg: getComputedStyle(document.documentElement).getPropertyValue('--sn-button-primary-bg').trim(),
            primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--sn-button-primary-color').trim(),
          },
          primaryButton: read('sn-button[variant="primary"]'),
          defaultButton: read('sn-button:not([variant])'),
          graphButton: read('graph-explorer-shell .graph-explorer-btn'),
          graphIcon: read('graph-explorer-shell .graph-explorer-btn .material-symbols-outlined'),
          graphStats: read('graph-explorer-shell .graph-explorer-stats'),
          tab: read('project-tab-item'),
          tabIcon: read('project-tab-item .material-symbols-outlined'),
          dataHeader: read('sn-data-table th'),
          dataCell: read('sn-data-table td'),
          emptyIcon: read('sn-empty-state .material-symbols-outlined'),
          eventFeed: read('sn-event-feed'),
          eventItem: read('sn-event-feed-item'),
          sourceHeader: read('source-viewer .sv-header'),
          statusRibbon: read('sn-status-ribbon .fr-inner'),
          statusIcon: read('sn-status-ribbon .fr-icon'),
          tabItems,
        };
      };

      return {
        base: await snapshot({
          mode: 'dark',
          brightness: 0,
          contrast: 58,
          chroma: 89,
          hue: 218,
          outline: 38,
          type: 100,
          heading: 100,
          density: 100,
        }),
        scaled: await snapshot({
          mode: 'dark',
          brightness: 0,
          contrast: 76,
          chroma: 100,
          hue: 218,
          outline: 72,
          type: 118,
          heading: 124,
          density: 116,
        }),
      };
    })()
  `;

  const result = await withTimeout(page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), 15000, 'cascade theme smoke Runtime.evaluate');
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Cascade theme smoke evaluation failed');
  }
  return result.result.value;
}

async function evaluateFlowScrollDragSmoke(page) {
  const expression = String.raw`
    (async () => {
      await customElements.whenDefined('node-canvas');
      await customElements.whenDefined('graph-node');
      const [{ NodeEditor, Node }] = await Promise.all([
        import('/core/index.js')
      ]);

      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const settle = async () => {
        for (let index = 0; index < 6; index += 1) await frame();
      };
      const pointer = (type, x, y) => new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 17,
        pointerType: 'mouse',
        button: 0,
        buttons: type === 'pointerup' ? 0 : 1,
        clientX: x,
        clientY: y,
        pageX: x,
        pageY: y,
      });
      const drag = async (target, fromY, toY) => {
        target.dispatchEvent(pointer('pointerdown', 120, fromY));
        window.dispatchEvent(pointer('pointermove', 120, toY));
        await settle();
        window.dispatchEvent(pointer('pointerup', 120, toY));
        await settle();
      };
      const read = (canvas) => {
        const content = canvas.querySelector('.content');
        const container = canvas.querySelector('.canvas-container');
        return {
          panX: canvas.$.panX,
          panY: canvas.$.panY,
          scrollTop: canvas.scrollTop,
          scrollLeft: canvas.scrollLeft,
          contentTop: content.getBoundingClientRect().top - container.getBoundingClientRect().top,
          transform: content.style.transform,
        };
      };

      const canvas = document.createElement('node-canvas');
      canvas.style.cssText = [
        'display:block',
        'position:fixed',
        'left:20px',
        'top:20px',
        'width:320px',
        'height:180px',
        'z-index:1'
      ].join(';');
      document.body.append(canvas);
      const editor = new NodeEditor();
      for (let index = 0; index < 6; index += 1) {
        editor.addNode(new Node('Scroll Node ' + index, {
          id: 'flow-scroll-node-' + index,
          type: 'panel',
          icon: 'hub'
        }));
      }
      canvas.setEditor(editor);
      canvas.setViewportLocked(false);
      canvas.setPanels(false);
      canvas.$.panX = 0;
      canvas.$.panY = 0;
      canvas.$.zoom = 1;
      canvas.setFlowLayout({
        direction: 'vertical',
        gap: 80,
        padding: { top: 0, right: 16, bottom: 360, left: 16 },
        align: 'stretch',
        scroll: true,
      });
      await settle();

      const target = canvas.querySelector('.canvas-container');
      const initial = read(canvas);
      await drag(target, 150, 90);
      const afterFirst = read(canvas);
      await drag(target, 150, 140);
      const afterSecond = read(canvas);
      canvas.remove();
      return { initial, afterFirst, afterSecond };
    })()
  `;

  const result = await withTimeout(page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), 15000, 'flow-scroll drag Runtime.evaluate');
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Flow-scroll drag evaluation failed');
  }
  return result.result.value;
}

async function evaluateNodeCanvasMultiFocusSmoke(page) {
  const expression = String.raw`
    (async () => {
      await customElements.whenDefined('node-canvas');
      await customElements.whenDefined('graph-node');
      const [{ NodeEditor, Node, Connection, Input, Output, Socket }] = await Promise.all([
        import('/core/index.js')
      ]);

      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const settle = async () => {
        for (let index = 0; index < 8; index += 1) await frame();
      };

      const canvas = document.createElement('node-canvas');
      canvas.style.cssText = [
        'display:block',
        'position:fixed',
        'left:20px',
        'top:20px',
        'width:640px',
        'height:360px',
        'z-index:1'
      ].join(';');
      document.body.append(canvas);

      const signal = new Socket('signal');
      const editor = new NodeEditor();
      const nodes = [
        new Node('Hero', { id: 'hero', type: 'profile', icon: 'person' }),
        new Node('Biography', { id: 'bio', type: 'bio', icon: 'article' }),
        new Node('Agent Portal', { id: 'agent-portal', type: 'project', icon: 'work' }),
        new Node('Far Archive', { id: 'far-archive', type: 'archive', icon: 'folder' })
      ];
      for (const node of nodes) {
        node.addInput('in', new Input(signal, 'in'));
        node.addOutput('out', new Output(signal, 'out'));
        editor.addNode(node);
      }
      editor.addConnection(new Connection(nodes[0], 'out', nodes[1], 'in'));
      editor.addConnection(new Connection(nodes[0], 'out', nodes[2], 'in'));
      editor.addConnection(new Connection(nodes[2], 'out', nodes[3], 'in'));

      canvas.setEditor(editor);
      canvas.setPanels(false);
      canvas.setReadonly(true);
      canvas.setNodePosition('hero', 0, 0);
      canvas.setNodePosition('bio', 380, 0);
      canvas.setNodePosition('agent-portal', 0, 260);
      canvas.setNodePosition('far-archive', 1800, 900);
      await settle();

      const ok = canvas.flyToNodes(['hero', 'bio', 'agent-portal'], {
        padding: 36,
        maxZoom: 1,
        select: 'hero'
      });
      await settle();

      const canvasRect = canvas.querySelector('.canvas-container').getBoundingClientRect();
      const readNode = (id) => {
        const el = canvas.querySelector('graph-node[node-id="' + id + '"]');
        const rect = el?.getBoundingClientRect();
        return rect ? {
          id,
          left: rect.left - canvasRect.left,
          top: rect.top - canvasRect.top,
          right: rect.right - canvasRect.left,
          bottom: rect.bottom - canvasRect.top,
          selected: el.hasAttribute('data-selected')
        } : null;
      };
      const focused = ['hero', 'bio', 'agent-portal'].map(readNode);
      const far = readNode('far-archive');
      const allFocusedVisible = focused.every((rect) => rect
        && rect.left >= -2
        && rect.top >= -2
        && rect.right <= canvasRect.width + 2
        && rect.bottom <= canvasRect.height + 2);

      canvas.remove();
      return {
        ok,
        zoom: canvas.$.zoom,
        panX: canvas.$.panX,
        panY: canvas.$.panY,
        canvas: { width: canvasRect.width, height: canvasRect.height },
        focused,
        far,
        allFocusedVisible
      };
    })()
  `;

  const result = await withTimeout(page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), 15000, 'node-canvas multi-node focus Runtime.evaluate');
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Node-canvas multi-node focus evaluation failed');
  }
  return result.result.value;
}

async function evaluateComposerSmoke(page, width = 0) {
  const forcedWidth = Number.isFinite(width) && width > 0 ? width : 0;
  const expression = String.raw`
    (async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const settle = async () => {
        for (let index = 0; index < 6; index += 1) await frame();
      };
      for (let index = 0; index < 90 && !customElements.get('chat-composer'); index += 1) {
        await frame();
      }
      if (!customElements.get('chat-composer')) return { error: 'chat-composer not defined' };
      await settle();

      const chatLayoutNode = [...document.querySelectorAll('layout-node')]
        .find((node) => node.getAttribute('node-type') === 'panel' && (
          node.textContent.includes('Agent Chat') ||
          node.textContent.includes('Chats')
        ));
      if (chatLayoutNode?.hasAttribute('collapsed')) {
        chatLayoutNode.querySelector('.collapse-btn')?.click();
        await settle();
        await settle();
      }

      const composer = document.querySelector('chat-composer');
      if (!composer) return { error: 'missing chat-composer' };
      const forcedWidth = ${forcedWidth};
      if (forcedWidth) {
        const panel = composer.closest('cascade-chat-panel');
        panel?.toggleAttribute('data-chat-smoke', true);
        panel?.style.setProperty('--stage7-chat-smoke-width', forcedWidth + 'px');
        composer.style.inlineSize = forcedWidth + 'px';
        composer.style.maxInlineSize = forcedWidth + 'px';
        await settle();
      }
      const bodies = [...composer.querySelectorAll('.composer-body')];
      const body = bodies.find((el) => !el.hidden && getComputedStyle(el).display !== 'none');
      if (!body) return { error: 'missing visible composer body' };

      const readBox = (el) => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          right: rect.right,
          bottom: rect.bottom,
          display: style.display,
          gridColumn: style.gridColumn,
          gridRow: style.gridRow,
          alignSelf: style.alignSelf,
          alignItems: style.alignItems,
          overflow: style.overflow,
          textOverflow: style.textOverflow,
          visibility: style.visibility,
          whiteSpace: style.whiteSpace,
        };
      };
      const inside = (parent, child) => {
        if (!parent || !child) return false;
        return child.x >= parent.x - 1
          && child.y >= parent.y - 1
          && child.right <= parent.right + 1
          && child.bottom <= parent.bottom + 1;
      };
      const isVisibleBox = (box) => Boolean(
        box &&
        box.display !== 'none' &&
        box.visibility !== 'hidden' &&
        box.width > 0 &&
        box.height > 0
      );

      const bodyBox = readBox(body);
      const textarea = body.querySelector('textarea');
      const actions = body.querySelector('.composer-actions');
      const send = body.querySelector('sn-button.btn-send');
      const readControls = () => [...body.querySelectorAll('.composer-actions button, .btn-mic, sn-button.btn-send')]
        .map((el) => {
          const box = readBox(el);
          return {
          tag: el.tagName.toLowerCase(),
          className: el.className,
          text: el.textContent.trim(),
          hidden: el.hidden || getComputedStyle(el).display === 'none',
          box,
          visible: isVisibleBox(box),
        };
        })
        .filter((control) => control.visible)
        .sort((a, b) => a.box.x - b.box.x || a.box.y - b.box.y);
      const chatPanel = composer.closest('cascade-chat-panel');
      chatPanel?._syncVoiceControls?.('idle');
      await settle();
      const initialControls = readControls();
      composer.setVoiceControls?.({
        input: { visible: false, state: 'idle', enabled: true },
        wakeListen: { visible: true, active: true, commandText: "O'key Agent" },
        response: { visible: true, enabled: true, speaking: false },
        command: { visible: true, enabled: true, active: true, text: 'Commands' },
        language: {
          visible: true,
          enabled: true,
          mode: 'ru',
          options: [
            { mode: 'ru', label: 'RU' },
            { mode: 'es', label: 'ES' },
            { mode: 'en', label: 'EN' },
          ],
        },
      });
      await settle();
      const controls = readControls();
      const languageOptions = [...(body.querySelectorAll('.btn-voice-language .voice-language-option') || [])]
        .map((el) => {
          const box = readBox(el);
          return {
            text: el.textContent.trim(),
            active: el.classList.contains('active'),
            visible: isVisibleBox(box),
          };
        });
      const readScroll = (el) => {
        if (!el) return null;
        return {
          ...readBox(el),
          clientWidth: el.clientWidth,
          scrollWidth: el.scrollWidth,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
        };
      };
      const panel = composer.closest('cascade-chat-panel');
      const sidebar = panel?.querySelector('chat-sidebar-shell');
      const transcript = panel?.querySelector('chat-transcript');
      const messages = transcript?.querySelector('.chat-messages');
      const footer = composer.querySelector('.composer-footer');
      const contextBar = composer.querySelector('.chat-context-bar');
      const scrollButton = transcript?.querySelector('.scroll-bottom-btn');
      let scrollButtonState = null;
      if (transcript && messages && scrollButton) {
        transcript.scrollToBottom?.({ smooth: false });
        await settle();
        const atBottomState = transcript.getScrollState?.() || {};
        const atBottomBox = readBox(scrollButton);
        const atBottomVisible = scrollButton.classList.contains('visible') && isVisibleBox(atBottomBox);
        if (atBottomState.hasOverflow) {
          const distance = Math.max(180, Math.round(messages.clientHeight * 0.45));
          messages.scrollTop = Math.max(0, messages.scrollHeight - messages.clientHeight - distance);
          messages.dispatchEvent(new Event('scroll', { bubbles: true }));
          transcript.updateScrollBottomButton?.();
          await settle();
        }
        const scrolledState = transcript.getScrollState?.() || {};
        const scrolledBox = readBox(scrollButton);
        scrollButtonState = {
          atBottom: {
            hasOverflow: Boolean(atBottomState.hasOverflow),
            distanceFromBottom: atBottomState.distanceFromBottom || 0,
            visible: atBottomVisible,
            box: atBottomBox,
          },
          scrolled: {
            hasOverflow: Boolean(scrolledState.hasOverflow),
            distanceFromBottom: scrolledState.distanceFromBottom || 0,
            visible: scrollButton.classList.contains('visible') && isVisibleBox(scrolledBox),
            box: scrolledBox,
          },
        };
      }
      const footerControls = [...(footer?.querySelectorAll('.composer-footer-btn') || [])]
        .map((el) => ({
          text: el.textContent.trim().replace(/\\s+/g, ' '),
          box: readScroll(el),
          insideFooter: inside(readBox(footer), readBox(el)),
        }));
      const chips = [...(contextBar?.querySelectorAll('.context-chip') || [])]
        .map((el) => ({
          text: el.textContent.trim().replace(/\\s+/g, ' '),
          box: readScroll(el),
          path: readScroll(el.querySelector('.context-path')),
          insideContextBar: inside(readBox(contextBar), readBox(el)),
        }));

      return {
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          documentClientWidth: document.documentElement.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
        },
        visibleBodyCount: bodies.filter((el) => !el.hidden && getComputedStyle(el).display !== 'none').length,
        composer: readBox(composer),
        body: bodyBox,
        textarea: readBox(textarea),
        actions: readBox(actions),
        send: readBox(send),
        controls: controls.map((control) => ({
          ...control,
          insideBody: inside(bodyBox, control.box),
        })),
        initialControls: initialControls.map((control) => ({
          ...control,
          insideBody: inside(bodyBox, control.box),
        })),
        languageOptions,
        chat: {
          panel: readScroll(panel),
          sidebar: readScroll(sidebar),
          transcript: readScroll(transcript),
          messages: readScroll(messages),
          scrollButton: scrollButtonState,
          footer: readScroll(footer),
          contextBar: readScroll(contextBar),
          footerControls,
          chips,
        },
      };
    })()
  `;

  const result = await withTimeout(page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), 15000, 'composer smoke Runtime.evaluate');
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Composer smoke evaluation failed');
  }
  return result.result.value;
}

async function evaluateComposerVoiceRuntimeSmoke(page) {
  const expression = String.raw`
    (async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const settle = async () => {
        for (let index = 0; index < 8; index += 1) await frame();
      };
      for (let index = 0; index < 90 && !customElements.get('chat-composer'); index += 1) {
        await frame();
      }
      if (!customElements.get('chat-composer')) return { error: 'chat-composer not defined' };
      await settle();

      const composer = document.querySelector('chat-composer');
      if (!composer) return { error: 'missing chat-composer' };
      for (const eventName of [
        'chat-composer-voice-input',
        'chat-composer-wake-listen',
        'chat-composer-voice-response-toggle',
        'chat-composer-voice-command-toggle',
        'chat-composer-voice-language-change',
        'chat-composer-permission-intent',
        'chat-composer-recorder-intent',
        'chat-composer-transcription-intent',
        'chat-composer-voice-approve',
        'chat-composer-voice-cancel',
        'chat-composer-voice-send',
      ]) {
        composer.addEventListener(eventName, (event) => event.stopPropagation());
      }

      const instances = [];
      class MockSpeechRecognition {
        constructor() {
          this.lang = '';
          this.interimResults = false;
          this.continuous = false;
          instances.push(this);
        }

        start() {
          this.started = true;
          this.startLang = this.lang;
          setTimeout(() => this.onstart?.(), 0);
        }

        stop() {
          this.stopped = true;
          setTimeout(() => this.onend?.(), 0);
        }

        abort() {
          this.aborted = true;
        }
      }

      Object.defineProperty(window, 'SpeechRecognition', {
        configurable: true,
        value: MockSpeechRecognition,
      });
      Object.defineProperty(navigator, 'permissions', {
        configurable: true,
        value: { query: async () => ({ state: 'granted' }) },
      });

      composer.setVoiceControls?.({
        input: { visible: true, state: 'idle', enabled: true },
        wakeListen: { visible: true, active: false, commandText: "O'key Agent" },
        response: { visible: false, enabled: true, speaking: false },
        command: { visible: false, enabled: true, active: true, text: 'Commands' },
        language: {
          visible: false,
          enabled: true,
          mode: 'ru',
          options: [
            { mode: 'ru', label: 'RU' },
            { mode: 'es', label: 'ES' },
            { mode: 'en', label: 'EN' },
          ],
        },
      });
      await settle();

      const submissions = [];
      composer.addEventListener('chat-composer-submit', () => {
        submissions.push(composer.$?.value || '');
      });

      composer.ref?.voiceInputBtn?.click();
      await settle();
      const activeControls = {
        inputState: composer.ref?.voiceInputBtn?.dataset?.voiceState || '',
        commandVisible: Boolean(composer.ref?.voiceCommandBtn && !composer.ref.voiceCommandBtn.hidden),
        languageVisible: Boolean(composer.ref?.voiceLanguageBtn && !composer.ref.voiceLanguageBtn.hidden),
        activeLanguage: composer.ref?.voiceLanguageBtn?.querySelector('.voice-language-option.active')?.textContent?.trim() || '',
        commandHints: [...(composer.ref?.voiceCommandHints?.querySelectorAll('.voice-command-hint') || [])]
          .map((item) => item.textContent.trim()),
        previewStatus: composer.ref?.voicePreviewStatus?.textContent?.trim() || '',
      };

      instances[0]?.onresult?.({
        results: Object.assign([[{ transcript: 'Build project UI' }]], { length: 1 }),
      });
      await settle();

      composer.ref?.voiceLanguageBtn?.querySelector('[data-voice-language="es"]')?.click();
      await settle();
      instances[1]?.onresult?.({
        results: Object.assign([[{ transcript: 'ahora' }]], { length: 1 }),
      });
      await settle();

      composer.ref?.voiceApproveBtn?.click();
      await settle();
      await settle();

      composer.setVoiceControls?.({
        input: { visible: true, state: 'idle', enabled: true },
        wakeListen: { visible: true, active: false, commandText: "О'кей Агент" },
        response: { visible: false, enabled: true, speaking: false },
        command: { visible: false, enabled: true, active: true, text: 'Commands' },
        language: {
          visible: false,
          enabled: true,
          mode: 'ru',
          options: [
            { mode: 'ru', label: 'RU' },
            { mode: 'es', label: 'ES' },
            { mode: 'en', label: 'EN' },
          ],
        },
      });
      await settle();
      composer.ref?.wakeListenBtn?.click();
      await settle();
      const wakeActiveControls = {
        wakeActive: Boolean(composer.ref?.wakeListenBtn?.classList.contains('listening')),
        commandText: composer.ref?.wakeCommandText?.textContent?.trim() || '',
        inputVisible: Boolean(composer.ref?.voiceInputBtn && !composer.ref.voiceInputBtn.hidden),
        inputState: composer.ref?.voiceInputBtn?.dataset?.voiceState || '',
        commandVisible: Boolean(composer.ref?.voiceCommandBtn && !composer.ref.voiceCommandBtn.hidden),
        languageVisible: Boolean(composer.ref?.voiceLanguageBtn && !composer.ref.voiceLanguageBtn.hidden),
        activeLanguage: composer.ref?.voiceLanguageBtn?.querySelector('.voice-language-option.active')?.textContent?.trim() || '',
        commandHints: [...(composer.ref?.voiceCommandHints?.querySelectorAll('.voice-command-hint') || [])]
          .map((item) => item.textContent.trim()),
        previewHidden: Boolean(composer.ref?.voicePreview?.hidden),
        previewStatus: composer.ref?.voicePreviewStatus?.textContent?.trim() || '',
        recognitionCount: instances.length,
      };
      const wakePhrase = wakeActiveControls.commandText ||
        wakeActiveControls.previewStatus.match(/"([^"]+)"/)?.[1] ||
        "О'кей Агент";
      instances[2]?.onresult?.({
        results: Object.assign([[{ transcript: wakePhrase }]], { length: 1 }),
      });
      await new Promise((resolve) => setTimeout(resolve, 260));
      await settle();
      const wakeMatched = {
        previewStatus: composer.ref?.voicePreviewStatus?.textContent?.trim() || '',
        inputState: composer.ref?.voiceInputBtn?.dataset?.voiceState || '',
        recognitionCount: instances.length,
        wakeRecognitionAborted: Boolean(instances[2]?.aborted),
      };
      instances[3]?.onresult?.({
        results: Object.assign([[{ transcript: 'построй рабочую область' }]], { length: 1 }),
      });
      await settle();
      const wakeDictation = {
        previewStatus: composer.ref?.voicePreviewStatus?.textContent?.trim() || '',
        previewText: composer.getVoicePreviewText?.() || '',
        commandHints: [...(composer.ref?.voiceCommandHints?.querySelectorAll('.voice-command-hint') || [])]
          .map((item) => item.textContent.trim()),
      };
      composer.ref?.voiceCancelBtn?.click();
      await settle();
      const wakeCancel = {
        wakeActive: Boolean(composer.ref?.wakeListenBtn?.classList.contains('listening')),
        previewHidden: Boolean(composer.ref?.voicePreview?.hidden),
        inputState: composer.ref?.voiceInputBtn?.dataset?.voiceState || '',
      };
      composer.ref?.wakeListenBtn?.click();
      await settle();
      const wakeStoppedControls = {
        wakeActive: Boolean(composer.ref?.wakeListenBtn?.classList.contains('listening')),
        commandText: composer.ref?.wakeCommandText?.textContent?.trim() || '',
        responseVisible: Boolean(composer.ref?.voiceResponseBtn && !composer.ref.voiceResponseBtn.hidden),
        commandVisible: Boolean(composer.ref?.voiceCommandBtn && !composer.ref.voiceCommandBtn.hidden),
        languageVisible: Boolean(composer.ref?.voiceLanguageBtn && !composer.ref.voiceLanguageBtn.hidden),
        previewHidden: Boolean(composer.ref?.voicePreview?.hidden),
      };

      return {
        activeControls,
        wakeActiveControls,
        wakeMatched,
        wakeDictation,
        wakeCancel,
        wakeStoppedControls,
        recognition: instances.map((item) => ({
          lang: item.lang,
          startLang: item.startLang,
          started: Boolean(item.started),
          stopped: Boolean(item.stopped),
          aborted: Boolean(item.aborted),
        })),
        previewHidden: Boolean(composer.ref?.voicePreview?.hidden),
        submissions,
        value: composer.$?.value || '',
      };
    })()
  `;

  const result = await withTimeout(page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), 15000, 'composer voice runtime smoke Runtime.evaluate');
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Composer voice runtime smoke evaluation failed');
  }
  return result.result.value;
}

async function evaluateShowcaseSmoke(page) {
  const expression = String.raw`
    (async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const settle = async () => {
        for (let index = 0; index < 8; index += 1) await frame();
      };
      await Promise.all([
        customElements.whenDefined('layout-shell-menu'),
        customElements.whenDefined('layout-node'),
        customElements.whenDefined('cascade-project-panel'),
        customElements.whenDefined('cascade-source-panel'),
        customElements.whenDefined('cascade-docs-panel'),
        customElements.whenDefined('cascade-project-map-panel'),
        customElements.whenDefined('cascade-overview-panel'),
        customElements.whenDefined('cascade-graph-panel'),
        customElements.whenDefined('cascade-ui-panel'),
        customElements.whenDefined('cascade-chat-panel'),
        customElements.whenDefined('cascade-runtime-panel'),
        customElements.whenDefined('cascade-spatial-panel'),
        customElements.whenDefined('cascade-theme-editor'),
        customElements.whenDefined('source-editor'),
        customElements.whenDefined('source-viewer'),
        customElements.whenDefined('sn-tree-panel'),
        customElements.whenDefined('canvas-graph'),
      ]);
      await settle();

      const elementBox = (el, selector = el?.tagName?.toLowerCase?.() || '') => {
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          selector,
          width: rect.width,
          height: rect.height,
          display: style.display,
          visibility: style.visibility,
          text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 180),
        };
      };
      const readBox = (selector) => {
        const boxes = [...document.querySelectorAll(selector)].map((el) => elementBox(el, selector));
        return boxes.find(visible) || boxes[0] || null;
      };
      const readAgentChatNode = () => {
        let nodes = [...document.querySelectorAll('panel-layout.lab-layout layout-node')];
        let node = nodes.find((item) => item.getAttribute('node-type') === 'panel' && item.textContent.includes('Agent Chat'));
        if (!node) return null;
        return {
          ...elementBox(node, 'layout-node[panelType=agent-chat]'),
          collapsed: node.hasAttribute('collapsed'),
          collapseDir: node.getAttribute('collapse-dir') || '',
          nodeType: node.getAttribute('node-type') || '',
        };
      };
      const visible = (box) => Boolean(
        box &&
        box.display !== 'none' &&
        box.visibility !== 'hidden' &&
        box.width > 4 &&
        box.height > 4
      );
      const activate = async (projectId, viewId) => {
        location.hash = projectId + '/' + viewId;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        document.querySelector('layout-shell-menu')?.selectGroup?.(projectId, 'showcase-smoke');
        location.hash = projectId + '/' + viewId;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        await settle();
        await settle();
        return {
          projectId,
          viewId,
          hash: location.hash,
          activeProject: document.documentElement.dataset.showcaseProject || '',
          activeView: document.documentElement.dataset.showcaseView || '',
          customRailCount: document.querySelectorAll('.agent-chat-rail').length,
          chatPanelCount: document.querySelectorAll('cascade-chat-panel').length,
          composerCount: document.querySelectorAll('chat-composer').length,
          agentChatNode: readAgentChatNode(),
          sidebarLabels: [...document.querySelectorAll('layout-sidebar sidebar-section')]
            .map((row) => row.textContent.trim().replace(/\s+/g, ' ')),
          panels: [...document.querySelectorAll('layout-node')]
            .map((node) => {
              const rect = node.getBoundingClientRect();
              const style = getComputedStyle(node);
              return {
                id: node.getAttribute('data-panel-id') || '',
                width: rect.width,
                height: rect.height,
                display: style.display,
                visibility: style.visibility,
              };
          }),
          overview: readBox('cascade-overview-panel'),
          project: readBox('cascade-project-panel'),
          source: readBox('cascade-source-panel'),
          docs: readBox('cascade-docs-panel'),
          projectMap: readBox('cascade-project-map-panel'),
          graph: readBox('cascade-graph-panel'),
          ui: readBox('cascade-ui-panel'),
          chat: readBox('cascade-chat-panel'),
          theme: readBox('cascade-theme-editor'),
          runtime: readBox('cascade-runtime-panel'),
          spatial: readBox('cascade-spatial-panel'),
          tree: readBox('cascade-project-panel sn-tree-panel'),
          sourceEditor: readBox('cascade-source-panel source-editor'),
          sourceEditorValue: document.querySelector('cascade-source-panel source-editor')?.getContent?.() || '',
          sourceViewer: readBox('cascade-docs-panel source-viewer'),
          canvasGraph: readBox('cascade-project-map-panel canvas-graph'),
          projectFiles: [...document.querySelectorAll('cascade-project-panel .sn-tree-row')]
            .map((row) => row.textContent.trim().replace(/\s+/g, ' ')),
          runtimeFeatures: [...document.querySelectorAll('cascade-runtime-panel')]
            .filter((panel) => panel.getBoundingClientRect().width > 4 && panel.getBoundingClientRect().height > 4)
            .flatMap((panel) => [...panel.querySelectorAll('.workspace-feature-card strong')]
              .map((el) => el.textContent.trim())),
          spatialNodes: [...document.querySelectorAll('cascade-spatial-panel')]
            .filter((panel) => panel.getBoundingClientRect().width > 4 && panel.getBoundingClientRect().height > 4)
            .flatMap((panel) => [...panel.querySelectorAll('.spatial-node')]
              .map((el) => ({
                id: el.dataset.node,
                width: el.getBoundingClientRect().width,
                height: el.getBoundingClientRect().height,
                x: getComputedStyle(el).getPropertyValue('--x').trim(),
                y: getComputedStyle(el).getPropertyValue('--y').trim(),
                scale: getComputedStyle(el).getPropertyValue('--scale').trim(),
              }))),
        };
      };
      const expandAgentChat = async () => {
        await activate('symbiote-ui', 'overview');
        const node = [...document.querySelectorAll('panel-layout.lab-layout layout-node')]
          .find((item) => item.getAttribute('node-type') === 'panel' && item.textContent.includes('Agent Chat'));
        const button = node?.querySelector?.('.collapse-btn');
        button?.click?.();
        await settle();
        await settle();
        return readAgentChatNode();
      };

      return {
        title: document.title,
        shellTitle: document.querySelector('layout-shell-menu')?.getAttribute('title') || '',
        projectPath: document.querySelector('layout-shell-menu')?.getAttribute('project-path') || '',
        customRailCount: document.querySelectorAll('.agent-chat-rail').length,
        chatPanelCount: document.querySelectorAll('cascade-chat-panel').length,
        composerCount: document.querySelectorAll('chat-composer').length,
        agentChatNode: readAgentChatNode(),
        tabs: [...document.querySelectorAll('project-tabs .tab, project-tab-item')]
          .map((tab) => tab.textContent.trim().replace(/\s+/g, ' ')),
        groups: {
          symbiote: await activate('symbiote-ui', 'overview'),
          chat: await activate('chat', 'conversation'),
          dev: await activate('multi-agent-dev', 'source-editor'),
          devDocs: await activate('multi-agent-dev', 'markdown-docs'),
          devGraph: await activate('multi-agent-dev', 'dependency-graph'),
          automation: await activate('automation', 'engine-state'),
          media: await activate('media-generation', 'variants'),
          video: await activate('video-editor', 'timeline'),
          data: await activate('data-research', 'report'),
          node: await activate('node-studio', 'pcb-routing'),
          spatial: await activate('spatial-xr', '3d-graph'),
        },
        expandedAgentChat: await expandAgentChat(),
      };
    })()
  `;

  const result = await withTimeout(page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), 15000, 'showcase smoke Runtime.evaluate');
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Showcase smoke evaluation failed');
  }
  return result.result.value;
}

async function evaluateChatWorkspaceEventFlow(page) {
  const expression = String.raw`
    (async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const settle = async () => {
        for (let index = 0; index < 8; index += 1) await frame();
      };
      await Promise.all([
        customElements.whenDefined('layout-shell-menu'),
        customElements.whenDefined('cascade-chat-panel'),
        customElements.whenDefined('chat-workspace'),
        customElements.whenDefined('chat-composer'),
        customElements.whenDefined('chat-sidebar-shell'),
        customElements.whenDefined('chat-transcript'),
      ]);
      location.hash = 'chat/conversation';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      document.querySelector('layout-shell-menu')?.selectGroup?.('chat', 'event-flow-smoke');
      location.hash = 'chat/conversation';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await settle();
      await settle();

      const panel = document.querySelector('cascade-chat-panel');
      const workspace = panel?.querySelector('chat-workspace');
      const composer = workspace?.getComposer?.();
      const sidebar = workspace?.getSidebar?.();
      const transcript = workspace?.getTranscript?.();
      if (!panel || !workspace || !composer || !sidebar || !transcript) {
        return {
          error: 'missing chat workspace parts',
          hasPanel: Boolean(panel),
          hasWorkspace: Boolean(workspace),
          hasComposer: Boolean(composer),
          hasSidebar: Boolean(sidebar),
          hasTranscript: Boolean(transcript),
        };
      }
      const spokenResponses = [];
      class MockSpeechSynthesisUtterance {
        constructor(text) {
          this.text = text;
          this.lang = '';
          this.onend = null;
          this.onerror = null;
        }
      }
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          cancel() {},
          speak(utterance) {
            spokenResponses.push({ text: utterance.text, lang: utterance.lang });
            setTimeout(() => utterance.onend?.(), 0);
          },
        },
      });

      const hostEvents = [];
      panel.addEventListener('cascade-chat-host-flow', (event) => {
        hostEvents.push({
          type: event.detail?.type || '',
          activeChatId: event.detail?.activeChatId || '',
          id: event.detail?.id || '',
          reason: event.detail?.reason || '',
          provider: event.detail?.footerState?.provider || '',
          model: event.detail?.footerState?.model || '',
        });
      });

      sidebar.setCollapsed?.(false);
      await settle();
      const subagentItem = [...sidebar.querySelectorAll('chat-sidebar-sub-item')]
        .find((item) => item.$?.id === 'architecture-audit');
      const subagentRow = subagentItem?.querySelector('.chat-item-child');
      subagentRow?.click();
      await settle();
      const subagentComposerState = {
        activeChatId: panel.dataset.activeChatId || '',
        sidebarActive: [...sidebar.querySelectorAll('chat-sidebar-item, chat-sidebar-sub-item')]
          .find((item) => item.hasAttribute('data-active'))?.$?.id || '',
        ariaDisabled: subagentRow?.getAttribute('aria-disabled') || '',
        lockedRows: sidebar.querySelectorAll('[data-locked]').length,
        lockIcons: sidebar.querySelectorAll('.chat-lock-icon').length,
        composerDisabled: Boolean(composer.querySelector('textarea')?.disabled),
        inputDisabled: Boolean(composer.querySelector('textarea')?.disabled),
        sendDisabled: composer.querySelector('sn-button.btn-send')?.hasAttribute('disabled') || composer.querySelector('sn-button.btn-send')?.getAttribute('aria-disabled') === 'true',
        micDisabled: Boolean(composer.querySelector('button.btn-mic')?.disabled),
      };
      const webmcpItem = [...sidebar.querySelectorAll('chat-sidebar-item, chat-sidebar-sub-item')]
        .find((item) => item.$?.id === 'webmcp');
      webmcpItem?.querySelector('.chat-item, .chat-item-child')?.click();
      await settle();
      const webmcpComposerState = {
        composerDisabled: Boolean(composer.querySelector('textarea')?.disabled),
        inputDisabled: Boolean(composer.querySelector('textarea')?.disabled),
        sendDisabled: composer.querySelector('sn-button.btn-send')?.hasAttribute('disabled') || composer.querySelector('sn-button.btn-send')?.getAttribute('aria-disabled') === 'true',
      };

      const provider = composer.querySelector('select[data-footer-control-id="provider"]');
      if (provider) {
        provider.value = 'codex';
        provider.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await settle();

      const wakeButton = composer.querySelector('button.btn-wake-listen');
      const responseButton = composer.querySelector('button.btn-voice-response');
      wakeButton?.click();
      await settle();
      const voicePreview = composer.getVoicePreviewText?.() || '';
      const voiceState = {
        wakeActive: wakeButton?.classList.contains('listening') || false,
        responseActive: responseButton?.classList.contains('active') || false,
        responseSpeaking: responseButton?.classList.contains('speaking') || false,
        background: workspace.dataset.backgroundState || '',
      };

      const writeInput = (value) => {
        const input = composer.getInputElement?.() || composer.querySelector('textarea');
        input.value = value;
        input.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: value,
        }));
      };
      const sendButton = composer.querySelector('sn-button.btn-send');

      writeInput('Stop this mock stream');
      sendButton?.click();
      await pause(260);
      const streamingState = {
        sending: Boolean(composer.$?.isSending),
        background: workspace.dataset.backgroundState || '',
        liveStatus: transcript.querySelector('.live-status-indicator')?.textContent?.trim() || '',
      };
      sendButton?.click();
      await settle();
      const stoppedState = {
        sending: Boolean(composer.$?.isSending),
        background: workspace.dataset.backgroundState || '',
      };

      writeInput('Complete this mock stream');
      composer.querySelector('sn-button.btn-send')?.click();
      await pause(1800);
      await settle();
      for (let i = 0; i < 8 && workspace.dataset.backgroundState !== 'done'; i += 1) {
        await pause(250);
        await settle();
      }

      const messageItems = transcript.$?.messageItems || [];
      const messageDomState = {
        agentMessages: transcript.querySelectorAll('chat-message-item .message.agent').length,
        assistantMessages: transcript.querySelectorAll('chat-message-item .message.assistant').length,
        messageContent: transcript.querySelectorAll('.msg-content').length,
        workSummaries: transcript.querySelectorAll('.work-summary-wrap').length,
        toolCards: transcript.querySelectorAll('.tool-card').length,
        statusBoards: transcript.querySelectorAll('.status-board').length,
        thinkingBlocks: transcript.querySelectorAll('.thinking-block').length,
        codeBlocks: transcript.querySelectorAll('.md-code-block').length,
        tables: transcript.querySelectorAll('.md-table').length,
      };
      const sidebarActive = [...sidebar.querySelectorAll('chat-sidebar-item, chat-sidebar-sub-item')]
        .find((item) => item.hasAttribute('data-active'))?.$?.id || '';
      const footerProvider = composer.querySelector('select[data-footer-control-id="provider"]')?.value || '';
      const finalState = {
        sending: Boolean(composer.$?.isSending),
        background: workspace.dataset.backgroundState || '',
        messageCount: messageItems.length,
        messageRoles: messageItems.map((item) => item.role),
        messageDomState,
        lastText: transcript.textContent.trim().replace(/\s+/g, ' ').slice(-240),
      };

      wakeButton?.click();
      await settle();
      const voiceStoppedState = {
        wakeActive: wakeButton?.classList.contains('listening') || false,
        responseVisible: Boolean(responseButton && !responseButton.hidden),
        commandVisible: Boolean(composer.querySelector('button.btn-voice-command') && !composer.querySelector('button.btn-voice-command').hidden),
        languageVisible: Boolean(composer.querySelector('button.btn-voice-language') && !composer.querySelector('button.btn-voice-language').hidden),
        previewHidden: Boolean(composer.getVoicePreviewElement?.()?.hidden),
      };

      return {
        error: undefined,
        activeChatId: panel.dataset.activeChatId || '',
        hostFlowStep: panel.dataset.hostFlowStep || '',
        hostEventCount: Number(panel.dataset.hostEventCount || 0),
        hostEvents,
        sidebarActive,
        footerProvider,
        subagentComposerState,
        webmcpComposerState,
        voicePreview,
        voiceState,
        voiceStoppedState,
        spokenResponses,
        streamingState,
        stoppedState,
        finalState,
        counts: {
          panels: document.querySelectorAll('cascade-chat-panel').length,
          workspaces: document.querySelectorAll('chat-workspace').length,
          composers: document.querySelectorAll('chat-composer').length,
          transcripts: document.querySelectorAll('chat-transcript').length,
          backgrounds: document.querySelectorAll('cell-bg').length,
        },
      };
    })()
  `;

  const result = await withTimeout(page.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }), 18000, 'chat workspace event flow Runtime.evaluate');
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Chat workspace event flow evaluation failed');
  }
  return result.result.value;
}

// Browser smoke is justified here: zero-height graph nodes, SVG trace geometry,
// and compact-mode body visibility are CSS/layout regressions that linkedom cannot prove.
test('cascade lab graph nodes render non-empty with route styles and compact mode in a real browser', { timeout: BROWSER_SMOKE_TIMEOUT_MS }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for browser layout smoke');
    return;
  }

  const server = await createStaticServer();
  let chromeSession;
  let page;
  try {
    chromeSession = await launchChromeSession(chromePath, 'graph smoke');
    page = await withTimeout(
      openPage(chromeSession.endpoint, `${server.url}/demo/cascade-theme-lab.html?v=graph-browser-smoke#node-studio/editable-canvas`),
      22000,
      'graph smoke page open'
    );
    const smoke = await evaluateGraphSmoke(page);
    const themeSmoke = await evaluateCascadeThemeSmoke(page);

    assert.equal(smoke.error, undefined);
    assert.ok(smoke.nodeCount >= 9, `expected demo graph nodes, got ${smoke.nodeCount}`);

    const zeroNodes = smoke.nodes.filter((node) => (
      node.layoutWidth < 24 ||
      node.layoutHeight < 24 ||
      node.width < 4 ||
      node.height < 4
    ));
    assert.deepEqual(zeroNodes, []);

    const emptyNodes = smoke.nodes.filter((node) => !node.hasVisibleContent);
    assert.deepEqual(emptyNodes, []);

    const byId = new Map(smoke.nodes.map((node) => [node.id, node]));
    for (const id of ['circle-icon-sample', 'circle-image-sample', 'pill-sample', 'svg-shape-sample', 'comment-sample']) {
      assert.ok(byId.has(id), `expected graph demo node ${id}`);
    }
    assert.equal(byId.get('circle-icon-sample').shape, 'circle');
    assert.equal(byId.get('circle-icon-sample').visibleIcon, true);
    assert.equal(byId.get('circle-image-sample').visibleMedia, true);
    assert.equal(byId.get('pill-sample').shape, 'pill');
    assert.equal(byId.get('svg-shape-sample').shape, 'hexagon');
    assert.equal(byId.get('svg-shape-sample').visibleMedia, true);
    assert.equal(byId.get('comment-sample').shape, 'comment');

    assert.ok(byId.get('svg-shape-sample').shapeStroke);
    assert.ok(byId.get('svg-shape-sample').shapeStrokeWidth);
    assert.ok(byId.get('circle-icon-sample').circleIconSize);
    assert.equal(
      cssNumber(byId.get('circle-icon-sample').iconBox.fontSize),
      cssNumber(byId.get('circle-icon-sample').circleIconSize)
    );
    assert.ok(byId.get('circle-image-sample').circleMediaSize);
    assert.ok(byId.get('circle-image-sample').mediaBox.width > 10);
    assert.ok(byId.get('circle-image-sample').mediaBox.height > 10);
    assert.ok(byId.get('comment-sample').commentPadding);
    assert.equal(
      cssNumber(byId.get('comment-sample').bodyBox.padding),
      cssNumber(byId.get('comment-sample').commentPadding)
    );
    assert.ok(byId.get('svg-shape-sample').svgBox?.visible || byId.get('svg-shape-sample').svgPathBox?.visible);

    for (const [style, snapshot] of Object.entries(smoke.routing)) {
      assert.equal(snapshot.effectiveStyle, style);
      assert.ok(snapshot.paths.length >= 8, `expected ${style} connection paths`);
      assert.ok(snapshot.paths.every((route) => route.d.startsWith('M ')), `expected ${style} SVG path commands`);
      assert.ok(snapshot.dots.length >= snapshot.paths.length * 2, `expected ${style} connection endpoint dots`);
      assert.ok(snapshot.dots.every((dot) => Number.isFinite(dot.cx) && Number.isFinite(dot.cy) && dot.r > 0));
      assert.ok(snapshot.paths.every((route) => route.stroke && route.stroke !== 'none'));
      assert.ok(snapshot.paths.every((route) => Number.parseFloat(route.strokeWidth) > 0));
    }
    assert.ok(smoke.routing.bezier.paths.some((route) => route.d.includes(' C ')));
    assert.ok(smoke.routing.pcb.paths.some((route) => / [HV] /.test(route.d)));
    assert.ok(smoke.routing.straight.paths.every((route) => route.d.includes(' L ')));
    assert.ok(smoke.routing.straight.paths.every((route) => !/[CHV]/.test(route.d.replace(/^M /, ''))));
    assert.notDeepEqual(smoke.routing.pcb.paths.map((route) => route.d), smoke.routing.bezier.paths.map((route) => route.d));
    assert.notDeepEqual(smoke.routing.straight.paths.map((route) => route.d), smoke.routing.bezier.paths.map((route) => route.d));
    assert.notDeepEqual(smoke.routing.pcb.paths.map((route) => route.d), smoke.routing.straight.paths.map((route) => route.d));
    assert.ok(smoke.compact.hiddenBodies >= smoke.nodeCount - 1);
    assert.equal(smoke.compact.effectiveStyle, smoke.preCompact.effectiveStyle);
    assert.equal(smoke.compact.paths.length, smoke.preCompact.paths.length);
    assert.ok(smoke.compact.paths.every((route) => route.d.startsWith('M ') && / [LHV] /.test(route.d)));
    assert.ok(smoke.compact.dots.length >= smoke.compact.paths.length * 2);
    assert.ok(smoke.compact.dots.every((dot) => Number.isFinite(dot.cx) && Number.isFinite(dot.cy) && dot.r > 0));
    assert.equal(smoke.directPcb.pathStyle, 'pcb');
    assert.ok(smoke.directPcb.path, 'expected rendered adjacent-node direct PCB path');
    assert.match(smoke.directPcb.path.d, /^M [^ ]+ [^ ]+ [HV] [^ ]+$/);

    assert.equal(themeSmoke.base.root.typeScale, '1.00');
    assert.equal(themeSmoke.scaled.root.typeScale, '1.18');
    assert.equal(themeSmoke.scaled.root.headingScale, '1.24');
    assert.equal(themeSmoke.scaled.root.density, '1.16');
    assert.equal(themeSmoke.scaled.root.outline, '0.72');
    assert.ok(cssNumber(themeSmoke.scaled.primaryButton.fontSize) > cssNumber(themeSmoke.base.primaryButton.fontSize));
    assert.ok(cssNumber(themeSmoke.scaled.graphButton.fontSize) > cssNumber(themeSmoke.base.graphButton.fontSize));
    assert.ok(cssNumber(themeSmoke.scaled.graphIcon.fontSize) > cssNumber(themeSmoke.base.graphIcon.fontSize));
    assert.ok(cssNumber(themeSmoke.scaled.dataCell.fontSize) > cssNumber(themeSmoke.base.dataCell.fontSize));
    assert.ok(cssNumber(themeSmoke.scaled.emptyIcon.fontSize) > cssNumber(themeSmoke.base.emptyIcon.fontSize));
    assert.ok(cssNumber(themeSmoke.scaled.eventFeed.fontSize) > cssNumber(themeSmoke.base.eventFeed.fontSize));
    assert.ok(cssNumber(themeSmoke.scaled.sourceHeader.fontSize) > cssNumber(themeSmoke.base.sourceHeader.fontSize));
    assert.ok(cssNumber(themeSmoke.scaled.statusIcon.fontSize) > cssNumber(themeSmoke.base.statusIcon.fontSize));
    assert.ok(cssNumber(themeSmoke.scaled.defaultButton.padding) > cssNumber(themeSmoke.base.defaultButton.padding));
    assert.ok(cssNumber(themeSmoke.scaled.graphStats.padding) > cssNumber(themeSmoke.base.graphStats.padding));
    assert.ok(cssNumber(themeSmoke.scaled.dataCell.padding) > cssNumber(themeSmoke.base.dataCell.padding));
    assert.ok(cssNumber(themeSmoke.scaled.statusRibbon.padding) > cssNumber(themeSmoke.base.statusRibbon.padding));
    assert.ok(cssNumber(themeSmoke.scaled.primaryButton.borderLeftWidth) >= cssNumber(themeSmoke.base.primaryButton.borderLeftWidth));
    assert.ok(cssNumber(themeSmoke.scaled.dataCell.borderTopWidth) >= cssNumber(themeSmoke.base.dataCell.borderTopWidth));
    assert.ok(contrastRatio(
      themeSmoke.scaled.primaryButton.color,
      themeSmoke.scaled.primaryButton.backgroundColor
    ) >= 4.5);
    const tabIconColors = new Set(themeSmoke.scaled.tabItems.map((item) => item.iconColor));
    assert.ok(tabIconColors.size >= 3, `expected rotated tab accent colors, got ${[...tabIconColors].join(', ')}`);
  } finally {
    page?.close();
    await closeChromeSession(chromeSession);
    await server.close();
  }
});

// Browser smoke is justified here: repeated drag/pan uses real pointer events,
// native scroll state, and layout transforms that linkedom cannot model.
test('node-canvas flow-scroll drag keeps repeated pan gestures continuous', { timeout: BROWSER_SMOKE_TIMEOUT_MS }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for flow-scroll drag smoke');
    return;
  }

  const server = await createStaticServer();
  let chromeSession;
  let page;
  try {
    chromeSession = await launchChromeSession(chromePath, 'flow-scroll drag smoke');
    page = await withTimeout(
      openPage(chromeSession.endpoint, `${server.url}/demo/cascade-theme-lab.html?v=flow-scroll-drag-smoke`),
      22000,
      'flow-scroll drag page open'
    );
    const smoke = await evaluateFlowScrollDragSmoke(page);

    assert.equal(smoke.initial.panY, 0);
    assert.equal(smoke.afterFirst.panY, 0);
    assert.equal(smoke.afterSecond.panY, 0);
    assert.ok(smoke.afterFirst.scrollTop > smoke.initial.scrollTop, JSON.stringify(smoke, null, 2));
    assert.ok(smoke.afterSecond.scrollTop > smoke.afterFirst.scrollTop, JSON.stringify(smoke, null, 2));
    assert.ok(
      Math.abs(smoke.afterSecond.contentTop - smoke.afterFirst.contentTop) <= 16,
      JSON.stringify(smoke, null, 2)
    );
  } finally {
    page?.close();
    await closeChromeSession(chromeSession);
    await server.close();
  }
});

// Browser smoke is justified here: multi-node focus is viewport geometry that
// depends on rendered graph-node dimensions and canvas transform behavior.
test('node-canvas focuses multiple nodes by fitting them into the viewport', { timeout: BROWSER_SMOKE_TIMEOUT_MS }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for multi-node focus smoke');
    return;
  }

  const server = await createStaticServer();
  let chromeSession;
  let page;
  try {
    chromeSession = await launchChromeSession(chromePath, 'multi-node focus smoke');
    page = await withTimeout(
      openPage(chromeSession.endpoint, `${server.url}/demo/cascade-theme-lab.html?v=multi-node-focus-smoke`),
      22000,
      'multi-node focus page open'
    );
    const smoke = await evaluateNodeCanvasMultiFocusSmoke(page);

    assert.equal(smoke.ok, true, JSON.stringify(smoke, null, 2));
    assert.equal(smoke.allFocusedVisible, true, JSON.stringify(smoke, null, 2));
    assert.equal(smoke.focused.find((node) => node.id === 'hero')?.selected, true);
    assert.ok(smoke.zoom > 0 && smoke.zoom <= 1, JSON.stringify(smoke, null, 2));
  } finally {
    page?.close();
    await closeChromeSession(chromeSession);
    await server.close();
  }
});

test('agent workspace demo exposes the public feature showcase groups', { timeout: SHOWCASE_BROWSER_SMOKE_TIMEOUT_MS }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for browser layout smoke');
    return;
  }

  const server = await createStaticServer();
  let chromeSession;
  let page;
  try {
    chromeSession = await launchChromeSession(chromePath, 'showcase smoke');
    page = await withTimeout(
      openPage(chromeSession.endpoint, `${server.url}/demo/cascade-theme-lab.html?v=agent-workspace-showcase-smoke`),
      22000,
      'showcase smoke page open'
    );
    await setPageViewport(page, { width: 1024, height: 768 });
    const smoke = await evaluateShowcaseSmoke(page);
    const isVisible = (box) => Boolean(
      box &&
      box.display !== 'none' &&
      box.visibility !== 'hidden' &&
      box.width > 4 &&
      box.height > 4
    );

    assert.match(smoke.title, /Showcase Demo/);
    assert.equal(smoke.shellTitle, 'symbiote-ui Showcase');
    assert.equal(smoke.projectPath, 'project-type workspaces / agent constructor');
    assert.equal(smoke.customRailCount, 0);
    assert.equal(smoke.chatPanelCount, 1);
    assert.equal(smoke.composerCount, 1);
    assert.equal(smoke.agentChatNode?.collapsed, true);
    assert.equal(smoke.agentChatNode?.collapseDir, 'horizontal');
    assert.equal(smoke.expandedAgentChat?.collapsed, false);
    assert.ok(
      smoke.expandedAgentChat?.width >= 300,
      `expanded agent chat should keep a normal assistant width: ${JSON.stringify(smoke.expandedAgentChat)}`
    );
    for (const label of [
      'Symbiote UI',
      'Chat',
      'Multi-Agent Dev',
      'Automation',
      'Media Generation',
      'Video Editor',
      'Data / Research',
      'Node Studio',
      'Spatial / XR',
    ]) {
      assert.ok(
        smoke.tabs.some((tab) => tab.includes(label)),
        `expected demo tab ${label}`
      );
    }

    assert.equal(smoke.groups.symbiote.hash, '#symbiote-ui/overview');
    assert.equal(smoke.groups.symbiote.activeProject, 'symbiote-ui');
    assert.equal(smoke.groups.symbiote.activeView, 'overview');
    assert.ok(isVisible(smoke.groups.symbiote.overview), JSON.stringify(smoke.groups.symbiote, null, 2));
    assert.equal(isVisible(smoke.groups.symbiote.project), false);
    assert.equal(isVisible(smoke.groups.symbiote.graph), false);
    assert.equal(smoke.groups.symbiote.customRailCount, 0);
    assert.equal(smoke.groups.symbiote.chatPanelCount, 1);
    assert.equal(smoke.groups.symbiote.composerCount, 1);
    assert.equal(smoke.groups.symbiote.agentChatNode?.collapsed, true);
    assert.ok(smoke.groups.symbiote.sidebarLabels.some((label) => label.includes('Overview')));
    assert.ok(smoke.groups.symbiote.sidebarLabels.some((label) => label.includes('Component roles')));
    assert.ok(smoke.groups.symbiote.sidebarLabels.some((label) => label.includes('Engine link')));

    assert.equal(smoke.groups.chat.hash, '#chat/conversation');
    assert.equal(smoke.groups.chat.activeProject, 'chat');
    assert.ok(isVisible(smoke.groups.chat.chat), JSON.stringify(smoke.groups.chat, null, 2));
    assert.equal(smoke.groups.chat.chatPanelCount, 1);
    assert.equal(smoke.groups.chat.composerCount, 1);
    assert.equal(smoke.groups.chat.agentChatNode, null);
    assert.equal(isVisible(smoke.groups.chat.runtime), false);
    assert.equal(isVisible(smoke.groups.chat.theme), false);
    assert.ok(smoke.groups.chat.sidebarLabels.some((label) => label.includes('Voice controls')));

    assert.equal(smoke.groups.dev.hash, '#multi-agent-dev/source-editor');
    assert.equal(smoke.groups.dev.activeProject, 'multi-agent-dev');
    assert.equal(smoke.groups.dev.activeView, 'source-editor');
    assert.ok(isVisible(smoke.groups.dev.project), JSON.stringify(smoke.groups.dev, null, 2));
    assert.ok(isVisible(smoke.groups.dev.source), JSON.stringify(smoke.groups.dev, null, 2));
    assert.ok(isVisible(smoke.groups.dev.sourceEditor));
    assert.match(smoke.groups.dev.sourceEditorValue, /createRuntimeUiController/);
    assert.equal(isVisible(smoke.groups.dev.sourceViewer), false);
    assert.equal(isVisible(smoke.groups.dev.canvasGraph), false);
    assert.ok(smoke.groups.dev.projectFiles.some((item) => item.includes('agent-workspace.md')));

    assert.equal(smoke.groups.devDocs.hash, '#multi-agent-dev/markdown-docs');
    assert.ok(isVisible(smoke.groups.devDocs.project), JSON.stringify(smoke.groups.devDocs, null, 2));
    assert.ok(isVisible(smoke.groups.devDocs.docs), JSON.stringify(smoke.groups.devDocs, null, 2));
    assert.ok(isVisible(smoke.groups.devDocs.sourceViewer));
    assert.equal(isVisible(smoke.groups.devDocs.sourceEditor), false);
    assert.ok(smoke.groups.devDocs.sourceViewer.text.includes('Agent workspace'));

    assert.equal(smoke.groups.devGraph.hash, '#multi-agent-dev/dependency-graph');
    assert.ok(isVisible(smoke.groups.devGraph.projectMap), JSON.stringify(smoke.groups.devGraph, null, 2));
    assert.ok(isVisible(smoke.groups.devGraph.canvasGraph));
    assert.equal(isVisible(smoke.groups.devGraph.sourceEditor), false);

    assert.equal(smoke.groups.automation.hash, '#automation/engine-state');
    assert.ok(isVisible(smoke.groups.automation.runtime), JSON.stringify(smoke.groups.automation, null, 2));
    assert.ok(smoke.groups.automation.sidebarLabels.some((label) => label.includes('Execution logs')));

    assert.equal(smoke.groups.media.hash, '#media-generation/variants');
    assert.ok(isVisible(smoke.groups.media.ui), JSON.stringify(smoke.groups.media, null, 2));
    assert.ok(smoke.groups.media.sidebarLabels.some((label) => label.includes('Variants')));

    assert.equal(smoke.groups.video.hash, '#video-editor/timeline');
    assert.ok(isVisible(smoke.groups.video.graph), JSON.stringify(smoke.groups.video, null, 2));
    assert.ok(smoke.groups.video.sidebarLabels.some((label) => label.includes('Timeline')));
    assert.ok(smoke.groups.video.sidebarLabels.some((label) => label.includes('Render queue')));

    assert.equal(smoke.groups.data.hash, '#data-research/report');
    assert.ok(isVisible(smoke.groups.data.project), JSON.stringify(smoke.groups.data, null, 2));
    assert.ok(smoke.groups.data.sidebarLabels.some((label) => label.includes('Report')));

    assert.equal(smoke.groups.node.hash, '#node-studio/pcb-routing');
    assert.ok(isVisible(smoke.groups.node.graph), JSON.stringify(smoke.groups.node, null, 2));
    assert.ok(smoke.groups.node.sidebarLabels.some((label) => label.includes('PCB routing')));

    assert.equal(smoke.groups.spatial.hash, '#spatial-xr/3d-graph');
    assert.ok(isVisible(smoke.groups.spatial.spatial), JSON.stringify(smoke.groups.spatial, null, 2));
    assert.ok(isVisible(smoke.groups.spatial.graph));
    assert.equal(smoke.groups.spatial.customRailCount, 0);
    assert.equal(smoke.groups.spatial.chatPanelCount, 1);
    assert.equal(smoke.groups.spatial.agentChatNode?.collapsed, true);

    assert.deepEqual(smoke.groups.automation.runtimeFeatures, [
      'runtime-ui-v1',
      'WebMCP descriptors',
      'layout actions',
      'SSR-safe core',
    ]);
    assert.deepEqual(
      smoke.groups.spatial.spatialNodes.map((node) => node.id),
      ['project', 'runtime', 'ui', 'voice', 'xr']
    );
    assert.ok(smoke.groups.spatial.spatialNodes.every((node) => node.width > 20 && node.height > 20));
    assert.ok(smoke.groups.spatial.spatialNodes.every((node) => node.scale));
  } finally {
    page?.close();
    await closeChromeSession(chromeSession);
    await server.close();
  }
});

test('showcase chat workspace exercises host event flow through library primitives', { timeout: BROWSER_SMOKE_TIMEOUT_MS }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for chat workspace event smoke');
    return;
  }

  const server = await createStaticServer();
  let chromeSession;
  let page;
  try {
    chromeSession = await launchChromeSession(chromePath, 'chat workspace event flow smoke');
    page = await withTimeout(
      openPage(chromeSession.endpoint, `${server.url}/demo/cascade-theme-lab.html?v=chat-workspace-event-flow-smoke#chat/conversation`),
      22000,
      'chat workspace event flow page open'
    );
    await setPageViewport(page, { width: 1100, height: 760 });
    await page.send('Runtime.evaluate', {
      expression: String.raw`
        (() => {
          if (navigator.permissions) {
            navigator.permissions.query = async (descriptor) => {
              if (descriptor.name === 'microphone') {
                return { state: 'granted' };
              }
              return { state: 'denied' };
            };
          }
          if (navigator.mediaDevices) {
            navigator.mediaDevices.getUserMedia = async () => {
              return {
                getTracks() {
                  return [{
                    stop() {}
                  }];
                }
              };
            };
          }
          const mockSpeechRecognition = class {
            constructor() {
              this.lang = '';
              this.continuous = false;
              this.interimResults = false;
            }
            start() {
              setTimeout(() => {
                if (this.onstart) this.onstart();
                setTimeout(() => {
                  if (this.onresult) {
                    this.onresult({
                      resultIndex: 0,
                      results: [
                        Object.assign([
                          { transcript: 'wake listening active' }
                        ], { isFinal: true })
                      ]
                    });
                  }
                }, 100);
              }, 50);
            }
            stop() {
              if (this.onend) this.onend();
            }
            abort() {
              if (this.onend) this.onend();
            }
          };
          window.SpeechRecognition = mockSpeechRecognition;
          window.webkitSpeechRecognition = mockSpeechRecognition;
        })()
      `,
      awaitPromise: true,
    });
    const flow = await evaluateChatWorkspaceEventFlow(page);

    assert.equal(flow.error, undefined, JSON.stringify(flow, null, 2));
    assert.deepEqual(flow.counts, {
      panels: 1,
      workspaces: 1,
      composers: 1,
      transcripts: 1,
      backgrounds: 1,
    });
    assert.equal(flow.activeChatId, 'webmcp');
    assert.equal(flow.sidebarActive, 'webmcp');
    assert.equal(flow.footerProvider, 'codex');
    assert.equal(flow.subagentComposerState.activeChatId, 'architecture-audit');
    assert.equal(flow.subagentComposerState.sidebarActive, 'architecture-audit');
    assert.equal(flow.subagentComposerState.ariaDisabled, '');
    assert.equal(flow.subagentComposerState.lockedRows, 0);
    assert.equal(flow.subagentComposerState.lockIcons, 0);
    assert.equal(flow.subagentComposerState.composerDisabled, true);
    assert.equal(flow.subagentComposerState.inputDisabled, true);
    assert.equal(flow.subagentComposerState.sendDisabled, true);
    assert.equal(flow.subagentComposerState.micDisabled, true);
    assert.equal(flow.webmcpComposerState.composerDisabled, false);
    assert.equal(flow.webmcpComposerState.inputDisabled, false);
    assert.equal(flow.webmcpComposerState.sendDisabled, false);
    assert.ok(flow.hostEventCount >= 8, JSON.stringify(flow.hostEvents, null, 2));
    assert.ok(flow.hostEvents.some((event) => event.type === 'select-chat' && event.activeChatId === 'webmcp'));
    assert.ok(flow.hostEvents.some((event) => event.type === 'footer-intent' && event.id === 'provider' && event.provider === 'codex'));
    assert.ok(flow.hostEvents.some((event) => event.type === 'stream-start'));
    assert.ok(flow.hostEvents.some((event) => event.type === 'stream-stop' && event.reason === 'manual-stop'));
    assert.ok(flow.hostEvents.some((event) => event.type === 'stream-tool'));
    assert.ok(flow.hostEvents.some((event) => event.type === 'stream-responding'));
    assert.ok(flow.hostEvents.some((event) => event.type === 'stream-complete'));
    assert.equal(flow.voicePreview, '');
    assert.equal(flow.voiceState.wakeActive, true);
    assert.equal(flow.voiceState.responseActive, true);
    assert.equal(flow.voiceStoppedState.wakeActive, false);
    assert.equal(flow.voiceStoppedState.responseVisible, false);
    assert.equal(flow.voiceStoppedState.commandVisible, false);
    assert.equal(flow.voiceStoppedState.languageVisible, false);
    assert.equal(flow.voiceStoppedState.previewHidden, true);
    assert.equal(flow.streamingState.sending, true);
    assert.match(flow.streamingState.background, /streaming|thinking|tool|responding/);
    assert.match(flow.streamingState.liveStatus, /Planning|Running|Writing/);
    assert.equal(flow.stoppedState.sending, false);
    assert.equal(flow.stoppedState.background, 'stop');
    assert.equal(flow.finalState.sending, false);
    assert.equal(flow.finalState.background, 'done');
    assert.equal(flow.spokenResponses.length, 1);
    assert.match(flow.spokenResponses[0].text, /Mock host adapter handled/);
    assert.equal(flow.spokenResponses[0].lang, 'ru-RU');
    assert.ok(flow.finalState.messageCount >= 5);
    assert.ok(flow.finalState.messageRoles.includes('agent'));
    assert.ok(flow.finalState.messageRoles.includes('tool'));
    assert.ok(flow.finalState.messageRoles.includes('board'));
    assert.ok(flow.finalState.messageRoles.includes('thinking'));
    assert.ok(flow.finalState.messageDomState.agentMessages >= 1, JSON.stringify(flow.finalState.messageDomState));
    assert.equal(flow.finalState.messageDomState.assistantMessages, 0);
    assert.ok(flow.finalState.messageDomState.workSummaries >= 1, JSON.stringify(flow.finalState.messageDomState));
    assert.ok(flow.finalState.messageDomState.toolCards >= 1, JSON.stringify(flow.finalState.messageDomState));
    assert.ok(flow.finalState.messageDomState.statusBoards >= 1, JSON.stringify(flow.finalState.messageDomState));
    assert.ok(flow.finalState.messageDomState.thinkingBlocks >= 1, JSON.stringify(flow.finalState.messageDomState));
    assert.ok(flow.finalState.messageDomState.codeBlocks >= 1, JSON.stringify(flow.finalState.messageDomState));
    assert.ok(flow.finalState.messageDomState.tables >= 1, JSON.stringify(flow.finalState.messageDomState));
    assert.match(flow.finalState.lastText, /Mock host adapter handled|library provided the visible chat workspace/);
  } finally {
    page?.close();
    await closeChromeSession(chromeSession);
    await server.close();
  }
});

// Browser smoke is justified here: this verifies the browser import path and
// adapter interaction surface for the optional Three renderer without making
// Three.js a package dependency.
test('three spatial graph adapter renders and drags through the browser module path', { timeout: BROWSER_SMOKE_TIMEOUT_MS }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for spatial graph adapter smoke');
    return;
  }

  const server = await createStaticServer();
  let chromeSession;
  let page;
  try {
    chromeSession = await launchChromeSession(chromePath, 'three spatial adapter smoke');
    page = await withTimeout(
      openPage(chromeSession.endpoint, `${server.url}/demo/cascade-theme-lab.html?v=three-spatial-adapter-smoke#spatial-xr/3d-graph`),
      22000,
      'three spatial adapter smoke page open'
    );
    const expression = String.raw`
    (async () => {
      const [{ createSpatialGraphModel }, { createThreeSpatialGraph }] = await Promise.all([
        import('/xr/spatial-graph.js'),
        import('/xr/three-spatial-graph.js')
      ]);
      const mockTHREE = {
        Group: class {
          constructor() {
            this.children = [];
            this.userData = {};
            this.position = { set: (x, y, z) => { this.x = x; this.y = y; this.z = z; } };
            this.scale = { set: (x, y, z) => { this.sx = x; this.sy = y; this.sz = z; } };
          }
          add(child) { this.children.push(child); }
          remove(child) {
            const index = this.children.indexOf(child);
            if (index >= 0) this.children.splice(index, 1);
          }
        },
        SphereGeometry: class { dispose() {} },
        RingGeometry: class { dispose() {} },
        MeshBasicMaterial: class {
          constructor(options) {
            this.hex = 0;
            this.opacity = options.opacity ?? 1;
            this.color = { setHex: (hex) => { this.hex = hex; } };
            this.color.setHex(options.color);
          }
          dispose() {}
        },
        Mesh: class {
          constructor(geometry, material) {
            this.geometry = geometry;
            this.material = material;
            this.userData = {};
            this.visible = true;
            this.position = { set: (x, y, z) => { this.x = x; this.y = y; this.z = z; } };
            this.scale = { set: (x, y, z) => { this.sx = x; this.sy = y; this.sz = z; } };
          }
        },
        Vector3: class {
          constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
        },
        BufferGeometry: class {
          constructor() {
            this.attributes = { position: {
              setXYZ: (index, x, y, z) => {
                this.points[index] = { x, y, z };
              },
              needsUpdate: false
            } };
            this.points = [];
          }
          setFromPoints(points) { this.points = points; return this; }
          dispose() {}
        },
        LineBasicMaterial: class { dispose() {} },
        Line: class {
          constructor(geometry, material) {
            this.geometry = geometry;
            this.material = material;
            this.userData = {};
          }
        }
      };
      const model = createSpatialGraphModel({
        nodes: [
          { id: 'source', label: 'Source', position: [0, 0, -5], radius: 1, draggable: true },
          { id: 'target', label: 'Target', position: [2, 0, -5], radius: 1 }
        ],
        links: [{ id: 'edge', source: 'source', target: 'target' }]
      });
      const renderer = createThreeSpatialGraph(mockTHREE, model);
      renderer.setModel({
        ...model,
        selection: { activeNodeId: 'source', focusedNodeId: 'target' }
      });
      const start = renderer.startNodeDrag({
        kind: 'ray',
        origin: [0, 0, 0],
        direction: [0, 0, -1]
      });
      const move = renderer.moveNodeDrag({
        kind: 'ray',
        origin: [0, 0, 0],
        direction: [0.2, 0, -1]
      });
      const end = renderer.endNodeDrag();
      const updated = renderer.getModel().nodes.find((node) => node.id === 'source');
      return {
        childCount: renderer.group.children.length,
        labelText: renderer.getLabelObject('source')?.userData?.text,
        selectedHex: renderer.getNodeObject('source')?.material?.hex,
        focusedAffordanceVisible: renderer.getDragAffordance('target')?.visible,
        startPhase: start?.phase,
        movePhase: move?.phase,
        endPhase: end?.phase,
        movedX: updated.position[0],
        movedZ: updated.position[2]
      };
    })()
    `;
    const evaluation = await withTimeout(page.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }), 15000, 'three spatial adapter Runtime.evaluate');
    if (evaluation.exceptionDetails) {
      throw new Error(evaluation.exceptionDetails.text || 'Three spatial adapter evaluation failed');
    }
    const result = evaluation.result.value;

    assert.ok(result.childCount >= 7);
    assert.equal(result.labelText, 'Source');
    assert.equal(result.selectedHex, 0xff0055);
    assert.equal(result.focusedAffordanceVisible, true);
    assert.equal(result.startPhase, 'start');
    assert.equal(result.movePhase, 'move');
    assert.equal(result.endPhase, 'end');
    assert.ok(result.movedX > 0);
    assert.ok(Number.isFinite(result.movedZ));
  } finally {
    page?.close();
    await closeChromeSession(chromeSession);
    await server.close();
  }
});

test('cascade lab chat composer keeps voice controls inside the input surface responsively', { timeout: BROWSER_SMOKE_TIMEOUT_MS }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for browser layout smoke');
    return;
  }

  const server = await createStaticServer();
  let chromeSession;
  let page;
  try {
    chromeSession = await launchChromeSession(chromePath, 'composer smoke');
    page = await withTimeout(
      openPage(chromeSession.endpoint, `${server.url}/demo/cascade-theme-lab.html?v=composer-browser-smoke#chat/conversation`),
      22000,
      'composer smoke page open'
    );
    const smokeResults = [await evaluateComposerSmoke(page), await evaluateComposerSmoke(page, 320)];
    const voiceRuntimeSmoke = await evaluateComposerVoiceRuntimeSmoke(page);

    await setPageViewport(page, { width: 390, height: 760, mobile: true });
    await navigatePage(page, `${server.url}/demo/cascade-theme-lab.html?v=composer-browser-smoke-narrow#chat/conversation`);
    smokeResults.push(await evaluateComposerSmoke(page));

    assert.equal(voiceRuntimeSmoke.error, undefined);
    assert.equal(voiceRuntimeSmoke.activeControls.inputState, 'listening');
    assert.equal(voiceRuntimeSmoke.activeControls.commandVisible, true);
    assert.equal(voiceRuntimeSmoke.activeControls.languageVisible, true);
    assert.equal(voiceRuntimeSmoke.activeControls.activeLanguage, 'RU');
    assert.ok(voiceRuntimeSmoke.activeControls.commandHints.length >= 4);
    assert.match(voiceRuntimeSmoke.activeControls.previewStatus, /Recording 00:00/);
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.wakeActive, true);
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.inputVisible, true);
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.inputState, 'idle');
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.commandVisible, true);
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.languageVisible, true);
    assert.ok(['RU', 'ES', 'EN'].includes(voiceRuntimeSmoke.wakeActiveControls.activeLanguage));
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.previewHidden, true);
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.previewStatus, '');
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.commandHints.length, 0);
    assert.equal(voiceRuntimeSmoke.wakeActiveControls.recognitionCount, 3);
    assert.match(voiceRuntimeSmoke.wakeMatched.previewStatus, /Recording 00:00|wake matched/i);
    assert.equal(voiceRuntimeSmoke.wakeMatched.inputState, 'listening');
    assert.equal(voiceRuntimeSmoke.wakeMatched.recognitionCount, 4);
    assert.equal(voiceRuntimeSmoke.wakeMatched.wakeRecognitionAborted, true);
    assert.match(voiceRuntimeSmoke.wakeDictation.previewText, /построй рабочую область/);
    assert.ok(voiceRuntimeSmoke.wakeDictation.commandHints.length >= 4);
    assert.equal(voiceRuntimeSmoke.wakeCancel.wakeActive, true);
    assert.equal(voiceRuntimeSmoke.wakeCancel.previewHidden, true);
    assert.equal(voiceRuntimeSmoke.wakeCancel.inputState, 'idle');
    assert.equal(voiceRuntimeSmoke.wakeStoppedControls.wakeActive, false);
    assert.equal(voiceRuntimeSmoke.wakeStoppedControls.commandText, '');
    assert.equal(voiceRuntimeSmoke.wakeStoppedControls.responseVisible, false);
    assert.equal(voiceRuntimeSmoke.wakeStoppedControls.commandVisible, false);
    assert.equal(voiceRuntimeSmoke.wakeStoppedControls.languageVisible, false);
    assert.equal(voiceRuntimeSmoke.wakeStoppedControls.previewHidden, true);
    const recognitionLanguages = voiceRuntimeSmoke.recognition.map((item) => item.startLang);
    assert.deepEqual(recognitionLanguages.slice(0, 2), ['ru-RU', 'es-ES']);
    assert.ok(['ru-RU', 'es-ES', 'en-US'].includes(recognitionLanguages[2]));
    assert.equal(recognitionLanguages[3], recognitionLanguages[2]);
    assert.ok(recognitionLanguages.slice(4).every((language) => language === recognitionLanguages[2]));
    assert.equal(voiceRuntimeSmoke.recognition[0].aborted, true);
    assert.equal(voiceRuntimeSmoke.recognition[1].stopped, true);
    assert.equal(voiceRuntimeSmoke.recognition[2].aborted, true);
    assert.equal(voiceRuntimeSmoke.recognition[3].aborted, true);
    assert.deepEqual(voiceRuntimeSmoke.submissions, ['Build project UI ahora']);
    assert.equal(voiceRuntimeSmoke.previewHidden, true);

    for (const smoke of smokeResults) {
      assert.equal(smoke.error, undefined);
      assert.equal(smoke.visibleBodyCount, 1);
      assert.ok(smoke.composer.width > 0);
      assert.ok(smoke.body.width > 0);
      assert.ok(smoke.textarea.width > 0);
      assert.ok(smoke.actions.width > 0);
      assert.ok(smoke.send.width > 0);
      assert.ok(smoke.chat.sidebar.width > 0);
      assert.ok(smoke.chat.transcript.width > 0);
      assert.ok(smoke.chat.messages.height > 0);
      assert.ok(smoke.chat.footer.width > 0);
      assert.ok(smoke.chat.contextBar.width > 0);
      assert.equal(smoke.actions.alignSelf, 'end');
      assert.equal(smoke.send.alignSelf, 'end');
      assert.ok(smoke.controls.length >= 5);
      const controlToken = (control) => [
        'btn-mic',
        'btn-wake-listen',
        'btn-voice-response',
        'btn-voice-command',
        'btn-voice-language',
        'btn-send',
      ].find((token) => String(control.className || '').split(/\s+/).includes(token));
      if (smoke.actions.gridRow === '1') {
        assert.deepEqual(smoke.initialControls.map(controlToken), ['btn-wake-listen', 'btn-mic', 'btn-send']);
      }
      if (smoke.actions.gridRow === '1') {
        assert.deepEqual(smoke.controls.map(controlToken), [
          'btn-wake-listen',
          'btn-voice-response',
          'btn-voice-command',
          'btn-voice-language',
          'btn-send',
        ]);
      } else {
        for (const token of ['btn-wake-listen', 'btn-voice-response', 'btn-voice-command', 'btn-voice-language', 'btn-send']) {
          assert.ok(smoke.controls.map(controlToken).includes(token));
        }
      }
      const visibleLanguageOptions = smoke.languageOptions.filter((option) => option.visible);
      assert.ok(visibleLanguageOptions.length >= 1);
      assert.equal(visibleLanguageOptions.filter((option) => option.active).length, 1);
      if (smoke.body.width <= 340) {
        assert.deepEqual(visibleLanguageOptions.map((option) => option.text), ['RU']);
      } else {
        assert.deepEqual(visibleLanguageOptions.map((option) => option.text), ['RU', 'ES', 'EN']);
      }
      assert.ok(smoke.chat.footerControls.length >= 5);
      assert.ok(smoke.chat.chips.length >= 2);
      assert.deepEqual(smoke.controls.filter((control) => !control.insideBody), []);
      assert.deepEqual(smoke.chat.footerControls.filter((control) => !control.insideFooter), []);
      assert.deepEqual(smoke.chat.chips.filter((chip) => !chip.insideContextBar), []);
      assert.ok(smoke.chat.footer.scrollWidth <= smoke.chat.footer.clientWidth + 1);
      assert.ok(smoke.chat.contextBar.scrollWidth <= smoke.chat.contextBar.clientWidth + 1);
      assert.deepEqual(smoke.chat.chips.filter((chip) => chip.path.width > chip.box.width + 1), []);
      assert.deepEqual(smoke.chat.chips.filter((chip) => chip.path.overflow !== 'hidden'), []);
      assert.deepEqual(smoke.chat.chips.filter((chip) => chip.path.textOverflow !== 'ellipsis'), []);
      if (smoke.chat.scrollButton?.atBottom?.hasOverflow) {
        assert.equal(smoke.chat.scrollButton.atBottom.visible, false);
        assert.equal(smoke.chat.scrollButton.scrolled.visible, true);
        let transcript = smoke.chat.transcript;
        let button = smoke.chat.scrollButton.scrolled.box;
        let buttonCenter = button.y + button.height / 2;
        assert.ok(buttonCenter > transcript.y + transcript.height * 0.62, JSON.stringify({ transcript, button }));
        assert.ok(button.bottom <= transcript.bottom + 1, JSON.stringify({ transcript, button }));
      }
      if (smoke.viewport.width <= 420) {
        assert.ok(smoke.chat.panel.width <= smoke.viewport.width + 1);
        assert.ok(smoke.composer.right <= smoke.chat.panel.right + 1);
        assert.ok(smoke.chat.sidebar.width <= smoke.chat.panel.width);
        assert.ok(smoke.chat.transcript.width > 0);
        assert.ok(smoke.chat.transcript.scrollWidth <= smoke.chat.transcript.clientWidth + 1);
        assert.ok(smoke.chat.messages.scrollWidth <= smoke.chat.messages.clientWidth + 1);
      }
      assert.ok(['1', '2'].includes(smoke.actions.gridRow));
      assert.equal(smoke.send.gridRow, '1');
      if (smoke.actions.gridRow === '2') {
        assert.equal(smoke.actions.gridColumn, '1 / -1');
      }
    }
  } finally {
    page?.close();
    await closeChromeSession(chromeSession);
    await server.close();
  }
});

test('node-canvas setEditorModel renders the advertised serializable WebMCP model path', { timeout: BROWSER_SMOKE_TIMEOUT_MS }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for node-canvas adapter smoke');
    return;
  }

  const server = await createStaticServer();
  let chromeSession;
  let page;
  try {
    chromeSession = await launchChromeSession(chromePath, 'node-canvas adapter smoke');
    page = await withTimeout(
      openPage(chromeSession.endpoint, `${server.url}/demo/cascade-theme-lab.html?v=node-canvas-model-adapter#node-studio/editable-canvas`),
      22000,
      'node-canvas adapter page open'
    );
    const expression = String.raw`
    (async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      await customElements.whenDefined('node-canvas');
      await customElements.whenDefined('graph-node');
      const canvas = document.createElement('node-canvas');
      canvas.style.cssText = 'display:block;width:640px;height:360px;';
      document.body.append(canvas);
      const editor = canvas.setEditorModel({
        readonly: true,
        nodes: [
          {
            id: 'source',
            type: 'agent/source',
            name: 'Source',
            outputs: [{ name: 'out', type: 'signal', label: 'out' }]
          },
          {
            id: 'target',
            type: 'agent/target',
            name: 'Target',
            inputs: [{ name: 'in', type: 'signal', label: 'in' }]
          }
        ],
        connections: [{ id: 'c1', from: 'source', out: 'out', to: 'target', in: 'in' }],
        positions: {
          source: [32, 48],
          target: { x: 260, y: 48 }
        }
      });
      for (let index = 0; index < 8; index += 1) await frame();
      const nodes = [...canvas.querySelectorAll('graph-node')];
      const boxes = nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return {
          id: node.id,
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
          text: node.textContent
        };
      });
      return {
        readonly: canvas.hasAttribute('data-readonly'),
        editorNodeCount: editor.getNodes().length,
        editorConnectionCount: editor.getConnections().length,
        domNodeCount: nodes.length,
        boxes
      };
    })()
    `;
    const evaluation = await withTimeout(page.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    }), 15000, 'node-canvas adapter Runtime.evaluate');
    if (evaluation.exceptionDetails) {
      throw new Error(evaluation.exceptionDetails.text || 'NodeCanvas adapter evaluation failed');
    }
    const result = evaluation.result.value;

    assert.equal(result.readonly, true);
    assert.equal(result.editorNodeCount, 2);
    assert.equal(result.editorConnectionCount, 1);
    assert.equal(result.domNodeCount, 2);
    assert.ok(result.boxes.every((box) => box.width > 1 && box.height > 1));
    assert.ok(result.boxes.some((box) => box.text.includes('Source')));
    assert.ok(result.boxes.some((box) => box.text.includes('Target')));
  } finally {
    page?.close();
    await closeChromeSession(chromeSession);
    await server.close();
  }
});
