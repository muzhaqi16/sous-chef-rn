import { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  useGetStorageLocationsQuery,
  useGetStorageLocationTreeQuery,
  useCreateStorageLocationMutation,
  useUpdateStorageLocationMutation,
  useDeleteStorageLocationMutation,
  useSetDefaultStorageLocationMutation,
  CreateStorageLocationInput,
  UpdateStorageLocationInput,
} from '#generated';
import { usePreservedArrayData } from '#/hooks/apollo';

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
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  const { data: treeData } = useGetStorageLocationTreeQuery({
    variables: { homeId: homeId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  // Mutations
  const [createMutation, { loading: creating }] =
    useCreateStorageLocationMutation({
      errorPolicy: 'all',
      update: (cache, { data }) => {
        if (!data?.createStorageLocation || !homeId) return;

        try {
          // Use cache.modify to add new location to the array (consistent with other hooks)
          cache.modify({
            fields: {
              storageLocations(existingLocations = [], { readField, toReference }) {
                const newLocationRef = toReference(data.createStorageLocation);

                // Check if location already exists (avoid duplicates)
                const exists = existingLocations.some(
                  (locRef: any) => readField('id', locRef) === data.createStorageLocation.id,
                );

                if (exists) return existingLocations;

                // Add new location to the array
                return [...existingLocations, newLocationRef];
              },
            },
          });
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
    errorPolicy: 'all',
    update: (cache, { data }, { variables }) => {
      if (!data?.deleteStorageLocation || !variables || !homeId) return;

      try {
        const deletedId = variables.id;

        // Use cache.modify to remove location from the array (consistent with other hooks)
        cache.modify({
          fields: {
            storageLocations(existingLocations = [], { readField }) {
              return existingLocations.filter(
                (locRef: any) => readField('id', locRef) !== deletedId,
              );
            },
          },
        });

        // Evict the deleted location from cache
        cache.evict({
          id: cache.identify({ __typename: 'StorageLocation', id: deletedId }),
        });

        // Garbage collect orphaned data
        cache.gc();
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

  // Preserve data even when query fails to prevent cascade failures
  const locations = usePreservedArrayData(data?.storageLocations);
  const treeFromQuery = usePreservedArrayData(treeData?.storageLocationTree);

  // Build tree from flat list if tree query returns empty
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
