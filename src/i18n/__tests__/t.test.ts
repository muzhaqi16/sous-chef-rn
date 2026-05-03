import { t } from '../t';

describe('t()', () => {
  it('resolves a dot-path key from MESSAGES', () => {
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
    // 'errors' is an object, not a string
    expect(t('errors')).toBe('errors');
  });
});
