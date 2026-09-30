import { useApolloClient, useMutation } from '@apollo/client/react';
import type { ApolloCache } from '@apollo/client';
import { CreateStorageLocationDocument } from '#features/catalog/graphql/storageLocation.generated';
import { UseCreateStorageLocation_RowFragmentDoc } from './useCreateStorageLocation.generated';
import {
  NEUTRAL_LOCAL_STORAGE_LOCATION,
  NEUTRAL_LOCAL_STORAGE_LOCATION_BY_TYPE,
} from './useCreateStorageLocationNeutral.generated';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import type { CreateStorageLocationInput } from '#/graphql/generated/schemaTypes';
import {
  createAddToQueryConnectionUpdater,
  createAddToParentConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  skipUnmatchedArgVariants,
  type AddToConnectionOptions,
} from '#/apollo/utils/cacheUpdaters';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { appliedPayload } from '#/utils/errors/mutationPayload';
import { generateEntityId } from '#/utils/generateEntityId';
import { alertService } from '#/services/alertService';
import { useTranslation } from '#/i18n';
import { errorService } from '#/services/errorService';

type CreateLocationInput = Omit<CreateStorageLocationInput, 'homeId'>;

/** The reference the connection writes identify a location by. */
type LocationRef = { __typename: 'StorageLocation'; id: string };

const addToStorageLocationsCache =
  createAddToQueryConnectionUpdater<LocationRef>(
    'storageLocations',
    'StorageLocation',
  );
const addToPantryLocations = createAddToParentConnectionUpdater<LocationRef>(
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

/**
 * Write the location a create makes, complete for every screen that reads one,
 * so it renders as a filter tab at once and survives a queued create. A nested
 * create names its parent, which the cache completes from what it holds.
 */
function writeLocalStorageLocation(
  cache: ApolloCache,
  id: string,
  input: CreateLocationInput,
): void {
  writeLocalEntity(cache, {
    fragment: UseCreateStorageLocation_RowFragmentDoc,
    fragmentName: 'useCreateStorageLocation_row',
    neutral: NEUTRAL_LOCAL_STORAGE_LOCATION,
    neutralByType: NEUTRAL_LOCAL_STORAGE_LOCATION_BY_TYPE,
    known: {
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
      parentLocation: input.parentLocationId
        ? { __typename: 'StorageLocation', id: input.parentLocationId }
        : null,
    },
  });
}

/** `storageLocations` is keyed by `homeId`; a location joins its own home's list only. */
const ownHomeOnly = (homeId: string): AddToConnectionOptions => ({
  position: 'end',
  skipStoreField: skipUnmatchedArgVariants({ homeId }),
});

function publishLocation(
  cache: ApolloCache,
  id: string,
  homeId: string,
  pantryId: string | undefined,
): void {
  const location: LocationRef = { __typename: 'StorageLocation', id };
  try {
    addToStorageLocationsCache(cache, location, ownHomeOnly(homeId));
    if (pantryId) {
      addToPantryLocations(cache, pantryId, location, { position: 'end' });
    }
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: 'Create Storage Location (optimistic)',
    });
  }
}

function revertOptimisticLocation(
  cache: ApolloCache,
  id: string,
  pantryId: string | undefined,
): void {
  try {
    removeFromStorageLocationsCache(cache, id, { evictItem: false });
    if (pantryId) {
      removeFromPantryLocations(cache, pantryId, id, { evictItem: false });
    }
    const cacheId = cache.identify({ __typename: 'StorageLocation', id });
    if (cacheId) {
      cache.evict({ id: cacheId });
      cache.gc();
    }
  } catch (cacheError) {
    errorService.reportError(cacheError, {
      operation: 'Revert Storage Location create',
    });
  }
}

/**
 * Creates a storage location local-first: the client-minted id is written to
 * the `storageLocations` query and `Pantry.storageLocationsConnection` before
 * firing, so a queued create replays under the same primary key. Reverted on a
 * real rejection.
 */
export function useCreateStorageLocation(
  homeId: string | undefined,
  pantryId: string | undefined,
) {
  const { t } = useTranslation();
  const client = useApolloClient();

  const [createMutation, { loading: creating }] = useMutation(
    CreateStorageLocationDocument,
    {
      context: { localFirst: true },
      update: (cache, { data }) => {
        // On the server response, adopt the authoritative node fields. The
        // optimistic edge already exists (same id), so the dedup guard makes
        // this a field-merge rather than a duplicate edge.
        const payload = appliedPayload(data);
        if (!payload) return;
        const newLocation = payload.storageLocation;
        try {
          addToStorageLocationsCache(
            cache,
            newLocation,
            ownHomeOnly(newLocation.homeId),
          );
          if (pantryId) {
            addToPantryLocations(cache, pantryId, newLocation, {
              position: 'end',
            });
          }
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Cache update failed for createStorageLocation:',
          });
        }
      },
    },
  );

  const createLocation = async (input: CreateLocationInput) => {
    if (!homeId) {
      alertService.alert(t('labels.error'), t('errors.parentContextRequired'));
      return false;
    }

    // Local-first: mint the permanent id, write the location to cache before
    // firing, and queue the create when offline (the hook's `localFirst`).
    const id = generateEntityId();
    try {
      writeLocalStorageLocation(client.cache, id, input);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Create Storage Location (optimistic)',
      });
    }
    publishLocation(client.cache, id, homeId, pantryId);

    const settled = await settleMutation(
      () =>
        createMutation({
          variables: { input: { ...input, homeId, id } },
        }),
      {
        document: CreateStorageLocationDocument,
        fallback: t('errors.createStorageLocationFailed'),
        onFailed: () => revertOptimisticLocation(client.cache, id, pantryId),
      },
    );
    // Created (server confirmed) or queued (offline / API down) — the location
    // stays; on 'applied' the update callback adopted the server fields.
    return settled.status !== 'failed';
  };

  return { createLocation, creating };
}
