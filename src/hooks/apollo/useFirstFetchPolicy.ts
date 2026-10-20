import { useState } from 'react';

type FirstFetchPolicy = 'cache-first' | 'network-only';

/**
 * `cache-first`, or `network-only` while the cache's answer for `key` is one
 * `cachedIsStale` says must be asked for again. Decided once per key while
 * mounted, so a query that declines resync does not serve a stale answer until
 * sign-out, and a stale answer that comes back stale is not asked for again.
 */
export function useFirstFetchPolicy(
  key: string | null,
  cachedIsStale: () => boolean,
): FirstFetchPolicy {
  const policyOf = (): FirstFetchPolicy =>
    key !== null && cachedIsStale() ? 'network-only' : 'cache-first';
  const [chosen, setChosen] = useState(() => ({ key, policy: policyOf() }));
  if (chosen.key === key) return chosen.policy;
  const next = { key, policy: policyOf() };
  setChosen(next);
  return next.policy;
}
