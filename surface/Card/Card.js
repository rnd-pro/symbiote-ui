import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import template from './Card.tpl.js';
import css from './Card.css.js';

export class SurfaceCard extends Symbiote {
  constructor() {
    super();
    this.templateProcessors.add(slotProcessor);
  }
}

SurfaceCard.template = template;
SurfaceCard.rootStyles = css;
SurfaceCard.reg('sn-card');

export default SurfaceCard;
