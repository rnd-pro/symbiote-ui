export default /*css*/ `
sn-carousel {
  display: block;
  font-family: var(--sn-font, sans-serif);
  width: 100%;
  box-sizing: border-box;
}

.sn-carousel-container {
  position: relative;
  width: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.sn-carousel-viewport {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  width: 100%;
  height: 100%;
  scrollbar-width: none;
}

.sn-carousel-viewport::-webkit-scrollbar {
  display: none;
}

.sn-carousel-viewport > ::slotted(*) {
  flex: 0 0 100%;
  width: 100%;
  scroll-snap-align: start;
}

.sn-carousel-nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background-color: var(--sn-panel-bg, #1e1e24);
  border: 1px solid var(--sn-outline-color-soft, rgba(255,255,255,0.08));
  color: var(--sn-text);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  transition: opacity var(--sn-transition-fast, 120ms);
}

.sn-carousel-nav-btn:hover {
  background: var(--sn-node-hover, rgba(255,255,255,0.05));
  border-color: var(--sn-node-selected, #2e90fa);
}

.sn-carousel-nav-prev {
  left: 8px;
}

.sn-carousel-nav-next {
  right: 8px;
}

.sn-carousel-pagination {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
}

.sn-carousel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--sn-text-dim, rgba(255,255,255,0.25));
  cursor: pointer;
  padding: 0;
  border: none;
  transition: background-color var(--sn-transition-fast, 120ms);
}

.sn-carousel-dot[data-active] {
  background-color: var(--sn-node-selected, #2e90fa);
}
`;
