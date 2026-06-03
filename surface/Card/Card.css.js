export default /*css*/ `
sn-card {
  display: block;
  box-sizing: border-box;
  min-width: 0;
  padding: var(--sn-card-padding);
  margin-block-end: var(--sn-card-margin-block-end);
  border: 1px solid var(--sn-card-border);
  border-radius: var(--sn-card-radius);
  background: var(--sn-card-bg);
  color: var(--sn-text);
  font-family: var(--sn-font);
}

sn-card[hidden] {
  display: none !important;
}

sn-card[interactive] {
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
}

sn-card[interactive]:hover {
  border-color: var(--sn-card-hover-border);
  background: var(--sn-card-hover-bg);
}

sn-card[variant="flat"] {
  padding: 0;
  margin-block-end: 0;
  border-color: transparent;
  background: transparent;
}

sn-card[variant="panel"] {
  background: var(--sn-panel-bg);
}

sn-card [slot="title"],
sn-card .sn-card-title {
  display: block;
  margin-block-end: var(--sn-card-title-margin-block-end);
  color: var(--sn-card-title-color);
  font-size: var(--sn-card-title-size);
  font-weight: var(--sn-card-title-weight);
  text-transform: uppercase;
}

sn-card [slot="footer"] {
  display: flex;
  gap: var(--sn-card-footer-gap);
  margin-block-start: var(--sn-card-footer-margin-block-start);
  padding-block-start: var(--sn-card-footer-padding-block-start);
  border-block-start: 1px solid var(--sn-card-border);
}
`;
