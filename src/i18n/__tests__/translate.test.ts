import { isTranslationKey, t } from '../index';
import { getI18n } from '../config';

describe('t()', () => {
  /**
   * `fallbackLng: 'en'` means a key only authored in English still renders
   * English in every language.
   */
  describe('fallbackLng', () => {
    const i18n = getI18n();
    const originalLanguage = i18n.language;
    const spanish = i18n.getResourceBundle('es', 'translation');

    afterEach(async () => {
      i18n.addResourceBundle('es', 'translation', spanish, true, true);
      await i18n.changeLanguage(originalLanguage);
    });

    it('falls back to English for a key missing in the active language', async () => {
      // Spanish copy holding one key, so the other is missing in `es`.
      i18n.removeResourceBundle('es', 'translation');
      i18n.addResourceBundle('es', 'translation', {
        success: { itemAdded: 'Artículo añadido' },
      });
      await i18n.changeLanguage('es');

      expect(t('success.itemAdded')).toBe('Artículo añadido');
      expect(t('errors.addItemFailed')).toBe('Failed to add item');
    });
  });

  it('resolves a dot-path key from the configured locale', () => {
    expect(t('errors.addItemFailed')).toBe('Failed to add item');
  });

  it('resolves nested keys', () => {
    expect(t('success.itemAdded')).toBe('Item added successfully');
  });
});

describe('isTranslationKey', () => {
  it('accepts a key the loaded copy declares', () => {
    expect(isTranslationKey('errors.addItemFailed')).toBe(true);
  });

  it('accepts a plural key named without its suffix', () => {
    expect(isTranslationKey('labels.itemCount')).toBe(true);
  });

  // A key composed from server data that the copy does not cover.
  it('rejects a key the copy does not declare', () => {
    expect(isTranslationKey('errors.field.notAField')).toBe(false);
  });
});
