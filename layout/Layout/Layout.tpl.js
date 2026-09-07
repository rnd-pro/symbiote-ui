import { html } from '@symbiotejs/symbiote';

export let template = html`
  <div class="layout-root" ref="root"></div>
  <button
    class="layout-drawer-backdrop"
    type="button"
    aria-label="Close drawer"
    ${{ onclick: 'onDrawerBackdropClick' }}
  ></button>
  <panel-menu ref="menu"></panel-menu>

  <!-- Native R2 rails: collapsed drawer panels render as their own
    layout-node surfaces. No synthetic launcher or rail-stack buttons. -->

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
