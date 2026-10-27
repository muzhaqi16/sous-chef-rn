import { mergedLocale } from '#/test-utils/mergedLocales';

/**
 * Error and empty-state copy lives in one place.
 *
 * `errors.*`, `empty.*` and `labels.*` are the canonical namespaces. They
 * existed before this test and were barely used — `empty` had 8 keys with 2
 * call sites — while 33 feature namespaces had each declared their own copy for
 * the same sentences. The result was the same English rendering as different
 * Spanish or Albanian depending on which screen you were on: "Failed to add
 * item" was `Nuk u shtua dot artikulli` in the pantry and `Shtimi i artikullit
 * dështoi` from a toast.
 *
 * Consolidation alone does not hold. Nothing stopped the next feature from
 * declaring `myFeature.somethingWentWrong` — which is exactly how the 33
 * accumulated. This test makes that a build failure at the moment it is
 * written, rather than a translation-consistency bug found on a screenshot
 * months later.
 *
 * The rule: if a feature namespace declares an error/empty-state string that
 * `errors.*` / `empty.*` / `labels.*` already has, use the canonical key.
 */

const CANONICAL_NAMESPACES = ['errors', 'empty', 'labels', 'dataState'];

const flatten = (obj: unknown, prefix = ''): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[full] = value;
    else if (value && typeof value === 'object')
      Object.assign(out, flatten(value, full));
  }
  return out;
};

// The merged tree — core plus every feature's copy. Reading only the core file
// would leave two thirds of the app's strings unchecked for duplication, which
// is exactly the class of problem this test exists to catch.
const LOCALES = ['en', 'es', 'it', 'sq'].map(locale =>
  flatten(mergedLocale(locale)),
);
const [en = {}] = LOCALES;

const isCanonical = (key: string) =>
  CANONICAL_NAMESPACES.includes(key.split('.')[0]!);

/**
 * A string worth having one home.
 *
 * This is not a shape test — asking whether the copy LOOKS like an error or an
 * empty state lets every other kind of duplicate through. "Home", "Item" and
 * "Try Again" match none of those patterns, and all three had drifted into two
 * different translations by the time anyone looked. The concept a string names
 * is what makes it worth sharing, not the words it happens to contain.
 *
 * What is excluded instead is copy too short or too incidental to be one
 * concept: a bare punctuation mark, a single letter, a number.
 */
const isSharedVocabulary = (value: string) =>
  value.trim().length > 1 && /[\p{L}]/u.test(value);

/**
 * Copy is the same only where every locale reads the same: "Accepted" for an
 * invitation and for a suggested edit is "Aceptada" and "Aceptado", two words
 * that agree with different nouns, and one key would make one of them wrong.
 */
const translationsOf = (key: string) =>
  JSON.stringify(LOCALES.map(locale => locale[key]));

/** Every group of keys whose translations match, with its English string. */
const keysByValue = (): Array<[string, string[]]> => {
  const groups = new Map<string, { value: string; keys: string[] }>();
  for (const [key, value] of Object.entries(en)) {
    const translations = translationsOf(key);
    const group = groups.get(translations) ?? { value, keys: [] };
    group.keys.push(key);
    groups.set(translations, group);
  }
  return [...groups.values()].map(({ value, keys }) => [value, keys]);
};

/**
 * Namespaces whose members are reached by a key built at runtime — an enum
 * value, a server error code, a validation field name, an alert prefix. A
 * member of one of these cannot be re-pointed at a canonical key, because no
 * call site names it: the key only exists once the value is substituted in.
 *
 * So when two of them hold the same string, that is not a duplicate anyone can
 * collapse — `usagePurpose.SNACK` and `mealType.SNACK` must both exist for
 * their own lookup to resolve. `enumKeyCoverage.test.ts` and
 * `composedKeyNamespaces.test.ts` are what hold those namespaces complete.
 *
 * A group with only ONE composed member is still reported: everything else in
 * it can be re-pointed at the composed key, which is what several already are.
 */
const RUNTIME_COMPOSED_NAMESPACES = [
  'auth',
  'baseDimension',
  'commonValidation',
  'cookingPreferences.skillLevels',
  'cuisines',
  'errors.codes',
  'errors.field',
  'errors.resourceNames',
  'expirationAction.toast',
  'inviteStatus',
  'itemPhotos.perspective',
  'itemType',
  'itemValidation',
  'onboardingValidation',
  'profileValidation',
  'recipes.diet',
  'recipes.difficultyLabel',
  'recipes.healthGoal',
  'recipes.intolerance',
  'recipes.recipeStatus',
  'shoppingListScreens.aisles.department',
  'storageLocationForm',
  'storageState',
  'storageStateShort',
  'unitType',
  'usagePurpose',
];
const isRuntimeComposed = (key: string) =>
  RUNTIME_COMPOSED_NAMESPACES.some(ns => key.startsWith(`${ns}.`));

const isComposedCollision = (keys: readonly string[]) =>
  keys.filter(isRuntimeComposed).length > 1;

// English does not inflect every plural, so `x_one` and `x_other` often share a
// string; they are one declaration, not two homes for the same copy.
const pluralBase = (key: string) =>
  key.replace(/_(zero|one|two|few|many|other)$/, '');

describe('shared copy has one canonical home', () => {
  const duplicated = keysByValue().filter(
    ([value, keys]) =>
      new Set(keys.map(pluralBase)).size > 1 && isSharedVocabulary(value),
  );

  it('finds duplicate groups at all, so the checks below are not vacuous', () => {
    // If the detector stops matching, every assertion here silently passes.
    // Runtime-composed namespaces that share a string keep a non-zero floor.
    expect(duplicated.length).toBeGreaterThan(0);
  });

  it('no feature namespace redeclares copy a canonical namespace already has', () => {
    const offenders = duplicated
      .filter(([, keys]) => !isComposedCollision(keys))
      .filter(([, keys]) => keys.some(isCanonical))
      .map(
        ([value, keys]) =>
          `${JSON.stringify(value)}\n    canonical: ${keys
            .filter(isCanonical)
            .join(', ')}` +
          `\n    redeclared as: ${keys
            .filter(k => !isCanonical(k))
            .join(', ')}`,
      );

    expect(offenders).toEqual([]);
  });

  it('no two feature namespaces declare the same copy', () => {
    // No canonical key involved — these are features duplicating each other,
    // which is how the canonical namespaces came to be unused in the first
    // place. Add the string to `errors.*` / `empty.*` / `labels.*` and point
    // both at it.
    const offenders = duplicated
      .filter(([, keys]) => !isComposedCollision(keys))
      .filter(([, keys]) => !keys.some(isCanonical))
      .map(([value, keys]) => `${JSON.stringify(value)} — ${keys.join(', ')}`);

    expect(offenders).toEqual([]);
  });

  // Neither assertion above sees this group: one filters to "some key is
  // canonical" and the other to "no key is canonical", so a string declared
  // twice INSIDE the canonical namespaces falls between them — and that is the
  // one place a duplicate is hardest to spot, because both homes look right.
  it('no canonical namespace redeclares copy another canonical one has', () => {
    const offenders = duplicated
      .filter(([, keys]) => !isComposedCollision(keys))
      .filter(([, keys]) => keys.every(isCanonical))
      .map(([value, keys]) => `${JSON.stringify(value)} — ${keys.join(', ')}`);

    expect(offenders).toEqual([]);
  });
});
