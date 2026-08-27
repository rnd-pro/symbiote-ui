export const MEANINGFUL_SHOW_INTERACTION_TYPES = Object.freeze([
  'click',
  'input',
  'change',
  'submit',
  'keydown',
]);

const MEANINGFUL_TYPES = new Set(MEANINGFUL_SHOW_INTERACTION_TYPES);

export function isMeaningfulShowInteraction(event, options = {}) {
  if (!event || !MEANINGFUL_TYPES.has(String(event.type || ''))) return false;
  if (options.allowSynthetic !== true && event.isTrusted !== true) return false;
  if (event.type === 'keydown') {
    if (event.repeat || event.isComposing) return false;
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(event.key)) return false;
  }
  if (event.type === 'click' && Number(event.button || 0) !== 0) return false;
  return typeof options.accept === 'function' ? options.accept(event) !== false : true;
}

export function monitorMeaningfulShowInteractions(target, options = {}) {
  if (!target?.addEventListener) return Object.freeze({ dispose() {} });
  let disposed = false;
  let onEvent = (event) => {
    if (disposed || !isMeaningfulShowInteraction(event, options)) return;
    options.pause?.({ reason: 'meaningful-interaction', eventType: event.type, event });
    options.onInteraction?.(event);
  };
  for (let type of MEANINGFUL_SHOW_INTERACTION_TYPES) target.addEventListener(type, onEvent, true);
  let dispose = () => {
    if (disposed) return;
    disposed = true;
    for (let type of MEANINGFUL_SHOW_INTERACTION_TYPES) target.removeEventListener(type, onEvent, true);
  };
  options.signal?.addEventListener?.('abort', dispose, { once: true });
  return Object.freeze({ dispose });
}
