import { html } from '@symbiotejs/symbiote';

export default html`
<header class="app-topbar">
  <div class="topbar-left">
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
<project-tabs class="shell-tabs" ${{ ref: 'tabs' }}></project-tabs>
<div class="app-workspace">
  <slot></slot>
</div>
`;
