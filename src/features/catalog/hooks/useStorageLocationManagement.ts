import { toastService } from '#/services/toastService';
import { useMutation, useQuery } from '@apollo/client/react';
import {
  GetStorageLocationsDocument,
  UpdateStorageLocationDocument,
  DeleteStorageLocationDocument,
  MarkStorageLocationAsDefaultDocument,
  type GetStorageLocationsQuery,
} from '#features/catalog/graphql/storageLocation.generated';
import { type UpdateStorageLocationInput } from '#/graphql/generated/schemaTypes';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';
import {
  createRemoveFromQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import { useCreateStorageLocation } from '#features/catalog/hooks/useCreateStorageLocation';
import { useBlocksCacheMissQueries } from '#hooks/app/useBlocksCacheMissQueries';
import { useIsApiUnavailable } from '#hooks/app/useIsApiUnavailable';
import { t } from '#/i18n';
import { errorService } from '#/services/errorService';

/**
 * Toast the message from a resolved errors-as-data member. A non-success union
 * payload (`ForbiddenError`/`ValidationError`/…) resolves without throwing under
 * `errorPolicy:'all'`, so call this on the non-success branch to surface it.
 */
function toastResolvedError(
  payload: { __typename?: string; message?: string } | null | undefined,
): void {
  const message =
    payload && typeof payload.message === 'string' && payload.message
      ? payload.message
      : t('errors.codes.genericRetry');
  toastService.error(message);
}

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

  // `errorPolicy: 'ignore'` swallows offlineModeLink's synthetic cache-miss
  // error, so "we never tried and have nothing" has to be read from the absence
  // of data rather than from an error. Without it an offline user sees the
  // ordinary empty state, which invites them to create a location that may
  // already exist on the server.
  const networkBlocked = useBlocksCacheMissQueries();

  // Reuse the lightweight create hook — it handles both ROOT_QUERY and
  // Pantry.storageLocationsConnection cache updates so PantryMain tabs sync instantly.
  const { createLocation, creating } = useCreateStorageLocation(
    homeId,
    pantryId,
  );

  // Creating a location IS offline-capable — the server links-or-creates by
  // name, so a replay converges. Editing one is not: there is no `sync*` twin
  // and no `idempotencyKey` on these inputs, so a queued replay has no
  // at-most-once guarantee. They stay online-only, which the API's offline
  // contract permits — provided the client gates them behind its
  // "API unavailable" disabled state instead of letting the tap through to a
  // failure. Surfaced as `isApiUnavailable` for the screen to disable on.
  const isApiUnavailable = useIsApiUnavailable();

  // Errors surfaced via toast in updateLocation below (toastResolvedError for a
  // resolved error member/transport error; the executeMutation handler for a
  // rare throw) — no mutation onError, so there is a single toast.
  const [updateMutation, { loading: updating }] = useMutation(
    UpdateStorageLocationDocument,
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

      try {
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
      } catch (cacheError) {
        // Refetching resyncs the list rather than leaving it half-updated.
        errorService.reportError(cacheError, {
          operation: 'Cache update failed for deleteStorageLocation:',
        });
        refetch?.();
      }
    },
    // Errors surfaced via toast in deleteLocation below — no onError.
  });

  // SetDefault returns the updated location; Apollo auto-normalizes by id. Errors
  // surfaced via toast in setDefaultLocation below — no onError.
  const [setDefaultMutation] = useMutation(
    MarkStorageLocationAsDefaultDocument,
  );

  const updateLocation = async (
    id: string,
    input: Omit<UpdateStorageLocationInput, 'id'>,
  ) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await updateMutation({ variables: { input: { ...input, id } } });
    } catch {
      toastService.error(t('errors.codes.genericRetry'));
    }
    if (!result) return false;
    const payload = result.data?.updateStorageLocation;
    if (payload?.__typename === 'UpdateStorageLocationPayload') {
      return payload.storageLocation;
    }
    toastResolvedError(payload);
    return false;
  };

  const deleteLocation = async (id: string) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await deleteMutation({ variables: { input: { id } } });
    } catch {
      toastService.error(t('errors.codes.genericRetry'));
    }
    if (!result) return false;
    const payload = result.data?.deleteStorageLocation;
    if (payload?.__typename === 'DeleteStorageLocationPayload') {
      toastService.success(t('success.storageLocationDeleted'));
      return true;
    }
    toastResolvedError(payload);
    return false;
  };

  const setDefaultLocation = async (id: string) => {
    if (isApiUnavailable) {
      toastService.error(t('errors.notAvailableOffline'));
      return false;
    }

    let result;
    try {
      result = await setDefaultMutation({ variables: { input: { id } } });
    } catch {
      toastService.error(t('errors.codes.genericRetry'));
    }
    if (!result) return false;
    const payload = result.data?.markStorageLocationAsDefault;
    if (payload?.__typename === 'MarkStorageLocationAsDefaultPayload') {
      return payload.storageLocation;
    }
    toastResolvedError(payload);
    return false;
  };

  // Preserve data even when query fails to prevent cascade failures
  const locations = usePreservedNodes(data?.storageLocations);

  // Always derive the tree from the flat list. The flat `GetStorageLocations`
  // query is kept fresh by the create/update/delete cache updaters; the separate
  // `storageLocationTree` query was NOT (mutations don't touch it), so after
  // creating a nested location the tree view went stale — missing the new child
  // and collapsing same-name siblings. buildTreeFromFlatList keys on ids, so two
  // locations with the same name under different parents stay distinct.
  const tree = buildTreeFromFlatList(locations);

  return {
    // Data
    locations,
    tree,
    loading,
    initialLoading: !data && loading,
    offline: networkBlocked && !data,
    /** Editing is online-only — disable the controls rather than let the tap fail. */
    isApiUnavailable,
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
