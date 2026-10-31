import type { ApolloCache } from '@apollo/client';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import type { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import {
  storeChoiceKey,
  storeChoiceOf,
  type StoreChoice,
} from '#domain/stores';
import {
  UsualStoresDocument,
  type UsualStoresQuery,
} from '#features/catalog/hooks/useUsualStores.generated';
import { UsualStores_RowFragmentDoc } from './usualStores.generated';
import {
  NEUTRAL_LOCAL_USUAL_STORE,
  NEUTRAL_LOCAL_USUAL_STORE_BY_TYPE,
} from './usualStoreRowNeutral.generated';

/** One entry of a household's usual stores, whole. */
export type UsualStoreEntry = UsualStoresQuery['usualStores'][number];

/** An entry's key; null for one naming neither, which the API never answers. */
export const entryKey = (entry: UsualStoreEntry): string | null => {
  const choice = storeChoiceOf(entry);
  return choice ? storeChoiceKey(choice) : null;
};

/** The list as the cache holds it; null when it was never read. */
export function readUsualStores(
  cache: ApolloCache,
  homeId: string | null,
): UsualStoreEntry[] | null {
  return (
    cache.readQuery({
      query: UsualStoresDocument,
      variables: { homeId },
      optimistic: true,
    })?.usualStores ?? null
  );
}

/**
 * The one writer of a household's usual stores: the list is replaced whole,
 * by a local write or a write's answer alike, so an entry never shows twice.
 */
export function writeUsualStores(
  cache: ApolloCache,
  homeId: string | null,
  entries: readonly UsualStoreEntry[],
): void {
  cache.writeQuery({
    query: UsualStoresDocument,
    variables: { homeId },
    data: { __typename: 'Query', usualStores: [...entries] },
  });
}

/** An answer's list, which a commit reads as `unknown`. */
export const isUsualStoreList = (list: unknown): list is UsualStoreEntry[] =>
  Array.isArray(list);

const LOCAL_ID_PREFIX = 'local-';

/**
 * Keeps only the entries a removal's answer names, which states the list by
 * its keys: a refresh that landed after the local removal put it back. An
 * entry the server has not named yet stays: no refresh brings one back.
 */
export function keepUsualStores(
  cache: ApolloCache,
  homeId: string | null,
  ids: readonly string[],
): void {
  const held = readUsualStores(cache, homeId);
  if (!held) return;
  const kept = new Set(ids);
  writeUsualStores(
    cache,
    homeId,
    held.filter(
      entry => kept.has(entry.id) || entry.id.startsWith(LOCAL_ID_PREFIX),
    ),
  );
}

/**
 * Replaces `key`'s entry in place, or adds it last (null takes it out), and
 * answers the one it replaced. Nothing is written to a list never read: it
 * would claim to be the whole list.
 */
export function replaceUsualStore(
  cache: ApolloCache,
  homeId: string | null,
  key: string,
  next: (held: UsualStoreEntry | undefined) => UsualStoreEntry | null,
): UsualStoreEntry | undefined {
  const held = readUsualStores(cache, homeId);
  if (!held) return undefined;
  const at = held.findIndex(entry => entryKey(entry) === key);
  const before = held[at];
  const after = next(before);
  const entries =
    at === -1
      ? [...held, after]
      : held.map((entry, index) => (index === at ? after : entry));
  writeUsualStores(
    cache,
    homeId,
    entries.filter(entry => entry !== null),
  );
  return before;
}

/**
 * An entry the server has not named yet, under a minted id, completed from
 * what the cache holds on its store. A store's chain is the entry's, as the
 * API answers it.
 */
export function localUsualStore(
  cache: ApolloCache,
  choice: StoreChoice,
  addedVia: UsualStoreSource,
  now: string,
): UsualStoreEntry | null {
  const id = `${LOCAL_ID_PREFIX}${storeChoiceKey(choice)}`;
  writeLocalEntity(cache, {
    fragment: UsualStores_RowFragmentDoc,
    fragmentName: 'usualStores_row',
    neutral: NEUTRAL_LOCAL_USUAL_STORE,
    neutralByType: NEUTRAL_LOCAL_USUAL_STORE_BY_TYPE,
    known: {
      __typename: 'UsualStore',
      id,
      addedVia,
      pinned: false,
      compared: true,
      lastUsedAt: now,
      store: choice.store ? { __typename: 'Store', ...choice.store } : null,
      chain: choice.chain
        ? { __typename: 'StoreChain', ...choice.chain }
        : undefined,
    },
  });
  const entry = cache.readFragment<UsualStoreEntry>({
    id: cache.identify({ __typename: 'UsualStore', id }),
    fragment: UsualStores_RowFragmentDoc,
    fragmentName: 'usualStores_row',
    optimistic: true,
  });
  if (!entry) return null;
  return { ...entry, chain: entry.chain ?? entry.store?.chain ?? null };
}
