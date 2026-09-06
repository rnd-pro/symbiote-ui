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

  <!-- Mobile drawer launcher zones (one vertical icon stack per side;
       rendered only when a dock holds 2+ closed rail panels) -->
  <div
    class="layout-drawer-launchers layout-drawer-launchers-start"
    data-drawer-dock="start"
    ${{ '@hidden': '!hasStartLaunchers' }}
  >
    <div class="launcher-list" itemize="startLauncherItems">
      <template>
        <button
          class="layout-drawer-launcher material-symbols-outlined"
          type="button"
          ${{
            onclick: '^onLauncherClick',
            '@data-drawer-dock': 'dock',
            '@data-drawer-panel-id': 'panelId',
            '@data-active': 'active',
            '@aria-label': 'label',
            textContent: 'icon',
          }}
        ></button>
      </template>
    </div>
  </div>
  <div
    class="layout-drawer-launchers layout-drawer-launchers-end"
    data-drawer-dock="end"
    ${{ '@hidden': '!hasEndLaunchers' }}
  >
    <div class="launcher-list" itemize="endLauncherItems">
      <template>
        <button
          class="layout-drawer-launcher material-symbols-outlined"
          type="button"
          ${{
            onclick: '^onLauncherClick',
            '@data-drawer-dock': 'dock',
            '@data-drawer-panel-id': 'panelId',
            '@data-active': 'active',
            '@aria-label': 'label',
            textContent: 'icon',
          }}
        ></button>
      </template>
    </div>
  </div>

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
