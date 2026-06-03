import { html } from '@symbiotejs/symbiote';

export let template = html`
  <div class="layout-root" ref="root"></div>
  <layout-preview ref="preview"></layout-preview>
  <panel-menu ref="menu"></panel-menu>

  <!-- Fullscreen tab bar (hidden by default) -->
  <div class="fullscreen-tab-bar" ${{ '@hidden': '!hasFullscreenTabs' }}>
    <div class="tab-list" itemize="tabItems">
      <template>
        <button
          class="fullscreen-tab"
          ${{
            onclick: '^onTabClick',
            '@data-panel-id': 'panelId',
            '@active': 'isActive',
          }}
        >
          <span class="material-symbols-outlined">{{icon}}</span>
          <span>{{title}}</span>
        </button>
      </template>
    </div>
    <div class="tab-filler"></div>
  </div>
`;
