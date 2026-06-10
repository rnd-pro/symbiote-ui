import { html } from '@symbiotejs/symbiote';

export default html`
  <button
    ref="trigger"
    class="ctw-trigger shell-action"
    type="button"
    aria-haspopup="dialog"
    ${{
      onclick: 'onToggle',
      '@aria-expanded': 'isOpen',
      '@active': 'isOpen',
      title: 'triggerTitle',
    }}
  >
    <span class="material-symbols-outlined" aria-hidden="true">palette</span>
    <span class="ctw-trigger-label">Theme</span>
  </button>
  <section
    ref="popover"
    class="ctw-popover"
    role="dialog"
    aria-label="Theme quick controls"
    ${{ '@hidden': '!isOpen' }}
  >
    <header class="ctw-header">
      <strong>Theme</strong>
      <div class="ctw-header-actions">
        <button type="button" data-action="copy" title="Copy parameters" aria-label="Copy parameters">
          <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
        </button>
        <button type="button" data-action="reset" title="Reset to defaults" aria-label="Reset to defaults">
          <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>
        </button>
        <button type="button" data-action="open-full" title="Open theme layout" aria-label="Open theme layout">
          <span class="material-symbols-outlined" aria-hidden="true">open_in_full</span>
        </button>
      </div>
    </header>
    <div class="ctw-mode" aria-label="Theme mode">
      <button type="button" data-theme-mode="dark">Dark</button>
      <button type="button" data-theme-mode="light">Light</button>
    </div>
    <div class="ctw-controls" ref="controls"></div>
  </section>
`;
