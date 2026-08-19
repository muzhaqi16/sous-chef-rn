import fs from 'fs';
import path from 'path';

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
const LOCALES_DIR = path.join(__dirname, '..', '..', 'src', 'i18n', 'locales');

const CANONICAL_NAMESPACES = ['errors', 'empty', 'labels', 'dataState'];

/**
 * Duplicates that are deliberate, each with the reason. An entry here is a
 * decision, not a snooze — and it names the exact key pair, so a NEW duplicate
 * cannot hide behind it.
 */
const COMPOSED_KEY_REASON =
  '`alertMutationFailure` composes these at runtime as ' +
  '`${keyPrefix}.${suffix}` from the mutation payload typename, so every ' +
  'prefix must carry the whole suffix set. Merging four of them onto a ' +
  'canonical key is exactly the mistake this exemption prevents — no static ' +
  'scan can see a composed key, and no lint rule caught it. The prefixes are ' +
  'checked by `composedKeyNamespaces.test.ts`.';

const INTENTIONAL: ReadonlyArray<{ keys: readonly string[]; reason: string }> = [
  {
    keys: ['errors.codes.genericRetry', 'errors.somethingWentWrong'],
    reason:
      'errors.codes.* is a lookup table keyed by the server ErrorCode — a ' +
      'different mechanism from UI copy. Collapsing them would couple the ' +
      "server's vocabulary to the app's.",
  },
  {
    keys: ['errors.codes.unexpected', 'errors.boundary.message', 'errors.unexpected'],
    reason:
      'errors.codes.* is server-keyed (see above); errors.boundary.* is ' +
      'self-contained by design.',
  },
  {
    keys: ['errors.boundary.title', 'errors.somethingWentWrongTitle'],
    reason:
      'errors.boundary.* is duplicated on purpose. The crash screen must ' +
      'render when app context is broken, so it carries its own copy and ' +
      'English fallbacks rather than depending on the shared vocabulary.',
  },
  {
    keys: ['recipes.publishFailed', 'recipes.updateRecipeMetaFailed'],
    reason:
      'One feature, two distinct operations that happen to share wording ' +
      'today. Merging would remove the option to word them differently.',
  },
  {
    keys: [
      'suggestItemEdit.rejectedTitle',
      'suggestItemEdit.failedTitle',
      'reportItem.rejectedTitle',
      'reportItem.failedTitle',
    ],
    reason: COMPOSED_KEY_REASON,
  },
  {
    keys: [
      'itemPhotos.setPrimary.rejectedTitle',
      'itemPhotos.setPrimary.failedTitle',
    ],
    reason: COMPOSED_KEY_REASON,
  },
];

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

const en = flatten(
  JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf8')),
);

const isCanonical = (key: string) =>
  CANONICAL_NAMESPACES.includes(key.split('.')[0]);

const looksLikeErrorOrEmptyCopy = (value: string) =>
  /(failed|error|couldn't|could not|went wrong|unable to|something went)/i.test(
    value,
  ) ||
  /^(no |your .* is empty)/i.test(value) ||
  /empty|no results|no data/i.test(value);

/** English string -> every key that declares it. */
const keysByValue = (): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const [key, value] of Object.entries(en)) {
    const list = map.get(value) ?? [];
    list.push(key);
    map.set(value, list);
  }
  return map;
};

const isIntentional = (keys: readonly string[]) =>
  INTENTIONAL.some(
    entry =>
      entry.keys.length === keys.length &&
      keys.every(k => entry.keys.includes(k)),
  );

describe('error and empty-state copy has one canonical home', () => {
  const duplicated = [...keysByValue().entries()].filter(
    ([value, keys]) => keys.length > 1 && looksLikeErrorOrEmptyCopy(value),
  );

  it('finds duplicate groups at all, so the checks below are not vacuous', () => {
    // If the detector stops matching, every assertion here silently passes.
    // The intentional list guarantees a non-zero floor.
    expect(duplicated.length).toBeGreaterThan(0);
  });

  it('no feature namespace redeclares copy a canonical namespace already has', () => {
    const offenders = duplicated
      .filter(([, keys]) => !isIntentional(keys))
      .filter(([, keys]) => keys.some(isCanonical))
      .map(
        ([value, keys]) =>
          `${JSON.stringify(value)}\n    canonical: ${keys.filter(isCanonical).join(', ')}` +
          `\n    redeclared as: ${keys.filter(k => !isCanonical(k)).join(', ')}`,
      );

    expect(offenders).toEqual([]);
  });

  it('no two feature namespaces declare the same error/empty copy', () => {
    // No canonical key involved — these are features duplicating each other,
    // which is how the canonical namespaces came to be unused in the first
    // place. Add the string to `errors.*` / `empty.*` / `labels.*` and point
    // both at it.
    const offenders = duplicated
      .filter(([, keys]) => !isIntentional(keys))
      .filter(([, keys]) => !keys.some(isCanonical))
      .map(([value, keys]) => `${JSON.stringify(value)} — ${keys.join(', ')}`);

    expect(offenders).toEqual([]);
  });

  it('every intentional exemption still describes a real duplicate', () => {
    // An exemption whose keys no longer collide has outlived its subject and
    // would go on excusing a future duplicate that happened to match.
    const stale = INTENTIONAL.filter(entry => {
      const values = entry.keys.map(k => en[k]);
      return (
        values.some(v => v === undefined) || new Set(values).size !== 1
      );
    }).map(entry => entry.keys.join(', '));

    expect(stale).toEqual([]);
  });
});
