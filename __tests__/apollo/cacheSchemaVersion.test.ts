import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

/**
 * The persisted Apollo cache is keyed by the SHAPE of what was written, not by
 * the app version that wrote it — see `CURRENT_CACHE_VERSION` in
 * `src/apollo/offline/ApolloCachePersistence.ts`. That stopped every release
 * from wiping a user's offline data, but it moved the decision to a human: the
 * constant now has to be bumped when a change to the type policies makes an
 * old blob unsafe to restore.
 *
 * A hand-maintained constant that nothing checks will drift, and the failure is
 * silent and delayed — a `merge` or `read` running over a value written in the
 * old shape, on someone else's device, after an update.
 *
 * So this test pins every module that decides that shape, by hash. The list is
 * DERIVED from the tree: the policies live with their features now, so a
 * hard-coded list would stop covering the file a change actually lands in.
 *
 * Any edit fails this, and the fix is a decision, not a formality:
 *
 *   - Changed a `merge`/`read` so it can misbehave on old data? Bump
 *     `CURRENT_CACHE_VERSION` (e.g. 'shape-1' → 'shape-2'), which purges once
 *     on upgrade, THEN re-record the hash below.
 *   - Changed `keyArgs`, added a policy, or edited a comment? An old blob is
 *     still safe — stranded field keys are a cache miss and a refetch. Just
 *     re-record the hash.
 *
 * Re-record by running this test: the failure message prints the new hash.
 */
// Re-recorded 2026-09-02: `cache.ts` reads the policies from
// `features/registry.cache.ts` instead of the static manifests, which took them
// off the i18n launch path. No merge or read changed. Earlier the same day:
// dropped unused type imports from the policy modules
// after the split; no merge or read changed, so an old blob restores exactly as
// before. Earlier the same day: the type policies moved out of `cache.ts` into
// `features/<name>/cache/typePolicies.ts`, byte-identical, and `cache.ts`
// became the assembler. Nothing a `merge` or `read` does changed, so an old
// blob restores exactly as before. No version bump.
const REVIEWED_CACHE_POLICY_HASH = '6025319f9df8d272';

const FEATURES = join('src', 'features');

/** Every module that decides the persisted shape, in a stable order. */
const shapeFiles = (): string[] => {
  const featurePolicies = readdirSync(FEATURES, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => join(FEATURES, e.name, 'cache', 'typePolicies.ts'))
    .filter(existsSync)
    .sort();
  return [
    join('src', 'apollo', 'cache.ts'),
    join('src', 'apollo', 'cacheFieldPolicies.ts'),
    ...featurePolicies,
  ];
};

it('the cache policies have not changed without the persisted-shape decision being made', () => {
  const files = shapeFiles();
  // Guards against the derivation silently matching nothing: seven features
  // declare policies today.
  expect(files.length).toBeGreaterThanOrEqual(9);

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(file);
    hash.update(readFileSync(file));
  }
  const actual = hash.digest('hex').slice(0, 16);

  expect(actual).toBe(REVIEWED_CACHE_POLICY_HASH);
});
