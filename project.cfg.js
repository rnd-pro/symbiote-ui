/** @type { import('jsda-kit/cfg').JSDA_CFG } */
export default {
  static: {
    sourceDir: './catalog/src',
    outputDir: './catalog/dist',
    port: 3001,
  },
  importmap: {
    packageList: [],
  },
  minify: { js: true, css: true, html: true, svg: true, exclude: [] },
  ssr: { enabled: false },
  sitemap: { enabled: false },
  log: true,
};
