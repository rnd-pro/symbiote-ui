import {
  configureLocalization,
  getLocalization,
  isLocalizationExplicit,
  normalizeLocaleMode,
  resolveLocale,
} from '../locale/index.js';

export function detectBrowserLocale(source = globalThis.navigator) {
  if (!source) return 'en';
  let languages = Array.isArray(source.languages) ? source.languages : [];
  let preferences = languages.length > 0 ? languages : [source.language];
  return resolveLocale(preferences);
}

export function configureBrowserLocalization(options = {}) {
  let mode = normalizeLocaleMode(options.mode, { fallback: '' });
  if (mode) {
    let source = options.navigator ?? globalThis.navigator;
    let languages = Array.isArray(source?.languages) ? source.languages : [];
    let preferences = options.preferences
      ?? (languages.length > 0 ? languages : [source?.language]);
    return configureLocalization({
      mode,
      preferences,
      messages: options.messages,
      explicit: options.explicit,
    });
  }

  if (options.locale != null) {
    return configureLocalization({
      locale: options.locale,
      messages: options.messages,
      explicit: options.explicit,
    });
  }

  if (options.force !== true && isLocalizationExplicit()) {
    return getLocalization();
  }

  let locale = detectBrowserLocale(options.navigator ?? globalThis.navigator);
  return configureLocalization({
    mode: 'auto',
    preferences: [locale],
    messages: options.messages,
    explicit: options.explicit ?? false,
  });
}
