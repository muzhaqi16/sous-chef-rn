import type { ApolloCache } from '@apollo/client';
import { pantryFeedAdapter } from '#features/pantry/offline/pantryFeed';
import { listFeedAdapter } from '#features/shoppingList/offline/listFeed';
import { isRecord } from '#/utils/isRecord';
import type { FeedAdapter } from './types';

/** One entry per scope kind this build handles. */
export const FEED_ADAPTERS: readonly FeedAdapter[] = [
  listFeedAdapter,
  pantryFeedAdapter,
];

const BY_KIND: ReadonlyMap<string, FeedAdapter> = new Map(
  FEED_ADAPTERS.map(adapter => [adapter.kind, adapter]),
);

/** A string: a newer server can name a kind this build's enum does not hold. */
export const adapterOfKind = (kind: string): FeedAdapter | undefined =>
  BY_KIND.get(kind);

function collectStrings(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    into.add(value);
  } else if (Array.isArray(value)) {
    for (const entry of value) collectStrings(entry, into);
  } else if (isRecord(value)) {
    for (const entry of Object.values(value)) collectStrings(entry, into);
  }
}

/**
 * The stored scopes a queued write's layer reads, from every id its variables
 * and inputs name; null when one cannot be placed, which restores them all.
 */
export function scopesNamedBy(
  cache: ApolloCache,
  values: readonly unknown[],
): string[] | null {
  const ids = new Set<string>();
  for (const value of values) collectStrings(value, ids);
  const scopes = new Set<string>();
  for (const adapter of FEED_ADAPTERS) {
    if (!adapter.scopesNamedBy) continue;
    const named = adapter.scopesNamedBy(cache, [...ids]);
    if (!named) return null;
    for (const id of named) scopes.add(id);
  }
  return [...scopes];
}
