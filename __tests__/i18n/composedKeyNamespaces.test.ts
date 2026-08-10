import { getI18n } from '#/i18n/config';
import en from '#/i18n/locales/en.json';

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
  { namespace: 'profileValidation', keys: Object.keys(en.profileValidation) },
  {
    namespace: 'onboardingValidation',
    keys: Object.keys(en.onboardingValidation),
  },
  { namespace: 'itemValidation', keys: Object.keys(en.itemValidation) },
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
        const value = getI18n().t(`${namespace}.${key}`, { count: 3 });
        return !value || value === `${namespace}.${key}`;
      });

      expect(unresolved).toEqual([]);
    },
  );
});
