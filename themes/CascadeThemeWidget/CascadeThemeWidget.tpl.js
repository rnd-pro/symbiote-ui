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
        <button type="button" data-action="copy" title="Copy parameters" aria-label="Copy parameters" ${{ onclick: 'onCopy' }}>
          <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
        </button>
        <button type="button" data-action="reset" title="Reset to defaults" aria-label="Reset to defaults" ${{ onclick: 'onReset' }}>
          <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>
        </button>
        <button type="button" data-action="open-full" title="Open theme layout" aria-label="Open theme layout" ${{ onclick: 'onOpenFull' }}>
          <span class="material-symbols-outlined" aria-hidden="true">open_in_full</span>
        </button>
      </div>
    </header>
    <div class="ctw-mode" aria-label="Theme mode">
      <button type="button" data-theme-mode="dark" ${{ onclick: 'onModePick', '@aria-pressed': 'modeDarkActive' }}>Dark</button>
      <button type="button" data-theme-mode="light" ${{ onclick: 'onModePick', '@aria-pressed': 'modeLightActive' }}>Light</button>
    </div>
    <div class="ctw-mode ctw-register" aria-label="Geometry register">
      <button type="button" data-geometry-register="" ${{ onclick: 'onRegisterPick', '@aria-pressed': 'registerDefaultActive' }}>Default</button>
      <button type="button" data-geometry-register="product" ${{ onclick: 'onRegisterPick', '@aria-pressed': 'registerProductActive' }}>Product</button>
      <button type="button" data-geometry-register="tool" ${{ onclick: 'onRegisterPick', '@aria-pressed': 'registerToolActive' }}>Tool</button>
      <button type="button" data-geometry-register="spacious" ${{ onclick: 'onRegisterPick', '@aria-pressed': 'registerSpaciousActive' }}>Spacious</button>
    </div>
    <div class="ctw-controls" ref="controls" itemize="controlsList">
      <template>
        <div class="ctw-control">
          <div class="ctw-control-head">
            <span class="ctw-control-icon material-symbols-outlined" aria-hidden="true">{{icon}}</span>
            <label ${{ '@for': 'inputId' }}>{{name}}</label>
          </div>
          <input
            type="range"
            step="1"
            ${{
              '@id': 'inputId',
              '@min': 'min',
              '@max': 'max',
              '@data-theme-control': 'name',
              value: 'value',
              oninput: '^onControlInput',
            }}
          >
          <output ${{ '@data-theme-output': 'name' }}>{{value}}</output>
        </div>
      </template>
    </div>
  </section>
`;
