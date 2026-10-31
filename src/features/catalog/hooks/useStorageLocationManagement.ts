import { toastService } from '#/services/toastService';
import {
  skipToken,
  useApolloClient,
  useMutation,
  useQuery,
} from '@apollo/client/react';
import {
  GetStorageLocationsDocument,
  UpdateStorageLocationDocument,
  DeleteStorageLocationDocument,
  MarkStorageLocationAsDefaultDocument,
  type GetStorageLocationsQuery,
} from '#features/catalog/graphql/storageLocation.generated';
import type {
  LocationFieldsInputs,
  RemoveLocationInputs,
} from '#features/catalog/offline/localWrites';
import type { UpdateStorageLocationInput } from '#/graphql/generated/schemaTypes';
import { usePreservedNodes } from '#/hooks/apollo/usePreservedConnection';
import { pendingWritesOf } from '#/apollo/pendingWrites/pendingWrites';
import { settleMutation } from '#/apollo/utils/settleMutation';
import { useCreateStorageLocation } from '#features/catalog/hooks/useCreateStorageLocation';
import { useBlocksCacheMissQueries } from '#features/catalog/hooks/useBlocksCacheMissQueries';
import { useTranslation } from '#/i18n';
import { errorCopy } from '#/services/errorService';

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
    node.childLocations.sort(sortBySortOrder);
    node.childLocations.forEach(sortChildren);
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
  const { t } = useTranslation();
  const {
    data: result,
    variables,
    loading,
    error,
    refetch,
  } = useQuery(
    GetStorageLocationsDocument,
    homeId
      ? {
          variables: { homeId },
          // `'all'` keeps cached data beside the error. `'ignore'` never sets
          // `error` for either a GraphQL or a transport failure, so the error
          // state below could not render.
          errorPolicy: 'all',
        }
      : skipToken,
  );
  // `skipToken` keeps the last run's variables AND data, so a result for a
  // previous home is dropped.
  const data = variables.homeId === homeId ? result : undefined;

  // Offline, no data means "never tried", and offlineModeLink's synthetic
  // cache-miss error is not one to show; else the ordinary empty state invites
  // creating a location that may already exist on the server.
  const networkBlocked = useBlocksCacheMissQueries();

  // Reuse the lightweight create hook — it handles both ROOT_QUERY and
  // Pantry.storageLocationsConnection cache updates so PantryMain tabs sync instantly.
  const { createLocation, creating } = useCreateStorageLocation(
    homeId,
    pantryId,
  );

  const client = useApolloClient();

  // Every write here replays safely: update and set-default write absolute
  // fields on an existing `id`, and a delete converges server-side (`converged:
  // true` once gone, `NotFoundError` only for a row that never existed).

  // Each write below settles its own failure and toasts it — no `onError`.
  const [updateMutation, { loading: updating }] = useMutation(
    UpdateStorageLocationDocument,
    { context: { localFirst: true } },
  );

  const [deleteMutation] = useMutation(DeleteStorageLocationDocument, {
    context: { localFirst: true },
  });

  // SetDefault returns the updated location; Apollo auto-normalizes by id.
  const [setDefaultMutation] = useMutation(
    MarkStorageLocationAsDefaultDocument,
    { context: { localFirst: true } },
  );

  const updateLocation = async (
    id: string,
    input: Omit<UpdateStorageLocationInput, 'id'>,
  ) => {
    // Input names ARE the StorageLocation field names except `parentLocationId`:
    // the tree builder and delete guard read the nested `parentLocation`, so
    // writing the flat field alone moves nothing.
    const { parentLocationId, ...directFields } = input;
    const nextParent =
      parentLocationId === undefined
        ? undefined
        : locations.find(location => location.id === parentLocationId) ?? null;

    // Identity only: `writeEntityFields` normalizes `__typename`+`id` into a
    // reference, so the child points AT the parent (a copy would strand its
    // sub-label on a rename) and cannot clobber the parent's record.
    const fields = {
      ...directFields,
      ...(nextParent !== undefined && {
        parentLocation: nextParent
          ? { __typename: 'StorageLocation', id: nextParent.id }
          : null,
      }),
    };

    // `isDefault` is exclusive. `setDefaultLocation` clears the previous holder
    // for exactly this reason; ticking Default in the EDIT sheet has to as well,
    // or two rows read as default until the next fetch.
    const displaced =
      input.isDefault === true
        ? locations.find(location => location.isDefault && location.id !== id)
        : undefined;

    const inputs: LocationFieldsInputs = {
      id,
      fields,
      displacedId: displaced?.id,
    };
    const settled = await pendingWritesOf(client.cache).send(
      UpdateStorageLocationDocument,
      { input: { ...input, id } },
      write =>
        settleMutation(() => updateMutation(write), {
          document: UpdateStorageLocationDocument,
          fallback: t('errors.codes.genericRetry'),
          present: 'toast',
        }),
      inputs,
    );
    // Covers BOTH outcomes that keep the edit: the server confirmed it, or the
    // queue took it. The only consumer reads truthiness.
    return !settled.failure;
  };

  const deleteLocation = async (id: string) => {
    const inputs: RemoveLocationInputs = { pantryId };
    // A delete converges: a row already gone is the outcome asked for.
    const settled = await pendingWritesOf(client.cache).send(
      DeleteStorageLocationDocument,
      { input: { id } },
      write =>
        settleMutation(() => deleteMutation(write), {
          document: DeleteStorageLocationDocument,
          fallback: t('errors.codes.genericRetry'),
          removal: true,
          present: 'toast',
        }),
      inputs,
    );
    if (settled.failure) return false;

    toastService.success(t('success.storageLocationDeleted'));
    return true;
  };

  const setDefaultLocation = async (id: string) => {
    // Default is exclusive: the server clears the previous holder, so the row
    // shows that too, or two rows read as default until the next fetch.
    const displaced = locations.find(
      location => location.isDefault && location.id !== id,
    );
    const inputs: LocationFieldsInputs = {
      id,
      fields: { isDefault: true },
      displacedId: displaced?.id,
    };
    const settled = await pendingWritesOf(client.cache).send(
      MarkStorageLocationAsDefaultDocument,
      { input: { id } },
      write =>
        settleMutation(() => setDefaultMutation(write), {
          document: MarkStorageLocationAsDefaultDocument,
          fallback: t('errors.codes.genericRetry'),
          present: 'toast',
        }),
      inputs,
    );
    return !settled.failure;
  };

  // Preserve data even when query fails to prevent cascade failures
  const locations = usePreservedNodes(data?.storageLocations, homeId ?? '');

  // The tree derives from the flat list, which the create/update/delete cache
  // updaters keep fresh; no mutation touches `storageLocationTree`. Keyed on
  // ids, so same-name locations under different parents stay distinct.
  const tree = buildTreeFromFlatList(locations);

  return {
    // Data
    locations,
    tree,
    initialLoading: !data && loading,
    offline: networkBlocked && !data,
    creating,
    updating,
    errorMessage:
      error && !networkBlocked
        ? errorCopy(error, t, t('errors.codes.genericRetry'))
        : null,

    // Actions
    createLocation,
    updateLocation,
    deleteLocation,
    setDefaultLocation,
    refetch: () => (homeId ? refetch() : Promise.resolve()),
  };
}
