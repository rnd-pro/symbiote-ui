/**
 * @fileoverview LayoutPreview - Visual preview for split/join operations
 * Shows where the new panel will be created or which panel will be removed.
 */

import Symbiote from '@symbiotejs/symbiote';
import { template } from './LayoutPreview.tpl.js';
import { styles } from './LayoutPreview.css.js';

export class LayoutPreview extends Symbiote {
  static isoMode = true;

  init$ = {

    previewType: null,


    targetRect: null,


    visible: false,


    overlayStyle: '',
    lineStyle: '',
  };

  renderCallback() {
    this.sub('previewType', (type) => {
      if (type) {
        this.setAttribute('type', type);
      } else {
        this.removeAttribute('type');
      }
    });
  }

  /**
   * Show split preview
   * @param {'split-h' | 'split-v'} direction
   * @param {DOMRect} panelRect
   * @param {number} [ratio=0.5]
   */
  showSplit(direction, panelRect, ratio = 0.5) {
    this.$.previewType = direction;
    this.$.visible = true;

    if (direction === 'split-h') {

      let x = panelRect.left + panelRect.width * ratio;
      this.$.lineStyle = `
        left: ${x}px;
        top: ${panelRect.top}px;
        width: 4px;
        height: ${panelRect.height}px;
      `;
      this.$.overlayStyle = '';
    } else {

      let y = panelRect.top + panelRect.height * ratio;
      this.$.lineStyle = `
        left: ${panelRect.left}px;
        top: ${y}px;
        width: ${panelRect.width}px;
        height: 4px;
      `;
      this.$.overlayStyle = '';
    }
  }

  /**
   * Show join preview (overlay on target panel)
   * @param {DOMRect} targetRect - Panel that will be removed
   */
  showJoin(targetRect) {
    this.$.previewType = 'join';
    this.$.visible = true;

    this.$.overlayStyle = `
      left: ${targetRect.left}px;
      top: ${targetRect.top}px;
      width: ${targetRect.width}px;
      height: ${targetRect.height}px;
    `;
    this.$.lineStyle = '';
  }

  /**
   * Hide preview
   */
  hide() {
    this.$.visible = false;
    this.$.previewType = null;
    this.$.overlayStyle = '';
    this.$.lineStyle = '';
  }
}

LayoutPreview.template = template;
LayoutPreview.rootStyles = styles;

LayoutPreview.reg('layout-preview');
