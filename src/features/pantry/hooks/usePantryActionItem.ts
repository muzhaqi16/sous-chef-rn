import { useFragment, useQuery } from '@apollo/client/react';
import {
  GetPantryActionItemDocument,
  PantryActionModal_PantryItemFragmentDoc,
  type PantryActionModal_PantryItemFragment,
} from '#features/pantry/components/modals/PantryActionModal.generated';

/**
 * The item an open action modal acts on, read LIVE so a cache update reaches
 * the modal without re-snapshotting state. The query guarantees the full read
 * shape however the item arrived — `cache-first` is a no-op when the cache
 * satisfies it, so partial entries self-heal.
 */
export function usePantryActionItem(pantryItemId: string | null | undefined): {
  pantryItem: PantryActionModal_PantryItemFragment | null;
  loading: boolean;
} {
  const { loading } = useQuery(GetPantryActionItemDocument, {
    variables: { id: pantryItemId ?? '' },
    skip: !pantryItemId,
    fetchPolicy: 'cache-first',
    errorPolicy: 'all',
  });

  const { data, complete } = useFragment({
    fragment: PantryActionModal_PantryItemFragmentDoc,
    fragmentName: 'PantryActionModal_pantryItem',
    from: pantryItemId ? { __typename: 'PantryItem', id: pantryItemId } : null,
  });

  return { pantryItem: pantryItemId && complete ? data : null, loading };
}
