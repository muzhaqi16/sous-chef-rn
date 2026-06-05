/**
 * Local-first pantry creation cache plumbing.
 *
 * Materializes a complete Pantry entity — including zeroed `stats` and empty
 * `itemsConnection` / `storageLocationsConnection` variants — BEFORE the
 * create mutation fires, so a pantry created offline renders immediately and
 * accepts local-first item adds (a `cache.modify` edge write needs an existing
 * connection variant to land in). The queued replay re-sends the original
 * `CreatePantry` keyed by the client-minted `input.id`; the FIFO parent-create
 * guard replays it before any items queued behind it.
 */

import { gql, type ApolloCache, type Reference } from '@apollo/client';
import { PAGE_SIZE } from '#/constants/pagination';
import { safeEvict, type ConnectionData } from '#/apollo/utils/cacheUpdaters';

export type OptimisticPantry = {
  __typename: 'Pantry';
  id: string;
  homeId: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Entity + zeroed stats (what the pantry screen header/stats read). */
const OptimisticPantryFragment = gql`
  fragment _OptimisticPantry on Pantry {
    id
    homeId
    name
    description
    isDefault
    version
    createdAt
    updatedAt
    stats {
      totalItems
      activeItems
      expiringCount
      lowStockCount
      totalValue
      storageStateCounts {
        refrigerated
        frozen
        ambient
      }
      storageLocationCounts {
        storageLocationId
        name
        type
        itemCount
      }
    }
  }
`;

/**
 * The no-args itemsConnection variant. `keyArgs: ['filters', 'orderBy']` and
 * the default pantry screen passes both as undefined, so this writes the same
 * storeFieldName the screen reads.
 */
const PantryEmptyItemsFragment = gql`
  fragment _PantryEmptyItems on Pantry {
    itemsConnection {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
      }
    }
  }
`;

/**
 * storageLocationsConnection has default keyArgs (all args), so the seeded
 * variant must match the screen's `first` page size exactly — passed as a
 * variable so it tracks PAGE_SIZE.COMPACT.
 */
const PantryEmptyStorageLocationsFragment = gql`
  fragment _PantryEmptyStorageLocations on Pantry {
    storageLocationsConnection(first: $first) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        cursor
      }
    }
  }
`;

export function buildOptimisticPantry(
  id: string,
  input: {
    homeId: string;
    name: string;
    description?: string | null;
    isDefault?: boolean | null;
  },
): OptimisticPantry {
  const now = new Date().toISOString();
  return {
    __typename: 'Pantry',
    id,
    homeId: input.homeId,
    name: input.name,
    description: input.description ?? null,
    isDefault: input.isDefault ?? false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

const EMPTY_CONNECTION = {
  totalCount: 0,
  pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
  edges: [],
};

/** Write the full entity + zeroed stats + empty connection variants. */
export function writeOptimisticPantry(
  cache: ApolloCache,
  pantry: OptimisticPantry,
): void {
  const cacheId = cache.identify(pantry);
  cache.writeFragment({
    id: cacheId,
    fragment: OptimisticPantryFragment,
    fragmentName: '_OptimisticPantry',
    data: {
      ...pantry,
      stats: {
        __typename: 'PantryStats',
        totalItems: 0,
        activeItems: 0,
        expiringCount: 0,
        lowStockCount: 0,
        totalValue: 0,
        storageStateCounts: {
          __typename: 'StorageStateCounts',
          refrigerated: 0,
          frozen: 0,
          ambient: 0,
        },
        storageLocationCounts: [],
      },
    },
  });
  cache.writeFragment({
    id: cacheId,
    fragment: PantryEmptyItemsFragment,
    fragmentName: '_PantryEmptyItems',
    data: {
      itemsConnection: {
        __typename: 'PantryItemConnection',
        ...EMPTY_CONNECTION,
      },
    },
  });
  cache.writeFragment({
    id: cacheId,
    fragment: PantryEmptyStorageLocationsFragment,
    fragmentName: '_PantryEmptyStorageLocations',
    variables: { first: PAGE_SIZE.COMPACT },
    data: {
      storageLocationsConnection: {
        __typename: 'StorageLocationConnection',
        ...EMPTY_CONNECTION,
      },
    },
  });
}

/**
 * Add a pantry to its home's `pantries` array and `pantriesConnection` —
 * idempotent by pantry id, shared by the local-first pre-fire write and the
 * mutation's update callback (the server row carries the same client-minted
 * id, so it merges instead of duplicating).
 */
export function addPantryToHomeCache(
  cache: ApolloCache,
  homeId: string,
  pantry: { id: string },
): void {
  const homeCacheId = cache.identify({ __typename: 'Home', id: homeId });
  if (!homeCacheId) return;

  cache.modify({
    id: homeCacheId,
    fields: {
      pantries(
        existingPantries: readonly Reference[] = [],
        { readField, toReference },
      ) {
        const newPantryRef = toReference(pantry);
        const exists = existingPantries.some(
          pantryRef => readField('id', pantryRef) === pantry.id,
        );
        if (exists || !newPantryRef) return existingPantries;
        return [...existingPantries, newPantryRef];
      },
      pantriesConnection(
        existingConnection: ConnectionData | null = null,
        { readField, toReference },
      ) {
        if (!existingConnection) return existingConnection;
        const exists = (existingConnection.edges ?? []).some(
          edge => readField('id', edge?.node) === pantry.id,
        );
        if (exists) return existingConnection;
        const newPantryRef = toReference(pantry);
        if (!newPantryRef) return existingConnection;
        const newEdge = {
          __typename: 'PantryEdge',
          cursor: pantry.id,
          node: newPantryRef,
        };
        return {
          ...existingConnection,
          edges: [...(existingConnection.edges || []), newEdge],
          totalCount:
            (existingConnection.totalCount ??
              (existingConnection.edges?.length || 0)) + 1,
        };
      },
    },
  });
}

/** Reverse the optimistic pantry create (rejected by the server). */
export function removeOptimisticPantry(
  cache: ApolloCache,
  homeId: string,
  pantryId: string,
): void {
  const homeCacheId = cache.identify({ __typename: 'Home', id: homeId });
  if (homeCacheId) {
    cache.modify({
      id: homeCacheId,
      fields: {
        pantries(existingPantries: readonly Reference[] = [], { readField }) {
          return existingPantries.filter(
            pantryRef => readField('id', pantryRef) !== pantryId,
          );
        },
        pantriesConnection(
          existingConnection: ConnectionData | null = null,
          { readField },
        ) {
          if (!existingConnection) return existingConnection;
          const edges = (existingConnection.edges ?? []).filter(
            edge => readField('id', edge?.node) !== pantryId,
          );
          if (edges.length === (existingConnection.edges?.length ?? 0)) {
            return existingConnection;
          }
          return {
            ...existingConnection,
            edges,
            totalCount: Math.max(0, (existingConnection.totalCount ?? 1) - 1),
          };
        },
      },
    });
  }
  safeEvict(cache, 'Pantry', pantryId);
}
