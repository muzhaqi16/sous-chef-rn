import { useQuery, useFragment } from '@apollo/client/react';
import {
  GetItemForEditDocument,
  UseItemForEdit_ItemFragmentDoc,
} from '#features/catalog/hooks/useItemForEdit.generated';
import {
  itemToEditableSnapshot,
  type EditableItemSnapshot,
} from '#utils/items/suggestItemChanges';

export interface UseItemForEditResult {
  /** null until the cache holds every field the diff needs. */
  snapshot: EditableItemSnapshot | null;
  loading: boolean;
  error: unknown;
  /** Re-runs the query. `error` alone strands the caller on a spinner. */
  refetch: () => void;
}

/**
 * Loads the canonical pre-edit snapshot of a catalog item. Withheld entirely
 * until the read is complete: a partial read reports absent fields as
 * user-cleared values, and lies about `canEdit`.
 */
export function useItemForEdit(itemId: string): UseItemForEditResult {
  const { loading, error, refetch } = useQuery(GetItemForEditDocument, {
    variables: { id: itemId },
    fetchPolicy: 'cache-and-network',
  });

  // Read through the fragment rather than `data.item`: under dataMasking the
  // query's `item` is just { __typename, id }, and reading the cache entity by
  // key means UpdateItem's write-through refreshes this without a refetch.
  const result = useFragment({
    fragment: UseItemForEdit_ItemFragmentDoc,
    fragmentName: 'useItemForEdit_item',
    from: { __typename: 'Item', id: itemId },
  });

  return {
    snapshot: result.complete ? itemToEditableSnapshot(result.data) : null,
    loading,
    error,
    refetch,
  };
}
