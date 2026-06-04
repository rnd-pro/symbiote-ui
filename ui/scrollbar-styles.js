export let themedScrollbarStyles = `
  scrollbar-color: var(--sn-scrollbar-thumb-hover, currentColor) transparent;
  scrollbar-width: thin;

  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    min-height: 36px;
    border: 3px solid transparent;
    border-radius: 999px;
    background: var(--sn-scrollbar-thumb, currentColor);
    background-clip: content-box;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--sn-scrollbar-thumb-hover, currentColor);
    background-clip: content-box;
  }

  &::-webkit-scrollbar-corner {
    background: transparent;
  }
`;

