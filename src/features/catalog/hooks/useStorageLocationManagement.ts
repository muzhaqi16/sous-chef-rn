import type { ApolloCache } from '@apollo/client';
import { toastService } from '#/services/toastService';
import { useApolloClient, useMutation, useQuery } from '@apollo/client/react';
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
  createAddToQueryConnectionUpdater,
  skipUnmatchedArgVariants,
  createAddToParentConnectionUpdater,
  createRemoveFromQueryConnectionUpdater,
  createRemoveFromParentConnectionUpdater,
} from '#/apollo/utils/cacheUpdaters';
import {
  updateEntityFieldsLocalFirst,
  writeEntityFields,
  snapshotFields,
} from '#/apollo/utils/localFirstFields';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { useCreateStorageLocation } from '#features/catalog/hooks/useCreateStorageLocation';
import { useBlocksCacheMissQueries } from '#hooks/app/useBlocksCacheMissQueries';
import { t } from '#/i18n';
import { localizedRefusalMessage } from '#/apollo/utils/alertRejectedMutation';
import { errorService } from '#/services/errorService';

/**
 * Toasts a resolved errors-as-data member in the user's own language, field →
 * code → localized generic. Never display `payload.message`: it is the server's
 * English by construction (no `Accept-Language`, no locale on the token).
 */
function toastResolvedError(
  payload:
    | { __typename?: string; code?: string | null; field?: string | null }
    | null
    | undefined,
): void {
  toastService.error(
    localizedRefusalMessage(payload, t('errors.codes.genericRetry')),
  );
}

/** Flat storage-location node as returned by `GetStorageLocations`. */
type FlatStorageLocation =
  GetStorageLocationsQuery['storageLocations']['edges'][number]['node'];

/** Flat node augmented with the nested children built by {@link buildTreeFromFlatList}. */
type StorageLocationTreeNode = FlatStorageLocation & {
  childLocations: StorageLocationTreeNode[];
};

/**
 * The two connections a storage location lives in. Both writers are
 * module-level so each caller's try body stays a single plain call — a value
 * block inside a try bails the whole hook out of the React Compiler.
 */
const removeFromStorageLocationsQuery = createRemoveFromQueryConnectionUpdater(
  'storageLocations',
  'StorageLocation',
);
const removeFromPantryLocations = createRemoveFromParentConnectionUpdater(
  'Pantry',
  'storageLocationsConnection',
  'StorageLocation',
);
const addToStorageLocationsQuery =
  createAddToQueryConnectionUpdater<FlatStorageLocation>(
    'storageLocations',
    'StorageLocation',
  );
const addToPantryLocations =
  createAddToParentConnectionUpdater<FlatStorageLocation>(
    'Pantry',
    'storageLocationsConnection',
    'StorageLocation',
  );

function removeLocationFromCaches(
  cache: ApolloCache,
  id: string,
  pantryId: string | undefined,
): void {
  if (pantryId) removeFromPantryLocations(cache, pantryId, id);
  removeFromStorageLocationsQuery(cache, id, { evictItem: true });
}

