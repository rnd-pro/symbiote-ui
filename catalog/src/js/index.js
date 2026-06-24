import '../../../ui/index.js';
import { bootTheme } from '../shell/theme-boot.js';
import { loadCatalog } from '../shell/catalog-model.js';
import { mountShell } from '../shell/shell.js';
import { registerCatalogPanels } from '../shell/panels/CategoryPanel.js';

registerCatalogPanels();
bootTheme();

const { categories, byCategory } = await loadCatalog();
const { workspaceEl } = mountShell({ categories });

for (const category of categories) {
  const panel = document.createElement('catalog-category-panel');
  panel.models = byCategory.get(category.id);
  workspaceEl.appendChild(panel);
}
