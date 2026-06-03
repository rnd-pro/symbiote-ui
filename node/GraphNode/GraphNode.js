/**
 * GraphNode — visual node card component
 *
 * Renders node header, input/output ports with sockets,
 * and embedded controls. Receives data via _nodeData property.
 *
 * @module symbiote-node/components/GraphNode
 */

import Symbiote from '@symbiotejs/symbiote';
import { ensureMaterialSymbols } from '../../icons/MaterialSymbols.js';
import { template } from './GraphNode.tpl.js';
import { styles } from './GraphNode.css.js';
import '../PortItem/PortItem.js';
import '../CtrlItem/CtrlItem.js';

/** @type {Object<string, string>} */
const CATEGORY_ICONS = {
  server: 'dns',
  instance: 'memory',
  control: 'tune',
  data: 'database',

  directory: 'folder',
  file: 'description',
  function: 'functions',
  class: 'class',
  module: 'package_2',
  default: 'radio_button_checked',
};

function setOptionalAttribute(el, name, value) {
  if (value) {
    el.setAttribute(name, String(value));
  } else {
    el.removeAttribute(name);
  }
}

function normalizeNodeTone(value) {
  let tone = String(value || '').trim().toLowerCase();
  if (tone === 'inverted') return 'inverse';
  return tone;
}

export class GraphNode extends Symbiote {
  destructionDelay = 200;

  init$ = {
    '@node-label': '',
    '@node-category': 'default',
    nodeLabel: '',
    nodeIcon: 'radio_button_checked',
    mediaSrc: '',
    mediaAlt: '',
    summary: '',
    href: '',
    linkLabel: 'Open',
    linkIcon: 'arrow_forward',
    hasItems: false,
    itemsList: [],
    inputPorts: [],
    outputPorts: [],
    controlsList: [],
  };

  renderCallback() {
    ensureMaterialSymbols(Object.values(CATEGORY_ICONS));

    this.sub('@node-label', (val) => {
      this.$.nodeLabel = val || '';
    });
    this.sub('@node-category', (val) => {
      this.$.nodeIcon = CATEGORY_ICONS[val] || CATEGORY_ICONS.default;
      ensureMaterialSymbols([this.$.nodeIcon]);
    });


    if (this._nodeData) {
      this.#populateFromNodeData(this._nodeData);
    }
  }

  #syncMedia() {
    let src = this.$.mediaSrc;
    if (src && this.ref.mediaImage) {
      this.ref.mediaImage.src = src;
      this.ref.mediaImage.alt = this.$.mediaAlt || '';
      this.ref.mediaImage.draggable = false;
    }
    this.toggleAttribute('data-has-media', Boolean(src));
  }

  #syncLink() {
    let href = this.$.href;
    if (!this.ref.contentLink) return;
    if (!href) {
      this.ref.contentLink.removeAttribute('href');
      return;
    }
    this.ref.contentLink.href = href;
    if (href.startsWith('http://') || href.startsWith('https://')) {
      this.ref.contentLink.target = '_blank';
      this.ref.contentLink.rel = 'noopener noreferrer';
      this.$.linkIcon = 'open_in_new';
    } else {
      this.ref.contentLink.removeAttribute('target');
      this.ref.contentLink.removeAttribute('rel');
      this.$.linkIcon = 'arrow_forward';
    }
    ensureMaterialSymbols([this.$.linkIcon]);
  }

  /**
   * Populate ports and controls from Node instance
   * @param {import('../core/Node.js').Node} node
   */
  #populateFromNodeData(node) {
    let params = node.params || {};
    let contentHidden = Boolean(params.hideContent || params.contentHidden);
    this.toggleAttribute('data-header-hidden', Boolean(params.hideHeader || params.headerHidden));
    this.toggleAttribute('data-content-hidden', contentHidden);
    setOptionalAttribute(this, 'data-node-tone', normalizeNodeTone(params.tone || params.nodeTone));
    this.set$({
      nodeIcon: node.icon || CATEGORY_ICONS[node.category] || CATEGORY_ICONS.default,
      mediaSrc: params.media || params.image || params.avatar || '',
      mediaAlt: params.mediaAlt || params.imageAlt || params.avatarAlt || node.label || '',
      summary: contentHidden ? '' : params.summary || '',
      href: params.href || '',
      linkLabel: params.linkLabel || 'Open',
      hasItems: !contentHidden && Array.isArray(params.items) && params.items.length > 0,
      itemsList: !contentHidden && Array.isArray(params.items)
        ? params.items.map((item) => ({
            href: item.href || '#',
            target: item.external ? '_blank' : '',
            rel: item.external ? 'noopener noreferrer' : '',
            kicker: item.kicker || '',
            title: item.title || '',
            summary: item.summary || '',
          }))
        : [],
      inputPorts: Object.entries(node.inputs).map(([key, input]) => ({
        key,
        label: input.label || key,
        socketColor: input.socket?.color || 'var(--sn-node-accent)',
        socketName: input.socket?.name || 'any',
        side: 'input',
      })),
      outputPorts: Object.entries(node.outputs).map(([key, output]) => ({
        key,
        label: output.label || key,
        socketColor: output.socket?.color || 'var(--sn-node-accent)',
        socketName: output.socket?.name || 'any',
        side: 'output',
      })),
      controlsList: Object.entries(node.controls).map(([key, ctrl]) => ({
        key,
        label: key,
        inputType: ctrl.type || 'text',
        value: ctrl.value !== undefined ? String(ctrl.value) : '',
        isReadonly: ctrl.readonly || false,
      })),
    });
    ensureMaterialSymbols([this.$.nodeIcon]);
    this.#syncMedia();
    this.#syncLink();
  }
}

GraphNode.template = template;
GraphNode.rootStyles = styles;

GraphNode.reg('graph-node');
