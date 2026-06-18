import { html } from '@symbiotejs/symbiote';

export default html`
  <section class="cte-shell">
    <header class="cte-header">
      <div class="cte-title">
        <span class="material-symbols-outlined" aria-hidden="true">palette</span>
        <strong>Cascade theme</strong>
        <span class="cte-status" ref="status">ready</span>
      </div>
      <div class="cte-actions">
        <button type="button" class="cte-icon-button" data-action="copy" title="Copy parameters" aria-label="Copy parameters">
          <span class="material-symbols-outlined" aria-hidden="true">content_copy</span>
        </button>
        <button type="button" class="cte-icon-button" data-action="reset" title="Reset to defaults" aria-label="Reset to defaults">
          <span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>
        </button>
      </div>
    </header>

    <div class="cte-mode" aria-label="Theme mode">
      <button type="button" data-theme-mode="dark">Dark</button>
      <button type="button" data-theme-mode="light">Light</button>
    </div>

    <div class="cte-controls" ref="controls"></div>

    <details class="cte-details">
      <summary>
        <span class="material-symbols-outlined" aria-hidden="true">data_object</span>
        Parameters
      </summary>
      <pre class="cte-params" ref="params"></pre>
    </details>
  </section>
`;
