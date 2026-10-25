/** Normalize npm pack --json output across npm's array and object formats. */
export function normalizeNpmPackJson(value) {
  let packages = Array.isArray(value) ? value : Object.values(value || {});
  if (packages.length !== 1 || !packages[0] || typeof packages[0] !== 'object') {
    throw new TypeError('npm pack --json must describe exactly one package');
  }
  return packages[0];
}
