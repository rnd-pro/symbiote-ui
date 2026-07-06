const SCROLL_SHADOW_SIZE = 'var(--sn-scroll-shadow-size, 14px)';

function scrollFadeMask(direction) {
  return `linear-gradient(${direction}, transparent 0, #000 ${SCROLL_SHADOW_SIZE}, #000 calc(100% - ${SCROLL_SHADOW_SIZE}), transparent 100%)`;
}

export function themedScrollFadeStyles(axis = 'block') {
  let mask = axis === 'inline'
    ? scrollFadeMask('to right')
    : scrollFadeMask('to bottom');
  return `
  -webkit-mask-image: ${mask};
  mask-image: ${mask};
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-mode: alpha;
  mask-mode: alpha;
`;
}

export let themedScrollFadeBlockStyles = themedScrollFadeStyles('block');
export let themedScrollFadeInlineStyles = themedScrollFadeStyles('inline');
