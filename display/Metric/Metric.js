import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import template from './Metric.tpl.js';
import css from './Metric.css.js';

export class MetricItem extends Symbiote {
  constructor() {
    super();
    this.templateProcessors.add(slotProcessor);
  }
}

MetricItem.template = template;
MetricItem.rootStyles = css;
MetricItem.reg('sn-metric');

export default MetricItem;
