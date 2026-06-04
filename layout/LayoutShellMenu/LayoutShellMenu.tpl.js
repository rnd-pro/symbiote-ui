import { html } from '@symbiotejs/symbiote';

export default html`
<header class="app-topbar">
  <div class="topbar-left">
    <button
      class="shell-menu-toggle"
      type="button"
      ${{ onclick: 'onMenuToggle', '@aria-expanded': 'isMenuOpen', '@active': 'isMenuOpen', title: 'menuTitle' }}
    >
      <span class="material-symbols-outlined" ${{ textContent: 'menuIcon' }}></span>
    </button>
    <span class="material-symbols-outlined app-title-icon" ${{ textContent: 'titleIcon' }}></span>
    <span class="app-title" ${{ textContent: 'title' }}></span>
  </div>
  <div class="topbar-center">
    <span class="material-symbols-outlined topbar-project-icon" ${{ textContent: 'pathIcon' }}></span>
    <span class="topbar-project-path" ${{ textContent: 'pathLabel' }}></span>
  </div>
  <div class="topbar-right">
    <slot name="actions"></slot>
  </div>
</header>
<section class="shell-menu-drawer" aria-label="Layout menu" ${{ '@hidden': '!isMenuOpen' }}>
  <div class="shell-menu-tabs">
    <project-tabs class="shell-tabs" ${{ ref: 'tabs' }}></project-tabs>
  </div>
  <div class="shell-menu-actions">
    <slot name="menu-actions"></slot>
  </div>
  <slot name="menu"></slot>
</section>
<div class="app-workspace">
  <slot></slot>
</div>
`;
