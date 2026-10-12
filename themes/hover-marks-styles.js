/**
 * Hover corner marks — the RND brand hover affordance: 8 corner marks
 * (12px legs, 2px stroke) drawn with linear-gradients, colored by
 * currentColor. No blur, no chroma.
 *
 * Two exports for two consumers:
 *  - `hoverMarksBackgroundImage`: the `background-image` value a theme writes
 *    into `--sn-button-hover-marks` so provider controls render marks on hover.
 *  - `hoverMarksStyles`: the full declaration fragment for generator-consumers
 *    composing their own hover rules.
 *
 * Node-safe: pure strings, no DOM.
 *
 * @module symbiote-ui/themes/hover-marks-styles
 */

const MARK_SIZE = 'var(--sn-hover-mark-size, 12px)';
const MARK_THICKNESS = 'var(--sn-hover-mark-thickness, 2px)';
const MARK_COLOR = 'var(--sn-hover-mark-color, currentColor)';

function mark(direction) {
  return `linear-gradient(${direction}, ${MARK_COLOR} ${MARK_THICKNESS}, transparent ${MARK_THICKNESS})`;
}

/** @returns {string} `background-image` value with the 8 corner marks */
export let hoverMarksBackgroundImage = [
  mark('to right'),
  mark('to right'),
  mark('to left'),
  mark('to left'),
  mark('to bottom'),
  mark('to bottom'),
  mark('to top'),
  mark('to top'),
].join(', ');

/** @returns {string} CSS declarations painting the 8 corner marks */
export let hoverMarksStyles = `
  color: ${MARK_COLOR};
  background-image: ${hoverMarksBackgroundImage};
  background-position: 0 0, 0 100%, 100% 0, 100% 100%, 0 0, 100% 0, 0 100%, 100% 100%;
  background-repeat: no-repeat;
  background-size: ${MARK_SIZE} ${MARK_SIZE};
`;
