import { parseHTML } from 'linkedom';

const FAKE_FOCUSABLE_TAGS = new Set(['input', 'textarea', 'select', 'button', 'a']);

class FakeCanvasRenderingContext2D {
  constructor(options = {}) {
    this.onDrawElementImage = options.onDrawElementImage || null;
    this.drawFails = options.drawFails || null;
  }

  arc() {}

  arcTo() {}

  beginPath() {}

  clearRect() {}

  closePath() {}

  fill() {}

  fillText() {}

  lineTo() {}

  measureText(value) {
    return { width: String(value || '').length * 8 };
  }

  moveTo() {}

  restore() {}

  rotate() {}

  save() {}

  scale() {}

  stroke() {}

  strokeRect() {}

  translate() {}

  drawElementImage(...args) {
    this.onDrawElementImage?.(args);
    if (this.drawFails?.()) {
      let error = new Error('fake draw failure');
      error.name = 'InvalidStateError';
      throw error;
    }
    return null;
  }
}

class FakeOffscreenCanvas {
  constructor(width = 0, height = 0) {
    this.width = width;
    this.height = height;
    this.context = new FakeCanvasRenderingContext2D();
  }

  getContext(kind) {
    return kind === '2d' ? this.context : null;
  }
}

export function installFakeCanvas2DGlobal() {
  Object.defineProperty(globalThis, 'OffscreenCanvas', {
    configurable: true,
    writable: true,
    value: FakeOffscreenCanvas,
  });
}

