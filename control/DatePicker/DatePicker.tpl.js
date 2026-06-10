import { html } from '@symbiotejs/symbiote';

export default html`
  <div class="sn-date-container">
    <button ref="trigger" type="button" class="sn-date-trigger" aria-haspopup="dialog" aria-expanded="false">
      <span class="sn-date-value-text">{{displayLabel}}</span>
      <span class="material-symbols-outlined sn-date-calendar-icon">calendar_today</span>
    </button>
    <div ref="dropdown" class="sn-date-dropdown" role="dialog" aria-label="Calendar dropdown" tabindex="-1">
      <div class="sn-calendar-header">
        <button ref="prevBtn" type="button" class="sn-calendar-nav-btn"><span class="material-symbols-outlined">chevron_left</span></button>
        <span class="sn-calendar-title">{{calendarTitle}}</span>
        <button ref="nextBtn" type="button" class="sn-calendar-nav-btn"><span class="material-symbols-outlined">chevron_right</span></button>
      </div>
      <div class="sn-calendar-grid" ref="calendarGrid"></div>
    </div>
    <input ref="nativeInput" type="date" class="sn-date-native-input" tabindex="-1" aria-hidden="true">
  </div>
`;
