import { defineModule } from '../../../ui/index.js';

const SHELL_TAGS = [
  'layout-shell-menu',
  'project-tabs',
  'layout-sidebar',
  'cascade-theme-widget',
];

function scrollToCategory(id) {
  const target = document.getElementById(`cat-${id}`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function mountShell({ categories }) {
  for (const tag of SHELL_TAGS) defineModule(tag);

  const shell = document.querySelector('#catalog-shell');
  const sidebarEl = shell.querySelector('layout-sidebar');
  const workspaceEl = shell.querySelector('#workspace-content');

  sidebarEl.routerSync = false;
  sidebarEl.setSections(categories.map((c) => ({
    id: c.id,
    icon: c.icon,
    label: `${c.label} (${c.count})`,
  })));

  shell.addEventListener('sidebar-section-select', (e) => {
    e.preventDefault();
    const id = e.detail?.id;
    if (!id) return;
    sidebarEl.setActiveSection(id);
    scrollToCategory(id);
  });

  return { workspaceEl, sidebarEl };
}