export function createFakeXrPlatform(options = {}) {
  let mode = options.mode ?? 'webgl';
  let { document, window } = parseHTML('<html><head></head><body></body></html>');
  let uploadCalls = [];
  let drawCalls = [];
  let mutationObservers = new Set();

  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.target = null;
      mutationObservers.add(this);
    }

    observe(target) {
      this.target = target;
    }

    disconnect() {
      this.target = null;
      mutationObservers.delete(this);
    }
  }

  let platformState = {
    drawFails: options.drawFails === true,
    activeElement: null,
    selection: null,
  };

  installFakeCanvas2DGlobal();

  function createCanvas2DContext() {
    return new FakeCanvasRenderingContext2D({
      onDrawElementImage: (args) => drawCalls.push(args),
      drawFails: () => platformState.drawFails,
    });
  }

  function isFakeFocusable(element) {
    let tagName = String(element?.tagName || '').toLowerCase();
    return FAKE_FOCUSABLE_TAGS.has(tagName)
      || element?.hasAttribute?.('tabindex') === true
      || element?.isContentEditable === true
      || element?.getAttribute?.('contenteditable') === 'true';
  }

  function patchElementDomBehaviors(element) {
    let nativeFocus = typeof element.focus === 'function' ? element.focus.bind(element) : null;
    element.focus = () => {
      if (isFakeFocusable(element)) platformState.activeElement = element;
      nativeFocus?.();
    };
    let nativeBlur = typeof element.blur === 'function' ? element.blur.bind(element) : null;
    element.blur = () => {
      if (platformState.activeElement === element) platformState.activeElement = null;
      nativeBlur?.();
    };
    if (!Number.isFinite(Number(element.scrollTop))) element.scrollTop = 0;
    if (!Number.isFinite(Number(element.scrollLeft))) element.scrollLeft = 0;
    element.scrollBy = function scrollBy(left, top) {
      let deltaX = typeof left === 'object' && left !== null ? Number(left.left) || 0 : Number(left) || 0;
      let deltaY = typeof left === 'object' && left !== null ? Number(left.top) || 0 : Number(top) || 0;
      element.scrollLeft = Math.max(0, (Number(element.scrollLeft) || 0) + deltaX);
      element.scrollTop = Math.max(0, (Number(element.scrollTop) || 0) + deltaY);
    };
    return element;
  }

  function createPlatformSelectionSnapshot() {
    let selection = platformState.selection;
    return {
      anchorOffset: selection?.anchorOffset ?? 0,
      focusOffset: selection?.focusOffset ?? 0,
      rangeCount: selection?.rangeCount ?? (selection?.text ? 1 : 0),
      toString() {
        return selection?.text || '';
      },
    };
  }

  class FakeWebGLRenderingContext {
    texElementImage2D(...args) {
      uploadCalls.push(args);
      if (options.uploadFails) {
        let error = new Error('fake upload failure');
        error.name = 'InvalidStateError';
        throw error;
      }
      return undefined;
    }
  }

  let nativeCreateElement = document.createElement.bind(document);
  let documentProxy = Object.create(document, {
    createElement: {
      value(tagName) {
        let element = patchElementDomBehaviors(nativeCreateElement(tagName));
        if (String(tagName).toLowerCase() === 'canvas') {
          element.layoutSubtree = '';
          element.paintRequests = 0;
          element.requestPaint = () => {
            element.paintRequests += 1;
          };
          element.getContext = (kind) => (
            kind === '2d' && mode === 'canvas2d' ? createCanvas2DContext() : null
          );
        }
        return element;
      },
    },
    activeElement: {
      get() {
        return platformState.activeElement || document.body;
      },
    },
    getSelection: options.selectionApi === false
      ? { value: undefined }
      : { value: () => createPlatformSelectionSnapshot() },
  });

  let fakeGlobal = {
    document: documentProxy,
    isSecureContext: true,
    HTMLCanvasElement: window.HTMLCanvasElement,
    HTMLElement: window.HTMLElement,
    Element: window.Element,
    Document: window.Document,
    customElements: window.customElements,
    CustomEvent: window.CustomEvent,
    PointerEvent: window.PointerEvent,
    MutationObserver: FakeMutationObserver,
  };
  if (mode === 'webgl') fakeGlobal.WebGLRenderingContext = FakeWebGLRenderingContext;
  if (mode === 'canvas2d') fakeGlobal.CanvasRenderingContext2D = FakeCanvasRenderingContext2D;

  return {
    document: documentProxy,
    nativeDocument: document,
    window,
    globalThis: fakeGlobal,
    uploadCalls,
    drawCalls,
    setDrawFails(flag) {
      platformState.drawFails = flag === true;
    },
    triggerMutation(element) {
      let triggered = 0;
      for (let observer of mutationObservers) {
        if (observer.target === element || observer.target?.contains?.(element)) {
          observer.callback([{ type: 'childList', target: element }], observer);
          triggered += 1;
        }
      }
      return triggered;
    },
    simulateTextSelection(selection = {}) {
      platformState.selection = selection && selection.text != null
        ? {
          text: String(selection.text),
          anchorOffset: Number(selection.anchorOffset) || 0,
          focusOffset: Number(selection.focusOffset) || 0,
          rangeCount: Number.isInteger(selection.rangeCount) ? selection.rangeCount : 1,
        }
        : null;
    },
  };
}

class FakeVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  copy(source) {
    this.x = source.x;
    this.y = source.y;
    this.z = source.z;
    return this;
  }

  clone() {
    return new FakeVector3(this.x, this.y, this.z);
  }
}

class FakeEuler {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
}

class FakeColor {
  constructor(value = 0xffffff) {
    this.value = value;
  }

  setHex(value) {
    this.value = value;
    return this;
  }
}

class FakeObject3D {
  constructor() {
    this.children = [];
    this.parent = null;
    this.position = new FakeVector3();
    this.rotation = new FakeEuler();
    this.scale = new FakeVector3(1, 1, 1);
    this.userData = {};
    this.visible = true;
    this.name = '';
  }

  add(...objects) {
    for (let object of objects) {
      if (!object || this.children.includes(object)) continue;
      if (object.parent) object.parent.remove(object);
      object.parent = this;
      this.children.push(object);
    }
    return this;
  }

  remove(...objects) {
    for (let object of objects) {
      let index = this.children.indexOf(object);
      if (index >= 0) {
        this.children.splice(index, 1);
        object.parent = null;
      }
    }
    return this;
  }

  traverse(callback) {
    callback(this);
    for (let child of [...this.children]) child.traverse?.(callback);
  }
}

class FakeScene extends FakeObject3D {
  constructor() {
    super();
    this.isScene = true;
  }
}

