export default /*css*/ `
sn-scroll-area {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.sn-scroll-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.sn-scroll-viewport {
  width: 100%;
  height: 100%;
  overflow: scroll;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.sn-scroll-viewport::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.sn-scrollbar {
  position: absolute;
  background-color: transparent;
  user-select: none;
  transition: opacity var(--sn-transition-fast, 120ms);
  opacity: 0;
  z-index: 100;
}

.sn-scroll-container:hover .sn-scrollbar,
.sn-scrollbar[data-active] {
  opacity: 1;
}

.sn-scrollbar-vertical {
  top: var(--sn-step-1);
  right: var(--sn-step-1);
  bottom: var(--sn-step-1);
  width: 6px;
}

.sn-scrollbar-horizontal {
  left: var(--sn-step-1);
  bottom: var(--sn-step-1);
  right: var(--sn-step-1);
  height: 6px;
}

.sn-scrollbar-thumb {
  background-color: var(--sn-scrollbar-thumb, var(--sn-text-dim, rgba(255,255,255,0.2)));
  border-radius: 3px;
  cursor: pointer;
  position: absolute;
  top: 0;
  left: 0;
  transition: background-color var(--sn-transition-fast, 120ms);
}

.sn-scrollbar-thumb:hover,
.sn-scrollbar-thumb[data-active] {
  background-color: var(--sn-node-selected, #2e90fa);
}

.sn-scrollbar-vertical .sn-scrollbar-thumb {
  width: 100%;
}

.sn-scrollbar-horizontal .sn-scrollbar-thumb {
  height: 100%;
}
`;
