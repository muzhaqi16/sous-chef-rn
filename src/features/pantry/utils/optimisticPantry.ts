/**
 * Local-first pantry creation. Writes a COMPLETE pantry — zeroed stats, empty
 * connection variants — before the create fires: an incomplete entity reads as
 * no data at all, and a `cache.modify` edge write needs a variant to land in.
 */

import type { ApolloCache, Reference } from '@apollo/client';
import { PAGE_SIZE } from '#features/pantry/constants/pagination';
import { safeEvict, type ConnectionData } from '#/apollo/utils/cacheUpdaters';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import { todayKey } from '#/utils/dateUtils';
import { OptimisticPantry_RowFragmentDoc } from './optimisticPantry.generated';
import {
  NEUTRAL_LOCAL_PANTRY,
  NEUTRAL_LOCAL_PANTRY_BY_TYPE,
} from './optimisticPantryNeutral.generated';

/** Write the pantry a create makes, complete for every screen that reads one. */
export function writeLocalPantry(
  cache: ApolloCache,
  id: string,
  input: {
    homeId: string;
    name: string;
    description?: string | null;
    isDefault?: boolean | null;
  },
): void {
  writeLocalEntity(cache, {
    fragment: OptimisticPantry_RowFragmentDoc,
    fragmentName: 'optimisticPantry_row',
    neutral: NEUTRAL_LOCAL_PANTRY,
    neutralByType: NEUTRAL_LOCAL_PANTRY_BY_TYPE,
    known: {
      __typename: 'Pantry',
      id,
      homeId: input.homeId,
      name: input.name,
      description: input.description ?? null,
      isDefault: input.isDefault ?? false,
      version: 1,
    },
    variables: { today: todayKey(), first: PAGE_SIZE.COMPACT },
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
  // `toReference` identifies the pantry by `__typename`.
  pantry: { __typename: 'Pantry'; id: string },
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
          edge => readField('id', edge.node) === pantry.id,
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
          edges: [...(existingConnection.edges ?? []), newEdge],
          totalCount:
            (existingConnection.totalCount ??
              existingConnection.edges?.length ??
              0) + 1,
        };
      },
    },
  });
}

/**
 * Take a pantry out of its home's lists. Reversing a rejected CREATE evicts (the
 * entity only ever existed locally); a local-first DELETE passes
 * `evictEntity: false`, since a refusal has to put the row back.
 */
export function removeOptimisticPantry(
  cache: ApolloCache,
  homeId: string,
  pantryId: string,
  options: { evictEntity?: boolean } = {},
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
            edge => readField('id', edge.node) !== pantryId,
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
  if (options.evictEntity !== false) {
    safeEvict(cache, 'Pantry', pantryId);
  }
}

/**
 * Mirror of {@link removeOptimisticPantry}'s non-evicting form: the entity is
 * still cached, so only the two membership fields need repairing. Idempotent.
 */
export function restorePantryToHomeCache(
  cache: ApolloCache,
  homeId: string,
  pantryId: string,
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
        if (existingPantries.some(ref => readField('id', ref) === pantryId)) {
          return existingPantries;
        }
        const ref = toReference({ __typename: 'Pantry', id: pantryId });
        return ref ? [...existingPantries, ref] : existingPantries;
      },
      pantriesConnection(
        existingConnection: ConnectionData | null = null,
        { readField, toReference },
      ) {
        if (!existingConnection) return existingConnection;
        const edges = existingConnection.edges ?? [];
        if (edges.some(edge => readField('id', edge.node) === pantryId)) {
          return existingConnection;
        }
        const node = toReference({ __typename: 'Pantry', id: pantryId });
        if (!node) return existingConnection;
        return {
          ...existingConnection,
          edges: [
            ...edges,
            { __typename: 'PantryEdge', cursor: pantryId, node },
          ],
          totalCount: (existingConnection.totalCount ?? edges.length) + 1,
        };
      },
    },
  });
}
