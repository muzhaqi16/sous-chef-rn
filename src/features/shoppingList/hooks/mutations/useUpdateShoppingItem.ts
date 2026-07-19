/**
 * useUpdateShoppingItem - Update item mutation for shopping list.
 *
 * Optimistically writes the changed fields to the cache before firing, then
 * relies on Apollo's auto-normalization for the confirmed values. Under
 * `errorPolicy: 'all'` a refusal RESOLVES rather than throws, so the revert is
 * driven off the classified resolved result (mirroring useUpdatePantryItemQuantity);
 * transport/GraphQL errors surface via the mutation's `onError`.
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
import { t } from '#/i18n/t';
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
      // Fallback for a non-Apollo throw; Apollo errors resolve and are classified below.
      () => revertSnapshot(),
    );
    if (!result) return false;

    // Classify the resolved result and revert on a real rejection. 'queued'
    // (offline / API down) keeps the write — it replays via SyncShoppingListItem.
    const outcome = classifyCreateResult(
      result,
      'updateShoppingListItem',
      'UpdateShoppingListItemPayload',
    );
    if (outcome === 'rejected') {
      revertSnapshot();
      // Alerts only for a union-payload rejection; onError handles error cases.
      alertRejectedMutation(result, t('errors.updateShoppingItemFailed'));
      return false;
    }
    return true;
  };

  return { updateItem };
}
