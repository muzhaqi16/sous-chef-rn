import {
  isTranslationKey,
  t,
  type KeyUnder,
  type TranslationKey,
} from '#/i18n';

/**
 * Compiles only for a string the key type `T` refuses: if `T` ever widens to
 * `string`, every call below stops compiling and the typecheck fails.
 */
const refusedBy =
  <T extends string>() =>
  <K extends string>(key: K & (K extends T ? never : unknown)): string =>
    key;

/** `t` takes a key the English copy declares. */
describe('translation keys are typed', () => {
  it('accepts a declared key, absolute or under its prefix', () => {
    const absolute: TranslationKey = 'labels.cancel';
    const relative: KeyUnder<'labels'> = 'cancel';

    expect(t(absolute)).toBe(t(`labels.${relative}`));
  });

  it('rejects an undeclared key at compile time', () => {
    const misspelled = refusedBy<TranslationKey>()('labels.cancle');
    const outside = refusedBy<KeyUnder<'labels'>>()('nope');

    expect(isTranslationKey(misspelled)).toBe(false);
    expect(isTranslationKey(`labels.${outside}`)).toBe(false);
  });
});
