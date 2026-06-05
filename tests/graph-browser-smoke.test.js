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

function waitForChromeEndpoint(chrome, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => {
      reject(new Error(`Chrome DevTools endpoint was not reported. stderr:\n${stderr}`));
    }, timeoutMs);

    chrome.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve(match[1]);
    });

    chrome.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    chrome.once('exit', (code) => {
      if (code === 0) return;
      clearTimeout(timer);
      reject(new Error(`Chrome exited before DevTools endpoint was ready: ${code}\n${stderr}`));
    });
  });
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

      const bodyBox = readBox(body);
      const textarea = body.querySelector('textarea');
      const actions = body.querySelector('.composer-actions');
      const send = body.querySelector('sn-button.btn-send');
      const controls = [...body.querySelectorAll('.composer-actions button, sn-button.btn-send')]
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          className: el.className,
          text: el.textContent.trim(),
          box: readBox(el),
        }));
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
        chat: {
          panel: readScroll(panel),
          sidebar: readScroll(sidebar),
          transcript: readScroll(transcript),
          messages: readScroll(messages),
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

// Browser smoke is justified here: zero-height graph nodes, SVG trace geometry,
// and compact-mode body visibility are CSS/layout regressions that linkedom cannot prove.
test('cascade lab graph nodes render non-empty with route styles and compact mode in a real browser', { timeout: 45000 }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for browser layout smoke');
    return;
  }

  const server = await createStaticServer();
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'symbiote-ui-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-background-networking',
    '--disable-gpu',
    '--disable-sync',
    '--hide-scrollbars',
    '--no-default-browser-check',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let page;
  try {
    const endpoint = await withTimeout(waitForChromeEndpoint(chrome), 12000, 'Chrome DevTools endpoint');
    page = await withTimeout(
      openPage(endpoint, `${server.url}/demo/cascade-theme-lab.html?v=graph-browser-smoke#graph`),
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
    if (!chrome.killed) chrome.kill('SIGTERM');
    await server.close();
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test('cascade lab chat composer keeps voice controls inside the input surface responsively', { timeout: 45000 }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for browser layout smoke');
    return;
  }

  const server = await createStaticServer();
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'symbiote-ui-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-background-networking',
    '--disable-gpu',
    '--disable-sync',
    '--hide-scrollbars',
    '--no-default-browser-check',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let page;
  try {
    const endpoint = await withTimeout(waitForChromeEndpoint(chrome), 12000, 'Chrome DevTools endpoint');
    page = await withTimeout(
      openPage(endpoint, `${server.url}/demo/cascade-theme-lab.html?v=composer-browser-smoke#chat`),
      22000,
      'composer smoke page open'
    );
    const smokeResults = [await evaluateComposerSmoke(page), await evaluateComposerSmoke(page, 320)];

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
      assert.ok(['1', '2'].includes(smoke.actions.gridRow));
      assert.equal(smoke.send.gridRow, '1');
      if (smoke.actions.gridRow === '2') {
        assert.equal(smoke.actions.gridColumn, '1 / -1');
      }
    }
  } finally {
    page?.close();
    if (!chrome.killed) chrome.kill('SIGTERM');
    await server.close();
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});

test('node-canvas setEditorModel renders the advertised serializable WebMCP model path', { timeout: 45000 }, async (t) => {
  const chromePath = findChrome();
  if (!chromePath || typeof WebSocket !== 'function') {
    t.skip('Chrome or WebSocket is not available for node-canvas adapter smoke');
    return;
  }

  const server = await createStaticServer();
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'symbiote-ui-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--disable-background-networking',
    '--disable-gpu',
    '--disable-sync',
    '--hide-scrollbars',
    '--no-default-browser-check',
    '--no-first-run',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let page;
  try {
    const endpoint = await withTimeout(waitForChromeEndpoint(chrome), 12000, 'Chrome DevTools endpoint');
    page = await withTimeout(
      openPage(endpoint, `${server.url}/demo/cascade-theme-lab.html?v=node-canvas-model-adapter#graph`),
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
    if (!chrome.killed) chrome.kill('SIGTERM');
    await server.close();
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