function restoreLocationToCaches(
  cache: ApolloCache,
  location: FlatStorageLocation,
  pantryId: string | undefined,
  homeId: string | undefined,
): void {
  // `cache.modify` runs for EVERY cached `storageLocations(homeId:…)` variant,
  // so without this scope a refused delete in home A also appended the row into
  // home B's list. The field is keyed on a plain argument rather than a
  // `filters` object, which is why this uses the arg matcher.
  addToStorageLocationsQuery(cache, location, {
    position: 'end',
    skipStoreField: homeId ? skipUnmatchedArgVariants({ homeId }) : undefined,
  });
  if (pantryId)
    addToPantryLocations(cache, pantryId, location, { position: 'end' });
}

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

  const client = useApolloClient();

  // Every write here is offline-capable. Update and set-default write absolute
  // fields on a row keyed by its existing `id`, so a replay lands the same state
  // twice; delete converges server-side (`converged: true` when the row is
  // already gone, `NotFoundError` only for a target that never existed), so a
  // replayed delete is a success rather than a permanent failure.

  // Errors surfaced via toast in updateLocation below (toastResolvedError for a
  // resolved error member/transport error; the executeMutation handler for a
  // rare throw) — no mutation onError, so there is a single toast.
  const [updateMutation, { loading: updating }] = useMutation(
    UpdateStorageLocationDocument,
  );

  // No `update` callback: the removal happens eagerly in `deleteLocation` so it
  // is visible offline too, and running it again on the response would just
  // re-evict an already-evicted entity. Errors surface via toast there.
  const [deleteMutation] = useMutation(DeleteStorageLocationDocument);

  // SetDefault returns the updated location; Apollo auto-normalizes by id. Errors
  // surfaced via toast in setDefaultLocation below — no onError.
  const [setDefaultMutation] = useMutation(
    MarkStorageLocationAsDefaultDocument,
  );

  const updateLocation = async (
    id: string,
    input: Omit<UpdateStorageLocationInput, 'id'>,
  ) => {
    const current = locations.find(location => location.id === id);

    // Input field names ARE the StorageLocation field names except
    // `parentLocationId`: the sheet is seeded with the flat id, but the query
    // selects only the nested `parentLocation`, which is what the tree builder
    // and the delete guard read. Writing the flat field alone moves nothing.
    const { parentLocationId, ...directFields } = input;
    const nextParent =
      parentLocationId === undefined
        ? undefined
        : locations.find(location => location.id === parentLocationId) ?? null;

    // Identity only: `writeEntityFields` normalizes `__typename`+`id` into a
    // reference, so the child points AT the parent instead of copying its
    // fields (a later rename would strand every child's sub-label) and the
    // write cannot clobber the parent's own record.
    const locationRef = (locationId: string) => ({
      __typename: 'StorageLocation',
      id: locationId,
    });

    const updates = {
      ...directFields,
      ...(nextParent === undefined
        ? {}
        : { parentLocation: nextParent ? locationRef(nextParent.id) : null }),
    };

    // Snapshot the fields being changed. A key the read did not CARRY is
    // omitted, so a refusal leaves that field alone rather than blanking a
    // value the snapshot never saw; a key carried as null is recorded, so an
    // empty field is restored as empty. An undefined `current` is harmless —
    // `writeEntityFields` is a no-op without an entity, on write and revert.
    const previous = {
      ...snapshotFields(current, updates),
      // `current` is a query READ, so its `parentLocation` is denormalized.
      // Snapshotting it verbatim would make a refusal restore the very copy
      // this write exists to avoid.
      ...(nextParent === undefined
        ? {}
        : {
            parentLocation: current?.parentLocation?.id
              ? locationRef(current.parentLocation.id)
              : null,
          }),
    };

    // `isDefault` is exclusive. `setDefaultLocation` clears the previous holder
    // for exactly this reason; ticking Default in the EDIT sheet has to as well,
    // or two rows read as default until the next fetch.
    const displacedDefault =
      input.isDefault === true
        ? locations.find(location => location.isDefault && location.id !== id)
        : undefined;

    const { persisted, result } = await updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: current ? { __typename: 'StorageLocation', id } : undefined,
      updates,
      previous,
      logLabel: 'Update Storage Location',
      mutate: () => {
        if (displacedDefault) {
          writeEntityFields(
            client.cache,
            { __typename: 'StorageLocation', id: displacedDefault.id },
            { isDefault: false },
          );
        }
        return updateMutation({
          variables: { input: { ...input, id } },
          context: { localFirst: true },
        });
      },
    });

    if (!persisted) {
      if (displacedDefault) {
        writeEntityFields(
          client.cache,
          { __typename: 'StorageLocation', id: displacedDefault.id },
          { isDefault: true },
        );
      }
      toastResolvedError(
        (result?.data as { updateStorageLocation?: unknown } | undefined)
          ?.updateStorageLocation as Parameters<typeof toastResolvedError>[0],
      );
      return false;
    }

    // Persisted covers BOTH outcomes that keep the edit: the server confirmed
    // it, or the queue took it. The only consumer reads truthiness.
    return true;
  };

  const deleteLocation = async (id: string) => {
    // Snapshot before removing: a refusal has to put the row back, and an
    // evicted entity is one the cache cannot describe.
    const removed = locations.find(location => location.id === id);

    try {
      removeLocationFromCaches(client.cache, id, pantryId);
    } catch (cacheError) {
      errorService.reportError(cacheError, {
        operation: 'Delete Storage Location (optimistic)',
      });
    }

    let result;
    try {
      result = await deleteMutation({
        variables: { input: { id } },
        context: { localFirst: true },
      });
    } catch (error) {
      errorService.reportError(error, {
        operation: 'Delete Storage Location',
      });
    }

    if (classifyCreateResult(result) === 'rejected') {
      if (removed) {
        try {
          restoreLocationToCaches(client.cache, removed, pantryId, homeId);
        } catch (cacheError) {
          errorService.reportError(cacheError, {
            operation: 'Revert rejected storage-location delete',
          });
        }
      }
      toastResolvedError(result?.data?.deleteStorageLocation);
      return false;
    }

    toastService.success(t('success.storageLocationDeleted'));
    return true;
  };

  const setDefaultLocation = async (id: string) => {
    // Default is exclusive: the server clears the previous holder, so the cache
    // has to as well or two rows read as default until the next fetch.
    const previousDefault = locations.find(
      location => location.isDefault && location.id !== id,
    );

    const { persisted, result } = await updateEntityFieldsLocalFirst({
      cache: client.cache,
      entity: { __typename: 'StorageLocation', id },
      updates: { isDefault: true },
      previous: { isDefault: false },
      logLabel: 'Set Default Storage Location',
      mutate: async () => {
        if (previousDefault) {
          writeEntityFields(
            client.cache,
            { __typename: 'StorageLocation', id: previousDefault.id },
            { isDefault: false },
          );
        }
        return setDefaultMutation({
          variables: { input: { id } },
          context: { localFirst: true },
        });
      },
    });

    if (!persisted) {
      if (previousDefault) {
        writeEntityFields(
          client.cache,
          { __typename: 'StorageLocation', id: previousDefault.id },
          { isDefault: true },
        );
      }
      toastResolvedError(
        (result?.data as { markStorageLocationAsDefault?: unknown } | undefined)
          ?.markStorageLocationAsDefault as Parameters<
          typeof toastResolvedError
        >[0],
      );
      return false;
    }
    return true;
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
