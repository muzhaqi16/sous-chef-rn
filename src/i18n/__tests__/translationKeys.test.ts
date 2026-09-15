import {
  isTranslationKey,
  t,
  type KeyUnder,
  type TranslationKey,
} from '#/i18n';

/**
 * `t` takes a key the English copy declares. The `@ts-expect-error` lines are
 * the assertion: if the key type ever widens to `string`, they stop erroring and
 * the typecheck fails.
 */
describe('translation keys are typed', () => {
  it('accepts a declared key, absolute or under its prefix', () => {
    const absolute: TranslationKey = 'labels.cancel';
    const relative: KeyUnder<'labels'> = 'cancel';

    expect(t(absolute)).toBe(t(`labels.${relative}`));
  });

  it('rejects an undeclared key at compile time', () => {
    // @ts-expect-error a misspelled key does not compile
    const misspelled: TranslationKey = 'labels.cancle';
    // @ts-expect-error a key outside the namespace does not compile
    const outside: KeyUnder<'labels'> = 'nope';

    expect(isTranslationKey(misspelled)).toBe(false);
    expect(isTranslationKey(`labels.${outside}`)).toBe(false);
  });
});
