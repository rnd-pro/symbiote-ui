import { html } from '@symbiotejs/symbiote';

export default html`
  <section class="cte-shell">
    <header class="cte-header">
      <div class="cte-title">
        <span class="material-symbols-outlined" aria-hidden="true">palette</span>
        <strong>Cascade theme</strong>
        <span class="cte-status" ref="status">{{status}}</span>
      </div>
      <div class="cte-actions">
        <button type="button" class="cte-icon-button" data-action="copy" ${{ onclick: 'onCopy' }} title="Copy parameters" aria-label="Copy parameters">
          <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
        </button>
        <button type="button" class="cte-icon-button" data-action="reset" ${{ onclick: 'onReset' }} title="Reset to defaults" aria-label="Reset to defaults">
          <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>
        </button>
      </div>
    </header>

    <div class="cte-targets" aria-label="Theme target" ${{ '@hidden': '!hasTargets' }}>
      <div class="cte-target-list" itemize="targets">
        <template>
          <button type="button" class="cte-target" title="{{hint}}" ${{ onclick: '^onTargetPick', '@data-target-id': 'id', '@aria-pressed': 'active' }}>
            <span class="material-symbols-outlined" aria-hidden="true">{{icon}}</span>
            <span class="cte-target-label">{{label}}</span>
          </button>
        </template>
      </div>
      <button type="button" class="cte-pick" ${{ onclick: 'onPickStart', '@aria-pressed': 'picking', '@hidden': '!pickable' }} title="Выбрать окно — кликните по нему" aria-label="Выбрать окно">
        <span class="material-symbols-outlined" aria-hidden="true">colorize</span>
      </button>
    </div>

    <div class="cte-mode" aria-label="Theme mode">
      <button type="button" data-theme-mode="dark" ${{ onclick: 'onModePick', '@aria-pressed': 'modeDark' }}>Dark</button>
      <button type="button" data-theme-mode="light" ${{ onclick: 'onModePick', '@aria-pressed': 'modeLight' }}>Light</button>
    </div>

    <div class="cte-mode cte-register" aria-label="Geometry register">
      <button type="button" data-geometry-register="" ${{ onclick: 'onRegisterPick', '@aria-pressed': 'registerDefault' }}>Default</button>
      <button type="button" data-geometry-register="product" ${{ onclick: 'onRegisterPick', '@aria-pressed': 'registerProduct' }}>Product</button>
      <button type="button" data-geometry-register="tool" ${{ onclick: 'onRegisterPick', '@aria-pressed': 'registerTool' }}>Tool</button>
      <button type="button" data-geometry-register="spacious" ${{ onclick: 'onRegisterPick', '@aria-pressed': 'registerSpacious' }}>Spacious</button>
    </div>

    <div class="cte-controls" ref="controls" itemize="controlsList">
      <template>
        <div class="cte-control" title="{{description}}">
          <div class="cte-control-head">
            <span class="cte-control-icon material-symbols-outlined" aria-hidden="true">{{icon}}</span>
            <label ${{ '@for': 'inputId' }}>{{name}}</label>
          </div>
          <input
            type="range"
            step="1"
            ${{ '@id': 'inputId', '@min': 'min', '@max': 'max', value: 'value', '@data-theme-control': 'name', 'style.--cte-range-progress': 'progress', oninput: '^onControlInput' }}
          >
          <output ${{ '@data-theme-output': 'name' }}>{{value}}</output>
        </div>
      </template>
    </div>

    <details class="cte-details">
      <summary>
        <span class="material-symbols-outlined" aria-hidden="true">data_object</span>
        Parameters
      </summary>
      <pre class="cte-params" ref="params">{{params}}</pre>
    </details>
  </section>
`;
