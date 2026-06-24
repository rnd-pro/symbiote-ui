export default /*html*/ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base href="/">
<title>Symbiote UI — Component Catalog</title>
<link rel="stylesheet" href="./css/index.css">
<script type="module" src="./js/index.js"></script>
</head>
<body>
<layout-shell-menu
  id="catalog-shell"
  title="Symbiote UI"
  title-icon="hub"
  path-label="Component Catalog"
  path-icon="widgets">

  <a class="topbar-link" slot="actions" href="./demo/" title="Open the symbiote-ui demos">
    <span class="material-symbols-outlined" aria-hidden="true">play_circle</span>
    <span>Demo</span>
  </a>

  <cascade-theme-widget
    slot="actions"
    storage-key="symbiote-ui:catalog-theme"
    target-selector=":root">
  </cascade-theme-widget>

  <layout-sidebar slot="sidebar"></layout-sidebar>

  <sn-scroll-area class="workspace-scroll">
    <main id="workspace-content" aria-live="polite"></main>
  </sn-scroll-area>

</layout-shell-menu>
</body>
</html>`;
