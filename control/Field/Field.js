import Symbiote from '@symbiotejs/symbiote';
import { slotProcessor } from '@symbiotejs/symbiote/core/slotProcessor.js';
import template from './Field.tpl.js';
import css from './Field.css.js';

export class FormField extends Symbiote {
  constructor() {
    super();
    this.templateProcessors.add(slotProcessor);
  }
}

FormField.template = template;
FormField.rootStyles = css;
FormField.reg('sn-field');

export default FormField;
