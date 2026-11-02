import { skipToken, useFragment, useQuery } from '@apollo/client/react';
import {
  GetPantryActionItemDocument,
  PantryActionModal_PantryItemFragmentDoc,
  type PantryActionModal_PantryItemFragment,
} from '#features/pantry/components/modals/PantryActionModal.generated';
import { useDataState, type DataState } from '#hooks/data/useDataState';

/**
 * The item an open action modal acts on, read LIVE so a cache update reaches
 * the modal without re-snapshotting state. The query guarantees the full read
 * shape however the item arrived — `cache-first` is a no-op when the cache
 * satisfies it, so partial entries self-heal.
 */
export function usePantryActionItem(pantryItemId: string | null | undefined): {
  pantryItem: PantryActionModal_PantryItemFragment | null;
  loading: boolean;
  state: DataState;
  retry: () => void;
} {
  const { loading, error, refetch } = useQuery(
    GetPantryActionItemDocument,
    pantryItemId
      ? {
          variables: { id: pantryItemId },
          fetchPolicy: 'cache-first',
          errorPolicy: 'all',
        }
      : skipToken,
  );

  const { data, complete } = useFragment({
    fragment: PantryActionModal_PantryItemFragmentDoc,
    fragmentName: 'PantryActionModal_pantryItem',
    from: pantryItemId ? { __typename: 'PantryItem', id: pantryItemId } : null,
  });

  const pantryItem = pantryItemId && complete ? data : null;
  const state = useDataState({
    loading,
    error,
    hasResult: !!pantryItem,
    isEmpty: false,
    skipped: !pantryItemId,
  });

  return {
    pantryItem,
    loading,
    state,
    retry: () => {
      void refetch();
    },
  };
}
