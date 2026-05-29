import { useEffect, useRef } from 'react';
import { toastService } from '#/services/toastService';
import { useLazyQuery, useMutation, useQuery } from '@apollo/client/react';
import { handleMutationError } from '#/utils/errorHandlers';
import {
  GetStorageLocationsDocument,
  GetStorageLocationTreeDocument,
  UpdateStorageLocationDocument,
  DeleteStorageLocationDocument,
  SetDefaultStorageLocationDocument,
  type GetStorageLocationsQuery,
} from '#operations/storageLocation/storageLocation.generated';
import { type UpdateStorageLocationInput } from '#/graphql/generated/schemaTypes';
import { usePreservedArrayData } from '#/hooks/apollo/usePreservedQueryData';
import { extractNodes } from '#/utils/connectionUtils';
import {
  createRemoveFromQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import {
  executeMutation,
  executeCacheUpdate,
} from '#/utils/compilerSafeWrappers';
import { useCreateStorageLocation } from './useCreateStorageLocation';

/** Flat storage-location node as returned by `GetStorageLocations`. */
type FlatStorageLocation =
  GetStorageLocationsQuery['storageLocations']['edges'][number]['node'];

/** Flat node augmented with the nested children built by {@link buildTreeFromFlatList}. */
type StorageLocationTreeNode = FlatStorageLocation & {
  childLocations: StorageLocationTreeNode[];
};

/**
 * Build a tree structure from a flat list of locations using parentLocation references
 */
function buildTreeFromFlatList(
  locations: FlatStorageLocation[],
): StorageLocationTreeNode[] {
  if (!locations || locations.length === 0) return [];

  // Create a map for quick lookup
  const locationMap = new Map<string, StorageLocationTreeNode>(
    locations.map(loc => [loc.id, { ...loc, childLocations: [] }]),
  );

  // Array to hold root locations (locations without a parent)
  const roots: StorageLocationTreeNode[] = [];

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
  const sortBySortOrder = (
    a: StorageLocationTreeNode,
    b: StorageLocationTreeNode,
  ) => a.sortOrder - b.sortOrder;
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
export function useStorageLocationManagement(
  homeId: string | undefined,
  pantryId?: string,
) {
  const shouldSkip = !homeId;
  // Track if tree query has been fetched
  const hasTreeFetchedRef = useRef(false);

  // PERFORMANCE OPTIMIZATION:
  // Use cache-first to show cached data instantly, then background refresh with nextFetchPolicy.
  // This reduces initial network load and shows UI immediately.
  const { data, loading, error, refetch } = useQuery(
    GetStorageLocationsDocument,
    {
      variables: { homeId: homeId ?? '' },
      skip: shouldSkip,
      fetchPolicy: 'cache-first', // Show cached data instantly
      nextFetchPolicy: 'cache-and-network', // Background refresh on subsequent fetches
      errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
    },
  );

  // PERFORMANCE: Tree query is lazy - only needed for management screens, not filter tabs.
  // The flat list query above is sufficient for most UI needs.
  // We can build a tree from the flat list as a fallback.
  const [fetchTree, { data: treeData }] = useLazyQuery(
    GetStorageLocationTreeDocument,
    {
      fetchPolicy: 'cache-first',
      errorPolicy: 'ignore', // Return cached data on network errors instead of empty array
    },
  );

  // Fetch tree data after initial locations load (deferred, non-blocking)
  useEffect(() => {
    if (
      !shouldSkip &&
      homeId &&
      data?.storageLocations?.edges &&
      !hasTreeFetchedRef.current
    ) {
      hasTreeFetchedRef.current = true;
      // Defer tree fetch to avoid competing with screen-critical queries
      const idleId = requestIdleCallback(() => {
        fetchTree({ variables: { homeId } });
      });
      return () => cancelIdleCallback(idleId);
    }
  }, [shouldSkip, homeId, data?.storageLocations?.edges, fetchTree]);

  // Reset fetch flag when homeId changes
  useEffect(() => {
    if (!homeId) {
      hasTreeFetchedRef.current = false;
    }
  }, [homeId]);

  // Reuse the lightweight create hook — it handles both ROOT_QUERY and
  // Pantry.storageLocationsConnection cache updates so PantryMain tabs sync instantly.
  const { createLocation, creating } = useCreateStorageLocation(
    homeId,
    pantryId,
  );

  const [updateMutation, { loading: updating }] = useMutation(
    UpdateStorageLocationDocument,
    {
      // Update mutation automatically updates the cache for modified fields
      // No manual cache update needed - Apollo handles it automatically
      onError: error => {
        handleMutationError(error, { operation: 'Update Storage Location' });
      },
    },
  );

  const [deleteMutation] = useMutation(DeleteStorageLocationDocument, {
    update: (cache, { data }, { variables }) => {
      if (
        data?.deleteStorageLocation?.__typename !==
          'DeleteStorageLocationPayload' ||
        !variables ||
        !homeId
      ) {
        return;
      }

      executeCacheUpdate(
        () => {
          // Remove from PantryMain's filter tabs before evicting the entity
          if (pantryId) {
            const removeFromPantryLocations =
              createRemoveFromParentConnectionUpdater(
                'Pantry',
                'storageLocationsConnection',
                'StorageLocation',
              );
            removeFromPantryLocations(cache, pantryId, variables.input.id);
          }

          const removeFromStorageLocationsCache =
            createRemoveFromQueryConnectionUpdater(
              'storageLocations',
              'StorageLocation',
            );
          removeFromStorageLocationsCache(cache, variables.input.id, {
            evictItem: true,
          });
        },
        'Cache update failed for deleteStorageLocation:',
        refetch,
      );
    },
    onError: error => {
      handleMutationError(error, { operation: 'Delete Storage Location' });
    },
  });

  const [setDefaultMutation] = useMutation(SetDefaultStorageLocationDocument, {
    // SetDefault mutation returns the updated location with isDefault field
    // Apollo automatically updates the cache for this location
    // No manual cache update needed
    onError: error => {
      handleMutationError(error, { operation: 'Set Default Storage Location' });
    },
  });

  const updateLocation = async (
    id: string,
    input: Omit<UpdateStorageLocationInput, 'id'>,
  ) => {
    const result = await executeMutation(
      () => updateMutation({ variables: { input: { ...input, id } } }),
      'Update storage location error:',
    );
    if (!result) return false;
    return result.data?.updateStorageLocation?.__typename ===
      'UpdateStorageLocationPayload'
      ? result.data.updateStorageLocation.storageLocation
      : false;
  };

  const deleteLocation = async (id: string) => {
    const result = await executeMutation(
      () => deleteMutation({ variables: { input: { id } } }),
      'Delete storage location error:',
    );
    if (!result) return false;
    const payload = result.data?.deleteStorageLocation;
    if (payload?.__typename === 'DeleteStorageLocationPayload') {
      toastService.success('Storage location deleted');
      return true;
    }
    const message = payload && 'message' in payload ? payload.message : null;
    toastService.error(message ?? 'Failed to delete storage location');
    return false;
  };

  const setDefaultLocation = async (id: string) => {
    const result = await executeMutation(
      () => setDefaultMutation({ variables: { input: { id } } }),
      'Set default storage location error:',
    );
    if (!result) return false;
    return result.data?.setDefaultStorageLocation?.__typename ===
      'SetDefaultStorageLocationPayload'
      ? result.data.setDefaultStorageLocation.storageLocation
      : false;
  };

  // Preserve data even when query fails to prevent cascade failures
  const locations = usePreservedArrayData(extractNodes(data?.storageLocations));
  const treeFromQuery = usePreservedArrayData(treeData?.storageLocationTree);

  // Build tree from flat list if tree query returns empty
  const tree =
    treeFromQuery.length > 0 ? treeFromQuery : buildTreeFromFlatList(locations);

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
