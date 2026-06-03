export default `
  :host,
  canvas-graph {
    display: block;
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--sn-bg);
  }
  canvas-graph > canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
    outline: none;
    user-select: none;
    cursor: default;
  }
  canvas-graph > canvas.grabbing { cursor: grabbing; }
  canvas-graph > graph-breadcrumb {
    position: absolute;
    top: 16px;
    left: 16px;
    z-index: 10;
  }
`;
