import { useMutation } from '@apollo/client/react';
import { CreateStorageLocationDocument } from '../../graphql/operations/storageLocation/storageLocation.generated';
import { type CreateStorageLocationInput } from '../../graphql/generated/schemaTypes';
import { useCrudOperations } from '#/hooks/utils/useCrudOperations';
import {
  createAddToQueryConnectionUpdater,
  createAddToParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { executeCacheUpdate } from '#/utils/compilerSafeWrappers';

/**
 * Lightweight hook for creating a storage location from PantryMain.
 *
 * Updates both the StorageLocationsScreen cache (query connection) and
 * the PantryMain cache (parent Pantry.storageLocationsConnection) so
 * a newly created location appears as a FilterTab immediately.
 */
export function useCreateStorageLocation(
  homeId: string | undefined,
  pantryId: string | undefined,
) {
  const { createAddOperation } = useCrudOperations();

  const [createMutation, { loading: creating }] = useMutation(
    CreateStorageLocationDocument,
    {
      update: (cache, { data }) => {
        const newLocation = data?.createStorageLocation?.storageLocation;
        if (!newLocation) return;

        executeCacheUpdate(() => {
          // Keep the StorageLocationsScreen query cache warm
          const addToStorageLocationsCache = createAddToQueryConnectionUpdater(
            'storageLocations',
            'StorageLocation',
          );
          addToStorageLocationsCache(cache, newLocation, {
            position: 'end',
          });

          // Update PantryMain's tabs immediately via the parent Pantry connection
          if (pantryId) {
            const addToPantryLocations = createAddToParentConnectionUpdater(
              'Pantry',
              'storageLocationsConnection',
              'StorageLocation',
            );
            addToPantryLocations(cache, pantryId, newLocation, {
              position: 'end',
            });
          }
        }, 'Cache update failed for createStorageLocation:');
      },
    },
  );

  const createLocation = createAddOperation({
    mutation: createMutation,
    parentId: () => homeId,
    transformInput: (input: Omit<CreateStorageLocationInput, 'homeId'>) => ({
      ...input,
      homeId,
    }),
    onSuccess: (data: any) => data?.createStorageLocation?.storageLocation,
    operationName: 'Create Storage Location',
  });

  return { createLocation, creating };
}
