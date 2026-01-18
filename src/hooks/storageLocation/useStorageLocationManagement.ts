import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import {
  useGetStorageLocationsQuery,
  useGetStorageLocationTreeLazyQuery,
  useCreateStorageLocationMutation,
  useUpdateStorageLocationMutation,
  useDeleteStorageLocationMutation,
  useSetDefaultStorageLocationMutation,
  CreateStorageLocationInput,
  UpdateStorageLocationInput,
} from '#generated';
import { usePreservedArrayData } from '#/hooks/apollo';
import { useCrudOperations } from '#/hooks/utils';
import {
  createAddToQueryFieldUpdater,
  createRemoveFromQueryFieldUpdater,
} from '#/apollo/utils';

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
  // Track if tree query has been fetched
  const hasTreeFetchedRef = useRef(false);

  // PERFORMANCE OPTIMIZATION:
  // Use cache-first to show cached data instantly, then background refresh with nextFetchPolicy.
  // This reduces initial network load and shows UI immediately.
  const { data, loading, error, refetch } = useGetStorageLocationsQuery({
    variables: { homeId: homeId ?? '' },
    skip: shouldSkip,
    fetchPolicy: 'cache-first', // Show cached data instantly
    nextFetchPolicy: 'cache-and-network', // Background refresh on subsequent fetches
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  // PERFORMANCE: Tree query is lazy - only needed for management screens, not filter tabs.
  // The flat list query above is sufficient for most UI needs.
  // We can build a tree from the flat list as a fallback.
  const [fetchTree, { data: treeData }] = useGetStorageLocationTreeLazyQuery({
    fetchPolicy: 'cache-first',
    nextFetchPolicy: 'cache-and-network',
    errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
  });

  // Fetch tree data after initial locations load (deferred, non-blocking)
  useEffect(() => {
    if (!shouldSkip && homeId && data?.storageLocations && !hasTreeFetchedRef.current) {
      hasTreeFetchedRef.current = true;
      // Defer tree fetch to avoid competing with screen-critical queries
      const timeoutId = setTimeout(() => {
        fetchTree({ variables: { homeId } });
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [shouldSkip, homeId, data?.storageLocations, fetchTree]);

  // Reset fetch flag when homeId changes
  useEffect(() => {
    if (!homeId) {
      hasTreeFetchedRef.current = false;
    }
  }, [homeId]);

  // CRUD operations utilities
  const { createAddOperation } = useCrudOperations();

  // Mutations
  const [createMutation, { loading: creating }] =
    useCreateStorageLocationMutation({
      errorPolicy: 'all',
      update: (cache, { data }) => {
        if (!data?.createStorageLocation || !homeId) return;

        try {
          const addToStorageLocationsCache = createAddToQueryFieldUpdater('storageLocations');
          addToStorageLocationsCache(cache, data.createStorageLocation, { position: 'end' });
        } catch (error) {
          console.warn('Cache update failed for createStorageLocation:', error);
          refetch();
        }
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
        const removeFromStorageLocationsCache = createRemoveFromQueryFieldUpdater(
          'storageLocations',
          'StorageLocation',
        );
        removeFromStorageLocationsCache(cache, variables.id, { evictItem: true });
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

  // Action handlers using CRUD utilities
  const createLocation = createAddOperation({
    mutation: createMutation,
    parentId: () => homeId,
    transformInput: (input: Omit<CreateStorageLocationInput, 'homeId'>) => ({
      ...input,
      homeId,
    }),
    onSuccess: (data: any) => data?.createStorageLocation,
    operationName: 'Create Storage Location',
  });

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
