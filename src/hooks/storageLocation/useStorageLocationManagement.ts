import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useGetStorageLocationsQuery,
  useGetStorageLocationTreeQuery,
  useCreateStorageLocationMutation,
  useUpdateStorageLocationMutation,
  useDeleteStorageLocationMutation,
  useSetDefaultStorageLocationMutation,
  GetStorageLocationsDocument,
  CreateStorageLocationInput,
  UpdateStorageLocationInput,
} from '#generated';

/**
 * Build a tree structure from a flat list of locations using parentLocation references
 */
function buildTreeFromFlatList(locations: any[]): any[] {
  if (!locations || locations.length === 0) return [];

  // Create a map for quick lookup
  const locationMap = new Map(locations.map(loc => [loc.id, { ...loc, childLocations: [] }]));

  // Array to hold root locations (locations without a parent)
  const roots: any[] = [];

  // Build the tree structure
  locations.forEach(location => {
    const node = locationMap.get(location.id);
    if (!node) return;

    if (location.parentLocation?.id) {
      // This location has a parent, add it to parent's children
      const parent = locationMap.get(location.parentLocation.id);
      if (parent) {
        parent.childLocations.push(node);
      } else {
        // Parent not found, treat as root
        roots.push(node);
      }
    } else {
      // No parent, this is a root location
      roots.push(node);
    }
  });

  // Sort roots and children by sortOrder
  const sortBySortOrder = (a: any, b: any) => a.sortOrder - b.sortOrder;
  roots.sort(sortBySortOrder);
  roots.forEach(function sortChildren(node) {
    if (node.childLocations && node.childLocations.length > 0) {
      node.childLocations.sort(sortBySortOrder);
      node.childLocations.forEach(sortChildren);
    }
  });

  return roots;
}

/**
 * Hook for managing storage locations in a home
 * Follows the same pattern as useShoppingListManagement and usePantryManagement
 */
export function useStorageLocationManagement(homeId: string | undefined) {
  const shouldSkip = !homeId;

  // Queries
  const { data, loading, error, refetch } = useGetStorageLocationsQuery({
    variables: { homeId: homeId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  const { data: treeData } = useGetStorageLocationTreeQuery({
    variables: { homeId: homeId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',
  });

  // Mutations
  const [createMutation, { loading: creating }] =
    useCreateStorageLocationMutation({
      update: (cache, { data }) => {
        if (!data?.createStorageLocation || !homeId) return;

        try {
          const newLocation = data.createStorageLocation;

          // Read the existing cached query for this homeId
          const existingData = cache.readQuery({
            query: GetStorageLocationsDocument,
            variables: { homeId },
          }) as { storageLocations: any[] } | null;

          if (existingData?.storageLocations) {
            // Check if location already exists (avoid duplicates)
            const exists = existingData.storageLocations.some(
              (loc: any) => loc.id === newLocation.id,
            );

            if (!exists) {
              // Write back with the new location added
              cache.writeQuery({
                query: GetStorageLocationsDocument,
                variables: { homeId },
                data: {
                  storageLocations: [
                    ...existingData.storageLocations,
                    newLocation,
                  ],
                },
              });
            }
          }
        } catch (error) {
          console.warn('Cache update failed for createStorageLocation:', error);
          // Fallback: refetch on cache update failure
          refetch();
        }
      },
      onError: error => {
        const message = error.message || 'Failed to create storage location';
        Alert.alert('Error', message);
      },
    });

  const [updateMutation, { loading: updating }] =
    useUpdateStorageLocationMutation({
      // Update mutation automatically updates the cache for modified fields
      // No manual cache update needed - Apollo handles it automatically
      onError: error => {
        const message = error.message || 'Failed to update storage location';
        Alert.alert('Error', message);
      },
    });

  const [deleteMutation] = useDeleteStorageLocationMutation({
    update: (cache, { data }, { variables }) => {
      if (!data?.deleteStorageLocation || !variables || !homeId) return;

      try {
        const deletedId = variables.id;

        // Read the existing cached query for this homeId
        const existingData = cache.readQuery({
          query: GetStorageLocationsDocument,
          variables: { homeId },
        }) as { storageLocations: any[] } | null;

        if (existingData?.storageLocations) {
          // Filter out the deleted location
          cache.writeQuery({
            query: GetStorageLocationsDocument,
            variables: { homeId },
            data: {
              storageLocations: existingData.storageLocations.filter(
                (loc: any) => loc.id !== deletedId,
              ),
            },
          });
        }

        // Evict the deleted location from cache
        cache.evict({
          id: cache.identify({ __typename: 'StorageLocation', id: deletedId }),
        });
        cache.gc(); // Garbage collect orphaned data
      } catch (error) {
        console.warn('Cache update failed for deleteStorageLocation:', error);
        refetch();
      }
    },
    onError: error => {
      const message =
        error.message || 'Cannot delete location with items or child locations';
      Alert.alert('Error', message);
    },
  });

  const [setDefaultMutation] = useSetDefaultStorageLocationMutation({
    // SetDefault mutation returns the updated location with isDefault field
    // Apollo automatically updates the cache for this location
    // No manual cache update needed
    onError: error => {
      Alert.alert('Error', error.message || 'Failed to set default location');
    },
  });

  // Action handlers
  const createLocation = useCallback(
    async (input: Omit<CreateStorageLocationInput, 'homeId'>) => {
      if (!homeId) return false;

      try {
        const result = await createMutation({
          variables: {
            input: {
              ...input,
              homeId,
            },
          },
        });

        return result.data?.createStorageLocation ?? false;
      } catch (error) {
        console.error('Create storage location error:', error);
        return false;
      }
    },
    [homeId, createMutation],
  );

  const updateLocation = useCallback(
    async (id: string, input: UpdateStorageLocationInput) => {
      try {
        const result = await updateMutation({
          variables: { id, input },
        });

        return result.data?.updateStorageLocation ?? false;
      } catch (error) {
        console.error('Update storage location error:', error);
        return false;
      }
    },
    [updateMutation],
  );

  const deleteLocation = useCallback(
    async (id: string) => {
      try {
        const result = await deleteMutation({
          variables: { id },
        });

        return result.data?.deleteStorageLocation ?? false;
      } catch (error) {
        console.error('Delete storage location error:', error);
        return false;
      }
    },
    [deleteMutation],
  );

  const setDefaultLocation = useCallback(
    async (id: string) => {
      try {
        const result = await setDefaultMutation({
          variables: { id },
        });

        return result.data?.setDefaultStorageLocation ?? false;
      } catch (error) {
        console.error('Set default storage location error:', error);
        return false;
      }
    },
    [setDefaultMutation],
  );

  // Build tree from flat list if tree query returns empty
  const locations = data?.storageLocations ?? [];
  const treeFromQuery = treeData?.storageLocationTree ?? [];
  const tree = treeFromQuery.length > 0 ? treeFromQuery : buildTreeFromFlatList(locations);

  return {
    // Data
    locations,
    tree,
    loading,
    initialLoading: !data && loading,
    creating,
    updating,
    error,

    // Actions
    createLocation,
    updateLocation,
    deleteLocation,
    setDefaultLocation,
    refetch,
  };
}