class FakeGroup extends FakeObject3D {
  constructor() {
    super();
    this.isGroup = true;
  }
}

class FakePlaneGeometry {
  constructor(width = 1, height = 1) {
    this.parameters = { width, height };
    this.disposed = false;
  }

  dispose() {
    this.disposed = true;
  }
}

class FakeMaterial {
  constructor(options = {}) {
    Object.assign(this, options);
    this.color = new FakeColor(options.color);
    this.map = options.map || null;
    this.needsUpdate = false;
  }

  dispose() {
    this.disposed = true;
  }
}

class FakeMesh extends FakeObject3D {
  constructor(geometry, material) {
    super();
    this.isMesh = true;
    this.geometry = geometry || new FakePlaneGeometry();
    this.material = material || new FakeMaterial();
  }
}

let _fakeTextureUuidCounter = 0;

class FakeTexture {
  constructor(source) {
    this.isTexture = true;
    this.uuid = `fake-tex-uuid-${++_fakeTextureUuidCounter}`;
    this.image = source;
    this.needsUpdate = false;
    this.disposed = false;
    this.name = '';
  }

  dispose() {
    this.disposed = true;
  }
}

export class FakeCanvasTexture extends FakeTexture {
  constructor(canvas) {
    super(canvas);
    this.isCanvasTexture = true;
  }
}

class FakeHTMLTexture extends FakeTexture {
  constructor(element) {
    if (FakeHTMLTexture.fails) {
      let error = new Error('fake HTMLTexture failure');
      error.name = 'InvalidStateError';
      throw error;
    }
    super(element);
    this.isHTMLTexture = true;
  }
}
FakeHTMLTexture.fails = false;

class FakeRaycaster {
  constructor() {
    this.ray = { origin: new FakeVector3(), direction: new FakeVector3(0, 0, -1) };
    this.intersectObjects = () => [];
  }
}

class FakePerspectiveCamera extends FakeObject3D {
  constructor() {
    super();
    this.isPerspectiveCamera = true;
    this.aspect = 1;
  }

  updateProjectionMatrix() {}
}

class FakeWebGLRenderer {
  constructor() {
    this.xr = { enabled: false };
    this.domElement = null;
  }

  setPixelRatio() {}

  setSize() {}

  setAnimationLoop() {}

  dispose() {}
}

export function createFakeThree() {
  FakeHTMLTexture.fails = false;
  return {
    REVISION: '0-test',
    Scene: FakeScene,
    Group: FakeGroup,
    Mesh: FakeMesh,
    PlaneGeometry: FakePlaneGeometry,
    MeshStandardMaterial: FakeMaterial,
    MeshBasicMaterial: FakeMaterial,
    CanvasTexture: FakeCanvasTexture,
    HTMLTexture: FakeHTMLTexture,
    Raycaster: FakeRaycaster,
    Vector3: FakeVector3,
    PerspectiveCamera: FakePerspectiveCamera,
    WebGLRenderer: FakeWebGLRenderer,
    LinearFilter: 1006,
    SRGBColorSpace: 'srgb',
  };
}

export function failFakeHtmlTexture() {
  FakeHTMLTexture.fails = true;
}

export function createLayoutDescriptor(overrides = {}) {
  return {
    layoutId: 'layout-alpha',
    contentKind: 'dom',
    title: 'Alpha window',
    pose: { position: [0, 1.35, -1.6], rotation: [0, 0, 0] },
    sizeMeters: [0.8, 0.45],
    viewport: { width: 1280, height: 720 },
    contentRevision: 1,
    themeRevision: 1,
    ...overrides,
  };
}

export function createWindowContentElement(document, options = {}) {
  let element = document.createElement('section');
  element.className = 'fake-window-content';
  let input = document.createElement('input');
  input.value = options.draft || '';
  input.setAttribute('type', 'text');
  input.setAttribute('id', 'draft-input');
  input.setAttribute('data-xr-target-id', 'draft-input');
  let scroller = document.createElement('div');
  scroller.className = 'fake-scroll-region';
  scroller.setAttribute('data-xr-scroll', '');
  scroller.setAttribute('id', 'scroll-region');
  scroller.setAttribute('data-xr-target-id', 'scroll-region');
  scroller.textContent = options.text || 'window content';
  element.append(input, scroller);
  return element;
}

