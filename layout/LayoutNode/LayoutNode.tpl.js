import { html } from '@symbiotejs/symbiote';

export let template = html`
  <div class="panel-view" ${{ '@hidden': '!isPanel' }}>
    <div class="panel-header" ${{ '@hidden': '!panelChrome' }}>
      <button class="header-btn type-btn" ${{ onclick: 'onTypeClick' }}>
        <span class="material-symbols-outlined panel-icon" ${{ textContent: 'panelIcon' }}></span>
        <span class="panel-title" ${{ textContent: 'panelTitle' }}></span>
        <span class="material-symbols-outlined dropdown-arrow">arrow_drop_down</span>
      </button>
      <div class="header-spacer"></div>
      <button
        class="header-btn panel-menu-toggle"
        ${{ onclick: 'onPanelMenuToggle', '@hidden': '!hasPanelMenuActions', '@active': 'isPanelMenuOpen', title: 'panelMenuTitle' }}
      >
        <span class="material-symbols-outlined">more_horiz</span>
        <span class="material-symbols-outlined" ${{ textContent: 'panelMenuIcon' }}></span>
      </button>
      <button
        class="header-btn collapse-btn"
        ${{ onclick: 'onCollapseClick', '@hidden': '!canCollapse', title: 'collapseTitle' }}
      >
        <span class="material-symbols-outlined" ${{ textContent: 'collapseIcon' }}></span>
      </button>
      <button
        class="header-btn fullscreen-btn"
        ${{ onclick: 'onFullscreenClick', title: 'fullscreenTitle' }}
      >
        <span class="material-symbols-outlined" ${{ textContent: 'fullscreenIcon' }}></span>
      </button>
    </div>
    <div class="panel-menu-drawer" ${{ '@hidden': '!isPanelMenuOpen' }}>
      <div class="panel-menu-actions" itemize="panelMenuActions">
        <template>
          <button
            class="panel-menu-action"
            type="button"
            ${{
              '@data-menu-action-id': 'id',
              title: 'title',
            }}
          >
            <span class="material-symbols-outlined">{{icon}}</span>
            <span>{{label}}</span>
          </button>
        </template>
      </div>
    </div>
    <div class="panel-content" ref="panelContent" ${{ '@hidden': 'isCollapsed' }}></div>
  </div>

  <div class="split-view" ${{ '@hidden': '!isSplit', '@direction': 'direction' }}>
    <div class="split-first" ref="first" ${{ '@style': 'firstStyle' }}></div>
    <div class="split-resizer" ${{ onpointerdown: 'onResizerDown' }}></div>
    <div class="split-second" ref="second" ${{ '@style': 'secondStyle' }}></div>
  </div>
`;
