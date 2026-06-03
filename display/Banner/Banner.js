import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import template from './Banner.tpl.js';
import css from './Banner.css.js';

export class StatusBanner extends Symbiote {
  constructor() {
    super();
    this.templateProcessors.add(slotProcessor);
  }
}

StatusBanner.template = template;
StatusBanner.rootStyles = css;
StatusBanner.reg('sn-banner');

export default StatusBanner;
