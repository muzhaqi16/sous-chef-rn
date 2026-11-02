import { skipToken, useQuery } from '@apollo/client/react';
import type { UsualStoreSource } from '#/graphql/generated/schemaTypes';
import { chainOption, storeOption, type StoreOption } from '#domain/stores';
import type { UsualStoreEntry } from '#features/catalog/cache/usualStores';
import { usePreservedQueryData } from '#hooks/apollo/usePreservedQueryData';
import { UsualStoresDocument } from './useUsualStores.generated';

/** A usual store as a row shows it. */
export interface UsualStoreRow extends StoreOption {
  pinned: boolean;
  /** The server's: pinned, or used within 90 days. */
  compared: boolean;
  addedVia: UsualStoreSource;
  lastUsedAt: string | null;
}

const toRow = (entry: UsualStoreEntry): UsualStoreRow | null => {
  const option = entry.store
    ? storeOption(entry.store, { added: true })
    : entry.chain
    ? chainOption(entry.chain, true)
    : null;
  if (!option) return null;
  return {
    ...option,
    pinned: entry.pinned,
    compared: entry.compared,
    addedVia: entry.addedVia,
    lastUsedAt: entry.lastUsedAt,
  };
};

const lastUsed = (row: UsualStoreRow) =>
  row.lastUsedAt ? Date.parse(row.lastUsedAt) : 0;

// The API's order, kept after a local pin: pinned, compared, then most recent.
const byUse = (a: UsualStoreRow, b: UsualStoreRow) =>
  Number(b.pinned) - Number(a.pinned) ||
  Number(b.compared) - Number(a.compared) ||
  lastUsed(b) - lastUsed(a);

/**
 * A household's usual stores (`homeId` null: the caller's own), pinned first,
 * then by most recent use; null until read, and while `skip`. The usual-stores
 * screen reads `cache-and-network`, so another member's change shows on each
 * open.
 */
export function useUsualStores(
  homeId: string | null,
  {
    fetchPolicy,
    skip = false,
  }: { fetchPolicy: 'cache-first' | 'cache-and-network'; skip?: boolean },
) {
  const { data, loading, error, refetch } = useQuery(
    UsualStoresDocument,
    skip ? skipToken : { variables: { homeId }, fetchPolicy },
  );

  // A skipped query keeps its last answer, which may be another household's.
  const answered = skip ? undefined : data?.usualStores;
  const preserved = usePreservedQueryData(answered, undefined, homeId ?? '');
  const entries = skip ? undefined : preserved;
  return {
    stores: entries
      ? entries.flatMap(entry => toRow(entry) ?? []).sort(byUse)
      : null,
    loading: loading && !entries,
    /** Only while nothing is cached: a failed refresh keeps the list. */
    error: entries ? undefined : error,
    refetch,
  };
}
