import { readFileSync } from 'fs';
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
 * So this test pins `src/apollo/cache.ts` by hash. Any edit fails it, and the
 * fix is a decision, not a formality:
 *
 *   - Changed a `merge`/`read` so it can misbehave on old data? Bump
 *     `CURRENT_CACHE_VERSION` (e.g. 'shape-1' → 'shape-2'), which purges once
 *     on upgrade, THEN re-record the hash below.
 *   - Changed `keyArgs`, added a policy, or edited a comment? An old blob is
 *     still safe — stranded field keys are a cache miss and a refetch. Just
 *     re-record the hash.
 *
 * Re-record with:
 *   sha256sum src/apollo/cache.ts | cut -c1-16
 */
const REVIEWED_CACHE_POLICY_HASH = 'e4aab68d114ce0c2';

it('cache.ts has not changed without the persisted-shape decision being made', () => {
  const actual = createHash('sha256')
    .update(readFileSync('src/apollo/cache.ts'))
    .digest('hex')
    .slice(0, 16);

  expect(actual).toBe(REVIEWED_CACHE_POLICY_HASH);
});
