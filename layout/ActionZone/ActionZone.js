/**
 * @fileoverview ActionZone - Corner widget for split/join gestures
 * Inspired by Blender's AZONE_AREA implementation.
 *
 * Triangular hit area at panel corners:
 * - Drag inward (mouse stays inside panel) → split panel
 * - Drag outward (mouse exits panel) → join panels
 */

import Symbiote from '@symbiotejs/symbiote';
import { template } from './ActionZone.tpl.js';
import { styles } from './ActionZone.css.js';

/**
 * Minimum drag distance before gesture is recognized
 */
const DRAG_THRESHOLD = 15;

export class ActionZone extends Symbiote {
  static isoMode = true;

  init$ = {

    '@corner': 'tl',


    panelId: '',


    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    gestureType: null,


    panelBounds: null,
  };

  renderCallback() {

    this.onpointerdown = (e) => this._onPointerDown(e);
    this.onpointermove = (e) => this._onPointerMove(e);
    this.onpointerup = (e) => this._onPointerUp(e);
    this.onpointercancel = (e) => this._onPointerUp(e);
    this.onlostpointercapture = (e) => this._onPointerUp(e);


    this._globalPointerUp = (e) => {
      if (this.$.isDragging) {
        this._onPointerUp(e);
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerup', this._globalPointerUp);
      document.addEventListener('pointercancel', this._globalPointerUp);
    }
  }

  disconnectedCallback() {
    if (this._globalPointerUp && typeof document !== 'undefined') {
      document.removeEventListener('pointerup', this._globalPointerUp);
      document.removeEventListener('pointercancel', this._globalPointerUp);
    }
  }

  /**
   * Start drag operation
   * @param {PointerEvent} e
   */
  _onPointerDown(e) {
    e.preventDefault();
    e.stopPropagation();


    let panelNode = this.closest('layout-node');
    if (panelNode) {
      let rect = panelNode.getBoundingClientRect();
      this.$.panelBounds = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    }

    this.$.isDragging = true;
    this.$.dragStartX = e.clientX;
    this.$.dragStartY = e.clientY;
    this.$.gestureType = null;

    this.setPointerCapture(e.pointerId);
    this.setAttribute('dragging', '');


    this.dispatchEvent(
      new CustomEvent('action-zone-start', {
        bubbles: true,
        composed: true,
        detail: { panelId: this.$.panelId, corner: this.$['@corner'] },
      })
    );
  }

  /**
   * Track drag and detect gesture
   * @param {PointerEvent} e
   */
  _onPointerMove(e) {
    if (!this.$.isDragging) return;

    let dx = e.clientX - this.$.dragStartX;
    let dy = e.clientY - this.$.dragStartY;
    let distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < DRAG_THRESHOLD) {
      this.$.gestureType = null;
      return;
    }


    let gesture = this._detectGesture(e.clientX, e.clientY, dx, dy);

    if (gesture !== this.$.gestureType) {
      this.$.gestureType = gesture;


      this.dispatchEvent(
        new CustomEvent('action-zone-gesture', {
          bubbles: true,
          composed: true,
          detail: {
            panelId: this.$.panelId,
            corner: this.$['@corner'],
            gesture: gesture,
            dx,
            dy,
          },
        })
      );
    }
  }

  /**
   * Complete or cancel gesture
   * @param {PointerEvent} e
   */
  _onPointerUp(e) {
    if (!this.$.isDragging) return;


    try {
      if (e?.pointerId !== undefined) {
        this.releasePointerCapture(e.pointerId);
      }
    } catch {

    }

    this.removeAttribute('dragging');

    let gesture = this.$.gestureType;

    if (gesture) {

      this.dispatchEvent(
        new CustomEvent('action-zone-execute', {
          bubbles: true,
          composed: true,
          detail: {
            panelId: this.$.panelId,
            corner: this.$['@corner'],
            gesture: gesture,
          },
        })
      );
    }


    this.$.isDragging = false;
    this.$.gestureType = null;
    this.$.panelBounds = null;


    this.dispatchEvent(
      new CustomEvent('action-zone-end', {
        bubbles: true,
        composed: true,
        detail: { panelId: this.$.panelId },
      })
    );
  }

  /**
   * Detect gesture type based on mouse position relative to panel bounds
   * @param {number} mouseX
   * @param {number} mouseY
   * @param {number} dx
   * @param {number} dy
   * @returns {'split-h' | 'split-v' | 'join' | null}
   */
  _detectGesture(mouseX, mouseY, dx, dy) {
    let bounds = this.$.panelBounds;

    if (!bounds) {
      return this._detectGestureByDirection(dx, dy);
    }

    let isOutside =
      mouseX < bounds.left ||
      mouseX > bounds.right ||
      mouseY < bounds.top ||
      mouseY > bounds.bottom;

    if (isOutside) {
      return 'join';
    }

    return this._detectGestureByDirection(dx, dy);
  }

  /**
   * Detect gesture purely by drag direction
   * @param {number} dx
   * @param {number} dy
   * @returns {'split-h' | 'split-v' | 'join' | null}
   */
  _detectGestureByDirection(dx, dy) {
    let corner = this.$['@corner'];
    let absDx = Math.abs(dx);
    let absDy = Math.abs(dy);
    let isHorizontal = absDx > absDy;

    let isInward = false;

    switch (corner) {
      case 'tl':
        isInward = (isHorizontal && dx > 0) || (!isHorizontal && dy > 0);
        break;
      case 'tr':
        isInward = (isHorizontal && dx < 0) || (!isHorizontal && dy > 0);
        break;
      case 'bl':
        isInward = (isHorizontal && dx > 0) || (!isHorizontal && dy < 0);
        break;
      case 'br':
        isInward = (isHorizontal && dx < 0) || (!isHorizontal && dy < 0);
        break;
    }

    if (isInward) {
      return isHorizontal ? 'split-h' : 'split-v';
    } else {
      return 'join';
    }
  }
}

ActionZone.template = template;
ActionZone.rootStyles = styles;

ActionZone.reg('action-zone');
