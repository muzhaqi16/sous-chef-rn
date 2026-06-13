import { useApolloClient, useMutation } from '@apollo/client/react';
import { gql, type ApolloCache } from '@apollo/client';
import {
  CreateStorageLocationDocument,
  type CreateStorageLocationMutation,
} from '#operations/storageLocation/storageLocation.generated';
import { type CreateStorageLocationInput } from '#/graphql/generated/schemaTypes';
import {
  createAddToQueryConnectionUpdater,
  createAddToParentConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';
import { generateEntityId } from '#/utils/generateEntityId';
import { handleMutationError } from '#/utils/errorHandlers';
import { alertService } from '#/services/alertService';
import { t } from '#/i18n/t';

/** The StorageLocation node shape returned by (and written for) the create. */
type StorageLocationNode = Extract<
  NonNullable<CreateStorageLocationMutation['createStorageLocation']>,
  { __typename: 'CreateStorageLocationPayload' }
>['storageLocation'];

type CreateLocationInput = Omit<CreateStorageLocationInput, 'homeId'>;

type ParentRef = StorageLocationNode['parentLocation'];

// Minimal read of a parent location so a nested create nests correctly offline.
const PARENT_LOCATION_FRAGMENT = gql`
  fragment StorageLocationParentRef on StorageLocation {
    id
    name
  }
`;

function readParentLocation(
  cache: ApolloCache,
  parentLocationId: string | null | undefined,
): ParentRef {
  if (!parentLocationId) return null;
  const parent = cache.readFragment<{ id: string; name: string }>({
    id: cache.identify({
      __typename: 'StorageLocation',
      id: parentLocationId,
    }),
    fragment: PARENT_LOCATION_FRAGMENT,
  });
  // Nesting keys on parentLocation.id; the name is cosmetic (not shown in tabs)
  // and self-corrects from the server response on sync.
  return {
    __typename: 'StorageLocation',
    id: parentLocationId,
    name: parent?.name ?? '',
  };
}

const addToStorageLocationsCache =
  createAddToQueryConnectionUpdater<StorageLocationNode>(
    'storageLocations',
    'StorageLocation',
  );
const addToPantryLocations =
  createAddToParentConnectionUpdater<StorageLocationNode>(
    'Pantry',
    'storageLocationsConnection',
    'StorageLocation',
  );
const removeFromStorageLocationsCache = createRemoveFromQueryConnectionUpdater(
  'storageLocations',
  'StorageLocation',
);
const removeFromPantryLocations = createRemoveFromParentConnectionUpdater(
  'Pantry',
  'storageLocationsConnection',
  'StorageLocation',
);

// Materialize the full StorageLocation node from the create input so the new
// location renders as a FilterTab instantly and survives an offline/queued
// create. Server-computed fields get safe defaults; a nested create reads its
// parent {id,name} from cache so it nests correctly even offline.
function buildOptimisticStorageLocation(
  cache: ApolloCache,
  id: string,
  input: CreateLocationInput,
  homeId: string,
): StorageLocationNode {
  return {
    __typename: 'StorageLocation',
    id,
    name: input.name,
    type: input.type,
    icon: input.icon ?? null,
    color: input.color ?? null,
    temperature: input.temperature ?? null,
    description: input.description ?? null,
    isClimateControlled: input.isClimateControlled ?? false,
    capacity: input.capacity ?? null,
    capacityUnit: input.capacityUnit ?? null,
    sortOrder: input.sortOrder ?? 0,
    isDefault: input.isDefault ?? false,
    currentItemCount: 0,
    homeId,
    parentLocation: readParentLocation(cache, input.parentLocationId),
  };
}

function writeOptimisticLocation(
  cache: ApolloCache,
  location: StorageLocationNode,
  pantryId: string | undefined,
): void {
  executeCacheUpdate(() => {
    addToStorageLocationsCache(cache, location, { position: 'end' });
    if (pantryId) {
      addToPantryLocations(cache, pantryId, location, { position: 'end' });
    }
  }, 'Create Storage Location (optimistic)');
}

function revertOptimisticLocation(
  cache: ApolloCache,
  id: string,
  pantryId: string | undefined,
): void {
  executeCacheUpdate(() => {
    removeFromStorageLocationsCache(cache, id, { evictItem: false });
    if (pantryId) {
      removeFromPantryLocations(cache, pantryId, id, { evictItem: false });
    }
    const cacheId = cache.identify({ __typename: 'StorageLocation', id });
    if (cacheId) {
      cache.evict({ id: cacheId });
      cache.gc();
    }
  }, 'Revert Storage Location create');
}

/**
 * Lightweight hook for creating a storage location (local-first).
 *
 * Mints the location's id client-side and writes it into the cache before
 * firing, so it appears as a FilterTab instantly and survives an
 * offline/queued create — the server stores `input.id` as the primary key and
 * the queue replays the create keyed by that same id (a duplicate replay
 * surfaces as a ConflictError, which the queue drops). Both the
 * StorageLocationsScreen cache (`storageLocations` query) and PantryMain's
 * `Pantry.storageLocationsConnection` are updated. On a real rejection the
 * optimistic location is reverted.
 */
export function useCreateStorageLocation(
  homeId: string | undefined,
  pantryId: string | undefined,
) {
  const client = useApolloClient();

  const [createMutation, { loading: creating }] = useMutation(
    CreateStorageLocationDocument,
    {
      update: (cache, { data }) => {
        // On the server response, adopt the authoritative node fields. The
        // optimistic edge already exists (same id), so the dedup guard makes
        // this a field-merge rather than a duplicate edge.
        if (
          data?.createStorageLocation?.__typename !==
          'CreateStorageLocationPayload'
        ) {
          return;
        }
        const newLocation = data.createStorageLocation.storageLocation;
        executeCacheUpdate(() => {
          addToStorageLocationsCache(cache, newLocation, { position: 'end' });
          if (pantryId) {
            addToPantryLocations(cache, pantryId, newLocation, {
              position: 'end',
            });
          }
        }, 'Cache update failed for createStorageLocation:');
      },
    },
  );

  const createLocation = async (input: CreateLocationInput) => {
    if (!homeId) {
      alertService.alert(t('labels.error'), t('errors.parentContextRequired'));
      return false;
    }

    // Local-first: mint the permanent id, write the location to cache before
    // firing, and queue the create when offline (context.localFirst).
    const id = generateEntityId();
    const optimistic = buildOptimisticStorageLocation(
      client.cache,
      id,
      input,
      homeId,
    );
    writeOptimisticLocation(client.cache, optimistic, pantryId);

    const result = await createMutation({
      variables: { input: { ...input, homeId, id } },
      context: { localFirst: true },
    });

    const outcome = classifyCreateResult(
      result,
      'createStorageLocation',
      'CreateStorageLocationPayload',
    );

    if (outcome === 'rejected') {
      // The server refused the create — discard the location we showed and
      // surface a real (non-network) error; a non-success payload has none.
      revertOptimisticLocation(client.cache, id, pantryId);
      if (result.error) {
        handleMutationError(result.error, {
          operation: 'Create Storage Location',
        });
      } else {
        alertService.alert(
          t('labels.error'),
          t('errors.createStorageLocationFailed'),
        );
      }
      return false;
    }

    // Created (server confirmed) or queued (offline / API down) — keep the
    // location. On 'created' the update callback adopted the server fields.
    const payload = result.data?.createStorageLocation;
    if (payload?.__typename === 'CreateStorageLocationPayload') {
      return payload.storageLocation;
    }
    return optimistic;
  };

  return { createLocation, creating };
}