function deepFreeze(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Object.isFrozen(obj)) {
    return obj;
  }
  let propNames = Reflect.ownKeys(obj);
  for (let name of propNames) {
    let value = obj[name];
    if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
      deepFreeze(value);
    }
  }
  return Object.freeze(obj);
}

export function createFakeBatchBridge(options = {}) {
  let prepareCount = 0;
  let commitCount = 0;
  let rollbackCount = 0;
  let inspectCount = 0;
  let finalizeCount = 0;

  let transactionResources = new Map();
  let tokenCounter = 0;
  let records = new Map();

  return {
    getCounts() {
      return { prepareCount, commitCount, rollbackCount, inspectCount, finalizeCount };
    },
    getRegistryCount() {
      return transactionResources.size;
    },
    get registryCount() {
      return transactionResources.size;
    },
    prepareBatch(items, batchOptions = {}) {
      prepareCount++;
      if (options.prepareFails || (options.shouldFail && options.shouldFail('prepare', items))) {
        return { ok: false, reason: options.prepareFailReason || 'simulated-prepare-failure' };
      }
      let itemResources = [];
      let token = `fake-bridge-tx-token-${++tokenCounter}`;

      for (let item of items) {
        let { windowId, mesh, panel, element, canvas, snapshot } = item;

        let priorMap = mesh?.material ? mesh.material.map : null;
        let priorColorHex = mesh?.material && mesh.material.color
          ? (typeof mesh.material.color.getHex === 'function' ? mesh.material.color.getHex() : null)
          : null;
        let priorOpacity = mesh?.material ? mesh.material.opacity : 1;
        let priorTransparent = mesh?.material ? mesh.material.transparent : false;
        let priorNeedsUpdate = mesh?.material ? mesh.material.needsUpdate : false;
        let priorVisible = mesh ? mesh.visible : false;
        let priorSnapshotDigest = mesh?.userData?.snapshotDigest || null;

        let recordOk = true;
        let recordReason = null;
        let recordStage = options.stage ?? 'canvas-to-texture-reused';

        if (options.failWindowId === windowId) {
          recordOk = false;
          recordReason = 'simulated-window-failure';
        }

        let record = {
          ok: recordOk,
          panelId: panel.id,
          stage: recordStage,
          strictRequired: true,
          textureApplied: recordOk,
          reason: recordReason,
        };

        itemResources.push({
          windowId,
          mesh,
          panel,
          element,
          canvas,
          snapshot,
          snapshotDigest: item.snapshotDigest || '',
          candidateTexture: 'mock-tex-' + panel.id,
          candidateRecord: record,
          prior: {
            map: priorMap,
            colorHex: priorColorHex,
            opacity: priorOpacity,
            transparent: priorTransparent,
            needsUpdate: priorNeedsUpdate,
            visible: priorVisible,
            snapshotDigest: priorSnapshotDigest,
            record: records.get(panel.id) || null,
          }
        });
      }

      transactionResources.set(token, itemResources);

      let ok = itemResources.every(it => it.candidateRecord.ok);
      let tx = {
        version: 'xr-spatial-batch-tx-v18',
        token,
        itemIds: items.map(it => it.windowId),
        digests: items.map(it => it.snapshotDigest || '')
      };

      if (!ok) {
        tx.ok = false;
        tx.reason = 'simulated-item-failure';
      }

      return deepFreeze(tx);
    },
    commitBatch(tx) {
      commitCount++;
      if (options.commitFails || (options.shouldFail && options.shouldFail('commit', tx))) {
        return { ok: false, reason: 'simulated-commit-failure' };
      }
      let resources = transactionResources.get(tx.token);
      if (!resources) {
        return { ok: false, reason: 'transaction-not-found' };
      }
      for (let i = 0; i < resources.length; i++) {
        let res = resources[i];
        let mesh = res.mesh;
        let record = res.candidateRecord;
        if (mesh) {
          if (mesh.material) {
            mesh.material.map = res.candidateTexture;
            if (mesh.material.color && typeof mesh.material.color.setHex === 'function') {
              mesh.material.color.setHex(0xffffff);
            }
            mesh.material.needsUpdate = true;
          }
          mesh.userData ||= {};
          mesh.userData.snapshotDigest = res.snapshotDigest;
          mesh.userData.textureSource = record.summary;
          mesh.userData.textureBridge = {
            ok: record.ok,
            stage: record.stage,
            strictRequired: record.strictRequired,
            textureApplied: record.textureApplied,
            reason: record.reason,
          };
        }
        records.set(res.panel.id, record);
      }
      return { ok: true };
    },
    inspectBatch(tx) {
      inspectCount++;
      if (options.inspectFails || (options.shouldFail && options.shouldFail('inspect', tx))) {
        return { ok: false, reason: 'simulated-inspect-failure' };
      }
      let resources = transactionResources.get(tx.token);
      if (!resources) {
        return { ok: false, reason: 'transaction-not-found' };
      }

      let observations = new Map();
      for (let res of resources) {
        let { panel, mesh, snapshot, candidateTexture, snapshotDigest, candidateRecord } = res;
        let colorVal = null;
        if (mesh?.material?.color) {
          colorVal = typeof mesh.material.color.getHex === 'function'
            ? mesh.material.color.getHex()
            : (typeof mesh.material.color.value === 'number' ? mesh.material.color.value : null);
        }

        let cand = {
          textureId: candidateTexture,
          colorHex: 0xffffff,
          opacity: snapshot?.material?.opacity ?? 1,
          transparent: snapshot?.material?.transparent ?? false,
          snapshotDigest: snapshotDigest,
          record: candidateRecord,
          samplerParams: {
            wrapS: 1004,
            wrapT: 1004,
            minFilter: 9987,
            magFilter: 9987,
          }
        };

        observations.set(panel.id, {
          ok: !options.failInspection,
          materialId: mesh?.material?.uuid || null,
          textureId: mesh?.material?.map || null,
          mapId: mesh?.material?.map || null,
          color: colorVal,
          opacity: mesh?.material?.opacity ?? 1,
          transparent: mesh?.material?.transparent ?? false,
          dimensions: mesh.geometry ? [mesh.geometry.parameters.width, mesh.geometry.parameters.height] : [0, 0],
          samplerParams: {
            wrapS: 1004,
            wrapT: 1004,
            minFilter: 9987,
            magFilter: 9987,
          },
          snapshotDigest: snapshotDigest || mesh?.userData?.snapshotDigest || '',
          candidate: cand,
          panel,
        });
      }
      return { ok: true, observations };
    },
    rollbackBatch(tx) {
      rollbackCount++;
      if (options.rollbackFails) {
        if (tx && tx.token) {
          transactionResources.delete(tx.token);
        }
        return { ok: false, errors: [new Error('simulated-rollback-failure')] };
      }
      if (!tx || !tx.token) {
        return { ok: false, errors: [new Error('missing-transaction-token')] };
      }
      let resources = transactionResources.get(tx.token);
      if (!resources) {
        return { ok: false, errors: [new Error('transaction-not-found')] };
      }
      try {
        for (let i = resources.length - 1; i >= 0; i--) {
          let res = resources[i];
          let mesh = res.mesh;
          let prior = res.prior;
          if (mesh) {
            mesh.visible = prior.visible;
            if (mesh.userData) {
              mesh.userData.snapshotDigest = prior.snapshotDigest;
            }
          }
          if (prior.record) {
            records.set(res.panel.id, prior.record);
          } else {
            records.delete(res.panel.id);
          }
        }
      } finally {
        transactionResources.delete(tx.token);
      }
      return { ok: true };
    },
    finalizeBatch(tx) {
      finalizeCount++;
      if (options.finalizeFails) {
        return { ok: false, reason: 'simulated-finalize-failure' };
      }
      transactionResources.delete(tx.token);
      return { ok: true };
    }
  };
}
