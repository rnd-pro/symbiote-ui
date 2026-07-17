/** @type { import('jsda-kit/cfg').JSDA_CFG } */
export default {
  static: {
    sourceDir: './site',
    outputDir: './_site',
    port: 3001,
    entryPatterns: ['index.js', 'index.*.js', '**/*.html.js', '*.html.js'],
    copy: [
      { from: './icons/material-symbols.css', to: './catalog/js/material-symbols.css' },
      { from: './icons/material-symbols-outlined-400.ttf', to: './catalog/js/material-symbols-outlined-400.ttf' },
      { from: './custom-elements.json', to: './catalog/custom-elements.json' },
      { from: './canvas/ForceWorker.js', to: './catalog/js/ForceWorker.js' },
    ],
  },
  importmap: {
    packageList: [],
  },
  minify: { js: true, css: true, html: false, svg: true, exclude: [] }, // HTML minification disabled due to minify-js crate panic on inline scripts
  ssr: { enabled: false },
  sitemap: {
    enabled: false,
  },
  log: true,
};
