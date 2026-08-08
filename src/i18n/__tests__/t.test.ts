import { t } from '../t';
import { getI18n } from '../config';

describe('t()', () => {
  /**
   * The whole point of `fallbackLng: 'en'` is that a key only authored in
   * English still renders English everywhere. This helper peeks at the
   * resource table directly (to keep object nodes returning the fallback), so
   * it has to walk the fallback chain itself — otherwise it becomes the one
   * place fallbackLng does not apply and the user sees a raw dot-path key.
   */
  describe('fallbackLng', () => {
    const i18n = getI18n();
    const originalLanguage = i18n.language;

    afterEach(async () => {
      i18n.removeResourceBundle('es', 'translation');
      await i18n.changeLanguage(originalLanguage);
    });

    it('falls back to English for a key missing in the active language', async () => {
      // Added at runtime rather than pointing at a real key, because every key
      // in en.json is currently also in es.json — the gap this guards against
      // is the one a future English-only addition creates.
      i18n.addResourceBundle('en', 'translation', { onlyEn: 'English only' });
      i18n.addResourceBundle('es', 'translation', { onlyEs: 'solo español' });
      await i18n.changeLanguage('es');

      expect(t('onlyEs')).toBe('solo español');
      expect(t('onlyEn')).toBe('English only');
    });

    it('still prefers an explicit fallback over the key for a truly missing path', async () => {
      await i18n.changeLanguage('es');
      expect(t('nonexistent.key', 'fallback value')).toBe('fallback value');
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });
  });

  it('resolves a dot-path key from the configured locale', () => {
    expect(t('errors.addItemFailed')).toBe('Failed to add item');
  });

  it('resolves nested keys', () => {
    expect(t('success.itemAdded')).toBe('Item added successfully');
  });

  it('returns the key when path does not exist', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('returns fallback when provided and key missing', () => {
    expect(t('nonexistent.key', 'fallback value')).toBe('fallback value');
  });

  it('returns the key when path resolves to non-string', () => {
    // 'errors' is an object, not a leaf string. With returnObjects disabled,
    // i18next falls back to the default value (the key itself).
    expect(t('errors')).toBe('errors');
  });
});
