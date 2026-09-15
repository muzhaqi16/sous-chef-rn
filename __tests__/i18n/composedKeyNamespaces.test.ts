import { getI18n } from '#/i18n/config';
import { isTranslationKey } from '#/i18n';
import en from '#/i18n/locales/en.json';
// profileValidation, itemValidation and onboardingValidation moved to the
// features that own them. Imported directly, like `en`, so removing a namespace
// is a compile error.
import profileEn from '#features/profile/locales/en.json';
import catalogEn from '#features/catalog/locales/en.json';
import onboardingEn from '#features/onboarding/locales/en.json';
import {
  PRIORITY_OPTIONS,
  priorityOptionOf,
  priorityValueOf,
} from '#features/shoppingList/utils/priority';

/**
 * Namespaces whose keys are composed at runtime — `t(`${ns}.${key}`)` — and so
 * are invisible to `keysExist.test.ts`, which matches single-quoted literals.
 *
 * The Yup schemas reach them through a `msg()` helper that returns a *function*
 * rather than a string: the schemas are built at module scope, so a message
 * resolved eagerly would freeze whichever language loaded first. That laziness
 * is also what hides the key from static scanning, and it means a typo in the
 * namespace prefix produces a validation message reading
 * "profileValidation.urlInvalid" the first time a user gets the field wrong —
 * not at build time, and not in any existing test.
 *
 * Resolving every key through the real i18n instance closes that gap. It checks
 * the prefix in the source agrees with the JSON, which neither `keysExist`
 * (can't see the key) nor `localeParity` (compares locales, not code) can do.
 */
// Indexed directly rather than through a string lookup, so removing a namespace
// from en.json fails to compile here instead of silently skipping it.
const cases = [
  {
    namespace: 'profileValidation',
    keys: Object.keys(profileEn.profileValidation),
  },
  {
    namespace: 'onboardingValidation',
    keys: Object.keys(onboardingEn.onboardingValidation),
  },
  { namespace: 'itemValidation', keys: Object.keys(catalogEn.itemValidation) },
  { namespace: 'toasts', keys: Object.keys(en.toasts) },
];

describe('runtime-composed i18n namespaces', () => {
  it.each(cases)(
    '$namespace resolves every key to real copy',
    ({ namespace, keys }) => {
      // A namespace that lost its entries would otherwise pass vacuously.
      expect(keys.length).toBeGreaterThan(0);

      // `count` is supplied because several of these interpolate it; a key that
      // does not use it is unaffected.
      const unresolved = keys.filter(key => {
        const full = `${namespace}.${key}`;
        if (!isTranslationKey(full)) return true;
        const value = getI18n().t(full, { count: 3 });
        return !value || value === full;
      });

      expect(unresolved).toEqual([]);
    },
  );
});

describe('shopping-list priority options', () => {
  it('maps each option to its API integer and back', () => {
    // The API reads 0 low, 1 medium, 2 high; an option's index is that value.
    expect(PRIORITY_OPTIONS.map(priorityValueOf)).toEqual([0, 1, 2]);
    expect([0, 1, 2].map(priorityOptionOf)).toEqual(['low', 'medium', 'high']);
    expect(priorityOptionOf(3)).toBeUndefined();
  });
});
