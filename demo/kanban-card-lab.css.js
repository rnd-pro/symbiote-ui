const css = `
body {
  margin: 0;
  padding: var(--sn-space-lg);
  background: var(--sn-sys-surface-panel);
  color: var(--sn-sys-on-surface);
  font-family: var(--sn-font, sans-serif);
  min-height: 100vh;
}

.gallery {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--sn-step-9);
  max-width: 1600px;
  margin: 0 auto;
}

@media (max-width: 1320px) {
  .gallery {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .gallery {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .gallery {
    grid-template-columns: 1fr;
  }
}

.state-container {
  position: relative;
  display: flex;
  flex-direction: column;
  border: thin solid var(--sn-sys-outline);
  border-radius: var(--sn-radius-md);
  padding: var(--sn-space-sm);
  background: var(--sn-sys-surface);
  align-items: stretch;
  min-width: 0;
}

.state-container::before {
  content: attr(data-state-id-formatted);
  position: absolute;
  top: var(--sn-space-md);
  left: var(--sn-space-md);
  font-size: var(--sn-text-lg);
  color: var(--sn-sys-on-surface);
  font-weight: 500;
}

.state-container[data-size]::after {
  content: attr(data-size);
  position: absolute;
  top: var(--sn-space-md);
  right: var(--sn-space-md);
  font-size: var(--sn-text-sm);
  color: var(--sn-sys-on-surface-dim);
  border: thin solid var(--sn-sys-outline);
  background: transparent;
  padding: var(--sn-step-1) var(--sn-step-3);
  border-radius: var(--sn-radius-sm);
  font-weight: 500;
}

.state-container > sn-kanban-card {
  margin-top: calc(var(--sn-space-xl) + var(--sn-space-sm));
  min-width: 0;
}
`;

export default css;
