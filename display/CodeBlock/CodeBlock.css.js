export default `
:host {
  display: block;
}

  code-block {
    display: block;
    height: 100%;
    overflow: hidden;
  }
  code-block .cb-scroll {
    display: flex;
    height: 100%;
    overflow: auto;
    align-items: stretch;
  }
  code-block .cb-gutter {
    position: sticky;
    left: 0;
    z-index: 1;
    margin: 0;
    padding: 12px 8px 12px 12px;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    text-align: right;
    color: var(--sn-text-dim);
    opacity: 0.45;
    background: var(--sn-bg);
    border-right: 1px solid var(--sn-node-border);
    user-select: none;
    white-space: pre;
    min-width: 32px;
    flex-shrink: 0;
  }
  code-block .cb-pre {
    margin: 0;
    padding: 12px;
    flex: 1;
    min-width: 0;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    color: var(--sn-text);
    tab-size: 2;
    white-space: pre;
    box-sizing: border-box;
  }
  /* Markdown container — hidden by default */
  code-block .cb-md {
    display: none;
    padding: 20px 28px;
    flex: 1;
    min-width: 0;
    overflow-wrap: break-word;
    word-wrap: break-word;
    line-height: 1.7;
    color: var(--sn-text);
    font-family: var(--sn-font);
    font-size: 14px;
  }
  /* Image container — hidden by default */
  code-block .cb-img-wrap {
    display: none;
    flex: 1;
    padding: 20px;
    justify-content: center;
    align-items: center;
    background: repeating-conic-gradient(var(--sn-warning-color) 0% 25%, var(--sn-bg) 0% 50%) 0 0 / 16px 16px;
  }
  code-block .cb-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 2px 12px var(--sn-bg-overlay);
  }
  /* In markdown mode: hide code, show md */
  code-block[mode-markdown] .cb-gutter { display: none; }
  code-block[mode-markdown] .cb-pre { display: none; }
  code-block[mode-markdown] .cb-md { display: block; }
  /* In image mode: hide code, show image */
  code-block[mode-image] .cb-gutter { display: none; }
  code-block[mode-image] .cb-pre { display: none; }
  code-block[mode-image] .cb-img-wrap { display: flex; }

  /* Markdown styles */
  code-block .md-h { margin: 20px 0 8px; color: var(--sn-text); font-weight: 700; }
  code-block h1.md-h { font-size: 24px; border-bottom: 2px solid var(--sn-node-border); padding-bottom: 8px; }
  code-block h2.md-h { font-size: 20px; border-bottom: 1px solid var(--sn-node-border); padding-bottom: 6px; }
  code-block h3.md-h { font-size: 16px; }
  code-block h4.md-h { font-size: 14px; }
  code-block .md-p { margin: 8px 0; }
  code-block .md-quote {
    margin: 8px 0;
    padding: 8px 16px;
    border-left: 4px solid var(--sn-cat-server);
    background: var(--sn-accent-bg-subtle);
    border-radius: 0 4px 4px 0;
    font-style: italic;
  }
  code-block .md-list {
    margin: 8px 0;
    padding-left: 24px;
  }
  code-block .md-list li {
    margin: 3px 0;
  }
  code-block .md-code-block {
    margin: 12px 0;
    padding: 12px 16px;
    background: var(--sn-bg);
    border: 1px solid var(--sn-node-border);
    border-radius: 6px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.6;
    overflow-x: auto;
    white-space: pre;
  }
  code-block .md-inline-code {
    padding: 1px 5px;
    background: var(--sn-node-hover);
    border-radius: 3px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.9em;
  }
  code-block .md-link {
    color: var(--sn-cat-server);
    text-decoration: underline;
    text-decoration-style: dotted;
  }
  code-block .md-link:hover { text-decoration-style: solid; }
  code-block .md-img {
    max-width: 100%;
    height: auto;
    border-radius: 6px;
    margin: 8px 0;
    border: 1px solid var(--sn-node-border);
    box-shadow: 0 2px 8px var(--sn-bg-overlay);
  }
  code-block .md-hr {
    border: none;
    border-top: 1px solid var(--sn-node-border);
    margin: 16px 0;
  }
  code-block .md-table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 13px;
  }
  code-block .md-table th,
  code-block .md-table td {
    padding: 6px 12px;
    border: 1px solid var(--sn-node-border);
    text-align: left;
  }
  code-block .md-table th {
    background: var(--sn-node-hover);
    font-weight: 600;
  }
  code-block .md-table tr:hover td {
    background: var(--sn-bg-overlay);
  }
  /* Token colors */
  code-block .t-kw   { color: var(--sn-syntax-keyword); }
  code-block .t-str  { color: var(--sn-syntax-string); }
  code-block .t-cm   { color: var(--sn-syntax-comment); font-style: italic; }
  code-block .t-fn   { color: var(--sn-syntax-function); }
  code-block .t-num  { color: var(--sn-syntax-number); }
  code-block .t-bi   { color: var(--sn-syntax-builtin); }
  code-block .t-prop { color: var(--sn-syntax-property); }
  code-block .t-lit  { color: var(--sn-syntax-literal); }
  /* JSDoc */
  code-block .t-jd   { color: var(--sn-syntax-doc); font-style: italic; }
  code-block .t-jd-tag  { color: var(--sn-syntax-doc-tag); font-style: normal; font-weight: 500; }
  code-block .t-jd-type { color: var(--sn-syntax-doc-type); font-style: normal; }
  /* Template literal inner highlighting */
  code-block .t-tl       { color: var(--sn-syntax-template); }
  code-block .t-tl-tag   { color: var(--sn-syntax-template-tag); }
  code-block .t-tl-attr  { color: var(--sn-syntax-template-attr); }
  code-block .t-tl-bracket { color: var(--sn-syntax-template-bracket); }
  code-block .t-tl-interp { color: var(--sn-syntax-template-interpolation); }
  code-block .t-tl-sel   { color: var(--sn-syntax-template-selector); }
  code-block .t-tl-prop  { color: var(--sn-syntax-template-property); }
  code-block .t-tl-val   { color: var(--sn-syntax-template-value); }
  /* Lint squiggles */
  code-block .cb-scroll { position: relative; }
  code-block .cb-squiggle-layer { position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 2; }
  code-block .cb-squiggle { position: absolute; right: 0; height: 19.2px; pointer-events: auto; cursor: help; border-radius: 2px; }
  code-block .cb-sev-2 { background: var(--sn-diagnostic-error-bg); border-bottom: 2px wavy var(--sn-diagnostic-error-border); }
  code-block .cb-sev-1 { background: var(--sn-diagnostic-warning-bg); border-bottom: 2px wavy var(--sn-diagnostic-warning-border); }
`;
