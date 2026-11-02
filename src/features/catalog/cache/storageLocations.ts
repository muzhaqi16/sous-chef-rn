import type { ApolloCache } from '@apollo/client';
import {
  createAddToParentConnectionUpdater,
  createAddToQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  skipUnmatchedArgVariants,
} from '#/apollo/utils/cacheUpdaters';
import { writeLocalEntity } from '#/apollo/utils/writeLocalEntity';
import type { CreateStorageLocationInput } from '#/graphql/generated/schemaTypes';
import { UseCreateStorageLocation_RowFragmentDoc } from '#features/catalog/hooks/useCreateStorageLocation.generated';
import {
  NEUTRAL_LOCAL_STORAGE_LOCATION,
  NEUTRAL_LOCAL_STORAGE_LOCATION_BY_TYPE,
} from '#features/catalog/hooks/useCreateStorageLocationNeutral.generated';

/** What a create states about the location, under the id it minted. */
export type LocalStorageLocation = Omit<
  CreateStorageLocationInput,
  'homeId'
> & {
  id: string;
};

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
 * so it renders as a filter tab at once. A nested create names its parent, which
 * the cache completes from what it holds.
 */
export function writeLocalStorageLocation(
  cache: ApolloCache,
  input: LocalStorageLocation,
): void {
  writeLocalEntity(cache, {
    fragment: UseCreateStorageLocation_RowFragmentDoc,
    fragmentName: 'useCreateStorageLocation_row',
    neutral: NEUTRAL_LOCAL_STORAGE_LOCATION,
    neutralByType: NEUTRAL_LOCAL_STORAGE_LOCATION_BY_TYPE,
    known: {
      __typename: 'StorageLocation',
      id: input.id,
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

/** Lists a location in its own home's list only: `storageLocations` is keyed by `homeId`. */
export function listStorageLocation(
  cache: ApolloCache,
  id: string,
  homeId: string,
  pantryId: string | undefined,
): void {
  const location: LocationRef = { __typename: 'StorageLocation', id };
  addToStorageLocationsCache(cache, location, {
    position: 'end',
    skipStoreField: skipUnmatchedArgVariants({ homeId }),
  });
  if (pantryId) {
    addToPantryLocations(cache, pantryId, location, { position: 'end' });
  }
}

/** Takes a location out of both lists; `evictItem` does nothing in a layer. */
export function unlistStorageLocation(
  cache: ApolloCache,
  id: string,
  pantryId: string | undefined,
  { evictItem }: { evictItem: boolean },
): void {
  if (pantryId) removeFromPantryLocations(cache, pantryId, id);
  removeFromStorageLocationsCache(cache, id, { evictItem });
}
