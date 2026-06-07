import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_VOICE_SETTINGS,
  normalizeVoiceLanguageMode,
  loadVoiceSettings,
  saveVoiceSettings,
  mergeServerVoiceSettings,
} from '../chat/voice-settings.js';

class MockStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return key in this.store ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

class ThrowingStorage {
  getItem() {
    throw new Error('storage unavailable');
  }
  setItem() {
    throw new Error('storage unavailable');
  }
}

test('DEFAULT_VOICE_SETTINGS contains basic defaults', () => {
  assert.equal(DEFAULT_VOICE_SETTINGS.commandMode, false);
  assert.equal(DEFAULT_VOICE_SETTINGS.responseEnabled, false);
  assert.equal(DEFAULT_VOICE_SETTINGS.languageMode, 'en');
});

test('normalizeVoiceLanguageMode normalizes languages correctly', () => {
  assert.equal(normalizeVoiceLanguageMode('RU'), 'ru');
  assert.equal(normalizeVoiceLanguageMode('es'), 'es');
  assert.equal(normalizeVoiceLanguageMode('EN '), 'en');
  assert.equal(normalizeVoiceLanguageMode('auto', 'ru'), 'ru');
  assert.equal(normalizeVoiceLanguageMode(null, 'es'), 'es');
  assert.equal(normalizeVoiceLanguageMode(undefined, 'en'), 'en');
  assert.equal(normalizeVoiceLanguageMode('invalid', 'es'), 'es');
});

test('loadVoiceSettings loads defaults when storage is empty', () => {
  const storage = new MockStorage();
  const settings = loadVoiceSettings(storage, 'ru');

  assert.equal(settings.commandMode, false);
  assert.equal(settings.responseEnabled, false);
  assert.equal(settings.languageMode, 'ru');
});

test('loadVoiceSettings loads values when storage is populated', () => {
  const storage = new MockStorage();
  storage.setItem('symbiote_voice_command_mode', 'true');
  storage.setItem('symbiote_voice_response_enabled', 'true');
  storage.setItem('symbiote_voice_language_mode', 'es');

  const settings = loadVoiceSettings(storage, 'ru');
  assert.equal(settings.commandMode, true);
  assert.equal(settings.responseEnabled, true);
  assert.equal(settings.languageMode, 'es');
});

test('saveVoiceSettings saves values correctly', () => {
  const storage = new MockStorage();
  const success = saveVoiceSettings({
    commandMode: true,
    responseEnabled: false,
    languageMode: 'ru',
  }, storage);

  assert.ok(success);
  assert.equal(storage.getItem('symbiote_voice_command_mode'), 'true');
  assert.equal(storage.getItem('symbiote_voice_response_enabled'), 'false');
  assert.equal(storage.getItem('symbiote_voice_language_mode'), 'ru');
});

test('voice settings tolerate unavailable storage', () => {
  const storage = new ThrowingStorage();
  assert.deepEqual(loadVoiceSettings(storage, 'es'), {
    commandMode: false,
    responseEnabled: false,
    languageMode: 'es',
  });
  assert.equal(saveVoiceSettings({ commandMode: true }, storage), false);
});

test('mergeServerVoiceSettings merges server settings without clobbering undefined/empty fields', () => {
  const local = {
    commandMode: true,
    responseEnabled: false,
    languageMode: 'ru',
  };

  // 1. empty/undefined server settings should not clobber
  const merged1 = mergeServerVoiceSettings(local, undefined, 'en');
  assert.deepEqual(merged1, local);

  const merged2 = mergeServerVoiceSettings(local, {}, 'en');
  assert.deepEqual(merged2, local);

  // 2. partially populated server settings should only override present keys
  const merged3 = mergeServerVoiceSettings(local, { sendByCommandEnabled: false }, 'en');
  assert.equal(merged3.commandMode, false);
  assert.equal(merged3.responseEnabled, false); // preserved
  assert.equal(merged3.languageMode, 'ru'); // preserved

  // 3. fully populated server settings should overwrite all
  const merged4 = mergeServerVoiceSettings(local, {
    sendByCommandEnabled: false,
    voiceResponseEnabled: true,
    languageMode: 'es',
  }, 'en');
  assert.equal(merged4.commandMode, false);
  assert.equal(merged4.responseEnabled, true);
  assert.equal(merged4.languageMode, 'es');
});
