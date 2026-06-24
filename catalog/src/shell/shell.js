import { defineModule } from '../../../ui/index.js';

const SHELL_TAGS = [
  'layout-shell-menu',
  'project-tabs',
  'layout-sidebar',
  'sn-scroll-area',
  'cascade-theme-widget',
];

function scrollToCategory(scrollArea, id) {
  const target = document.getElementById(`cat-${id}`);
  if (!target) return;
  if (scrollArea && typeof scrollArea.scrollToPosition === 'function') {
    const viewportTop = scrollArea.getBoundingClientRect().top;
    const top = scrollArea.scrollTop + (target.getBoundingClientRect().top - viewportTop);
    scrollArea.scrollToPosition({ top, behavior: 'smooth' });
    return;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function mountShell({ categories }) {
  for (const tag of SHELL_TAGS) defineModule(tag);

  const shell = document.querySelector('#catalog-shell');
  const sidebarEl = shell.querySelector('layout-sidebar');
  const scrollArea = shell.querySelector('.workspace-scroll');
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
    scrollToCategory(scrollArea, id);
  });

  return { workspaceEl, sidebarEl };
}
