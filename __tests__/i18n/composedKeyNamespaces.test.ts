import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { getI18n } from '#/i18n/config';
import en from '#/i18n/locales/en.json';

const HOOKS_DIR = join(__dirname, '..', '..', 'src', 'hooks', 'items');

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

/**
 * `alertMutationFailure` (src/hooks/items/alertMutationFailure.ts) picks its
 * copy by composing `${keyPrefix}.${suffix}` from the mutation's payload
 * typename. Every prefix a caller passes must therefore carry the full suffix
 * set, and no static scan can see that — the keys never appear as literals.
 *
 * This was not hypothetical: consolidating duplicate error copy merged four of
 * these keys onto a canonical one, which no lint rule and no other test
 * noticed. It surfaced as five failing hook tests, which is luck rather than
 * coverage — the failure mode without those tests is an alert titled
 * "reportItem.failedTitle" the first time a report is refused.
 */
const ALERT_PREFIXES = ['suggestItemEdit', 'reportItem', 'itemPhotos.setPrimary'];

// Every suffix `alertMutationFailure` can compose, including the ValidationError
// and NotFoundError branches. `extraCases` suffixes are per-call and covered by
// each hook's own tests.
const ALERT_SUFFIXES = [
  'notFoundTitle',
  'notFoundBody',
  'rejectedTitle',
  'rateLimitedTitle',
  'failedTitle',
  'failedBody',
];

describe('alertMutationFailure key prefixes', () => {
  it.each(ALERT_PREFIXES)('%s carries every suffix it can compose', prefix => {
    const unresolved = ALERT_SUFFIXES.filter(suffix => {
      const key = `${prefix}.${suffix}`;
      const value = getI18n().t(key);
      return !value || value === key;
    });

    expect(unresolved).toEqual([]);
  });

  it('covers every prefix passed in the source', () => {
    // A new caller with a new prefix must be added above, or it goes unchecked.
    const source = readdirSync(HOOKS_DIR)
      .filter(f => f.endsWith('.ts'))
      .map(f => readFileSync(join(HOOKS_DIR, f), 'utf8'))
      .join('\n');
    const found = [...source.matchAll(/keyPrefix:\s*'([^']+)'/g)].map(m => m[1]);

    expect(found.length).toBeGreaterThan(0);
    expect([...new Set(found)].sort()).toEqual([...ALERT_PREFIXES].sort());
  });
});
