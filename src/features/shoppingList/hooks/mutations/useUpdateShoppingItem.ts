/**
 * useUpdateShoppingItem - Update item mutation for shopping list
 *
 * Pattern: write the optimistic field updates to the cache via
 * `cache.modify` BEFORE firing the mutation, then rely on Apollo's
 * auto-normalization to apply the server-confirmed values. On rejection,
 * revert the optimistic changes from a snapshot captured up front.
 *
 * Under the global `mutate.errorPolicy: 'all'`, a server refusal RESOLVES
 * (never throws) — either as a GraphQL error in `result.error` or as a
 * non-success union payload. So the revert is driven off the *resolved* result
 * via `classifyCreateResult` (mirroring `useUpdatePantryItemQuantity`); a
 * thrown-error fallback exists only for non-Apollo throws. Transport/GraphQL
 * errors are surfaced through the mutation's `onError` option.
 */

import { useApolloClient, useMutation } from '@apollo/client/react';
import { UpdateShoppingListItemDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  UseUpdateShoppingItem_ItemFragmentDoc,
  type UseUpdateShoppingItem_ItemFragment,
} from './useUpdateShoppingItem.generated';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import type { ShoppingListItemUpdate } from './types';
import { executeMutation } from '#/utils/compilerSafeWrappers';

interface UseUpdateShoppingItemOptions {
  listId: string | null | undefined;
  refetch: () => Promise<unknown>;
}

const OPTIMISTIC_FIELDS: ReadonlyArray<
  Extract<
    keyof ShoppingListItemUpdate,
    'itemName' | 'quantity' | 'category' | 'unitName' | 'notes'
  >
> = ['itemName', 'quantity', 'category', 'unitName', 'notes'];

export function useUpdateShoppingItem({
  listId,
  refetch,
}: UseUpdateShoppingItemOptions) {
  const client = useApolloClient();

  const [updateItemMutation] = useMutation(UpdateShoppingListItemDocument, {
    onError: error => {
      handleMutationError(error, {
        operation: 'Update Shopping List Item',
        checks: [versionConflictCheck({ onRefresh: () => refetch() })],
      });
    },
  });

  const updateItem = async (
    itemId: string,
    updates: ShoppingListItemUpdate,
  ) => {
    if (!listId) return false;

    const cacheId = client.cache.identify({
      __typename: 'ShoppingListItem',
      id: itemId,
    });
    if (!cacheId) {
      console.warn('Item not found, cannot update:', itemId);
      return false;
    }

    const snapshot =
      client.cache.readFragment<UseUpdateShoppingItem_ItemFragment>({
        id: cacheId,
        fragment: UseUpdateShoppingItem_ItemFragmentDoc,
        fragmentName: 'useUpdateShoppingItem_item',
      });
    if (!snapshot) {
      console.warn('Item not found, cannot update:', itemId);
      return false;
    }

    // Optimistically write the changed fields. Server response will be
    // auto-normalized on top of this when the mutation completes.
    const optimisticFields: Record<string, () => unknown> = {
      updatedAt: () => new Date().toISOString(),
    };
    for (const field of OPTIMISTIC_FIELDS) {
      if (updates[field] !== undefined) {
        const value = updates[field];
        optimisticFields[field] = () => value;
      }
    }
    client.cache.modify({ id: cacheId, fields: optimisticFields });

    const revertSnapshot = () => {
      const revertFields: Record<string, () => unknown> = {};
      for (const field of OPTIMISTIC_FIELDS) {
        if (updates[field] !== undefined) {
          revertFields[field] = () => snapshot[field];
        }
      }
      revertFields.updatedAt = () => snapshot.updatedAt;
      client.cache.modify({ id: cacheId, fields: revertFields });
    };

    const result = await executeMutation(
      () =>
        updateItemMutation({
          variables: {
            input: { ...updates, id: itemId, version: snapshot.version },
          },
          // Local-first: queue on an API-down-while-online failure (idempotent
          // field update by real id → replays via SyncShoppingListItem).
          context: { localFirst: true },
        }),
      // Fallback for a non-Apollo throw — Apollo errors resolve under
      // errorPolicy:'all' and are classified below. The user-facing alert comes
      // from the mutation's onError option.
      () => revertSnapshot(),
    );
    if (!result) return false;

    // A server refusal (GraphQL error, or a non-success union payload such as
    // ConflictError / ValidationError) resolves without throwing, so onError /
    // the catch above never fires for it. Classify the resolved result and
    // revert the optimistic write on a real rejection. 'queued' (offline / API
    // down) keeps the write — it replays via SyncShoppingListItem.
    const outcome = classifyCreateResult(
      result,
      'updateShoppingListItem',
      'UpdateShoppingListItemPayload',
    );
    if (outcome === 'rejected') {
      revertSnapshot();
      // A union-payload rejection has no `error`, so onError didn't alert —
      // surface it here. (No-op when there is an error: onError handled it.)
      alertRejectedMutation(result, 'Could not update the item.');
      return false;
    }
    return true;
  };

  return { updateItem };
}
