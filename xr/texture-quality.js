export const XR_UI_TEXTURE_QUALITY_VERSION = 'xr-ui-texture-quality-v1';

function textureDimensions(texture) {
  let width = Number(texture?.image?.naturalWidth || texture?.image?.videoWidth
    || texture?.image?.width);
  let height = Number(texture?.image?.naturalHeight || texture?.image?.videoHeight
    || texture?.image?.height);
  if (!(width > 0 && height > 0)) return [0, 0];
  return [Math.round(width), Math.round(height)];
}

function mipmappedRgbaBytes(width, height) {
  let total = 0;
  let levelWidth = width;
  let levelHeight = height;
  while (true) {
    total += levelWidth * levelHeight * 4;
    if (levelWidth === 1 && levelHeight === 1) return total;
    levelWidth = Math.max(1, Math.floor(levelWidth / 2));
    levelHeight = Math.max(1, Math.floor(levelHeight / 2));
  }
}

/**
 * @param {Object} THREE Host Three namespace.
 * @param {Object} texture UI texture.
 * @param {Object} [options] Source metadata and bounded anisotropy.
 * @returns {Object} Configured texture.
 */
export function configureXRUITextureQuality(THREE, texture, options = {}) {
  if (!texture || typeof texture !== 'object') {
    throw new TypeError('XR UI texture quality requires a texture object.');
  }
  if (THREE?.LinearMipmapLinearFilter == null
    || THREE?.LinearFilter == null
    || THREE?.SRGBColorSpace == null) {
    throw new Error(
      'XR UI texture quality requires LinearMipmapLinearFilter, LinearFilter, and SRGBColorSpace.',
    );
  }
  let [width, height] = textureDimensions(texture);
  let anisotropy = Number(options.anisotropy ?? texture.anisotropy ?? 1);
  if (!Number.isFinite(anisotropy) || anisotropy < 1) anisotropy = 1;
  anisotropy = Math.min(8, anisotropy);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  if ('anisotropy' in texture) texture.anisotropy = anisotropy;
  texture.userData ||= {};
  texture.userData.snXRTextureQuality = Object.freeze({
    version: XR_UI_TEXTURE_QUALITY_VERSION,
    source: String(options.source || 'xr-ui'),
    kind: String(options.kind || 'texture'),
    width,
    height,
    minFilter: 'linear-mipmap-linear',
    magFilter: 'linear',
    generateMipmaps: true,
    colorSpace: 'srgb',
    anisotropy,
    estimatedBaseRgbaBytes: width > 0 && height > 0 ? width * height * 4 : null,
    estimatedMipmappedRgbaBytes: width > 0 && height > 0
      ? mipmappedRgbaBytes(width, height)
      : null,
  });
  texture.needsUpdate = true;
  return texture;
}
