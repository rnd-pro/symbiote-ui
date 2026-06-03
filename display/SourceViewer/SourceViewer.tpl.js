export default `
  <div class="sv-header">
    <span class="sv-filename" bind="textContent: filename"></span>
    <div class="sv-controls">
      <span class="sv-stats" bind="textContent: statsText"></span>
      <button class="sv-action" bind="onclick: onShowGraph; hidden: !showGraphAction; title: showGraphTitle">
        <span class="material-symbols-outlined icon-sm">account_tree</span>
        <span class="sv-action-label" bind="textContent: graphLabel"></span>
      </button>
      <button class="sv-action" bind="onclick: onToggleMode; hidden: !showToggle; title: toggleModeTitle">
        <span class="material-symbols-outlined icon-sm" bind="textContent: toggleIcon"></span>
        <span class="sv-action-label" bind="textContent: modeLabel"></span>
      </button>
    </div>
  </div>
  <code-block></code-block>
`;
