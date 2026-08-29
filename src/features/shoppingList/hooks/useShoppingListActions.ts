import { useApolloClient, useMutation } from '@apollo/client/react';
import { generateEntityId } from '#/utils/generateEntityId';
import {
  UseShoppingListActions_ItemFragmentDoc,
  type UseShoppingListActions_ItemFragment,
} from './useShoppingListActions.generated';
import { UpdateShoppingListItemQuantityDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { toastService } from '#/services/toastService';
import {
  handleMutationError,
  versionConflictCheck,
} from '#/utils/errorHandlers';
import { useWrite } from '#/apollo/write/useWrite';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';
import { useHaptic } from '#hooks/haptic/useHaptic';
import { Telemetry } from '#/services/telemetry';
import { logger } from '#/utils/environment';
import { useClearShoppingListItems } from './mutations/useClearShoppingListItems';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';
import { t } from '#/i18n';

interface UseShoppingListActionsOptions {
  currentListId: string | undefined;
  unpurchasedItems: ShoppingListItemNode[];
  purchasedItems: ShoppingListItemNode[];
  addItem: (input: { itemName: string; quantity?: number }) => Promise<unknown>;
  toggleItem: (itemId: string) => Promise<unknown>;
  removeItem: (itemId: string) => Promise<unknown>;
  refetchItems: () => Promise<unknown>;
  setSearchQuery: (query: string) => void;
}

// --- Module-level helpers (outside hook body for React Compiler) ---

async function executeTogglePurchase(
  haptic: { selection: () => void; error: () => void },
  toggleItem: (itemId: string) => Promise<unknown>,
  itemId: string,
): Promise<void> {
  try {
    haptic.selection();
    await toggleItem(itemId);
    Telemetry.trackEvent('toggle_item_purchase_success');
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to toggle item purchase',
      { component: 'ShoppingListMain', operation: 'togglePurchase' },
    );
    haptic.error();
    toastService.error(t('toasts.itemToggleFailed'));
  }
}

async function executeDeleteItem(
  haptic: { warning: () => void; error: () => void },
  removeItem: (itemId: string) => Promise<unknown>,
  itemId: string,
): Promise<void> {
  try {
    haptic.warning();
    await removeItem(itemId);
    Telemetry.trackEvent('delete_item_success');
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to delete item',
      { component: 'ShoppingListMain', operation: 'deleteItem' },
    );
    haptic.error();
    toastService.error(t('errors.deleteItemFailed'));
  }
}

async function executeClearItems(
  haptic: { warning: () => void; error: () => void },
  clearItems: (purchased: boolean) => Promise<void>,
  purchased: boolean,
): Promise<void> {
  try {
    haptic.warning();
    await clearItems(purchased);
  } catch {
    haptic.error();
    toastService.error(
      purchased
        ? 'Failed to clear purchased items'
        : 'Failed to clear shopping items',
    );
  }
}

async function executeAddItemFromSearch(
  addItem: (input: { itemName: string; quantity?: number }) => Promise<unknown>,
  haptic: { success: () => void; error: () => void },
  itemName: string,
  setSearchQuery: (query: string) => void,
): Promise<void> {
  const trimmed = itemName.trim();
  try {
    const addResult = await addItem({
      itemName: trimmed,
      quantity: 1,
    });

    if (addResult) {
      Telemetry.trackEvent('add_item_success', { source: 'search' });
      haptic.success();
    } else {
      Telemetry.trackEvent('add_item_failed', { source: 'search' });
      haptic.error();
      toastService.error(t('errors.addItemFailed'));
      setSearchQuery(trimmed);
    }
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to add item from search',
      { component: 'ShoppingListMain', operation: 'addItemFromSearch' },
    );
    haptic.error();
    toastService.error(t('errors.addItemFailed'));
    setSearchQuery(trimmed);
  }
}

/**
 * Shopping List Actions Hook
 * Extracts mutation handlers from ShoppingListMain for better separation of concerns
 *
 * Handles:
 * - Quantity increment/decrement
 * - Toggle purchase status
 * - Delete item
 * - Clear all purchased
 * - Add item from search
 *
 * Note: Sort order updates are handled by useItemReordering (canonical handler)
 */
export function useShoppingListActions({
  currentListId,
  unpurchasedItems,
  purchasedItems,
  addItem,
  toggleItem,
  removeItem,
  refetchItems,
  setSearchQuery,
}: UseShoppingListActionsOptions) {
  const client = useApolloClient();
  const haptic = useHaptic();
  const { apply } = useWrite();

  const [updateQuantity] = useMutation(UpdateShoppingListItemQuantityDocument);

  /**
   * Move an item's quantity by a delta, locally first.
   *
   * Increment and decrement were two copies of this, identical but for the
   * arithmetic and the word in the warning — which is how they came to
   * disagree on what an absent quantity means (`|| 0` on one side, `?? 1` on
   * the other). Neither reading was visible in behaviour, because both landed
   * on 1 for every input.
   *
   * It reads as 0 here because that is what the row shows: `SortableItem`
   * renders `quantity ?? 0`. Reading an absent quantity as 1 would make "+"
   * jump from the 0 on screen straight to 2.
   */
  const adjustQuantity = async (itemId: string, delta: number) => {
    // The cached row is the only source for both halves of the write: the
    // quantity the arithmetic starts from, and the version the server checks.
    const cachedItem = client.readFragment<UseShoppingListActions_ItemFragment>(
      {
        id: `ShoppingListItem:${itemId}`,
        fragment: UseShoppingListActions_ItemFragmentDoc,
        fragmentName: 'useShoppingListActions_item',
      },
    );
    if (!cachedItem) {
      logger.warn('Item not in cache, cannot adjust quantity:', itemId);
      return;
    }

    // A row on a shopping list is never worth less than one of the thing, so
    // the floor is 1 in both directions rather than only on the way down.
    const newQuantity = Math.max(1, (cachedItem.quantity ?? 0) + delta);

    // The mutation carries the RESULT of the arithmetic, not the delta, so a
    // replay writes the same number twice rather than adding twice, and a
    // version conflict is resolved by re-sending against a fresh version.
    const { context, revert } = apply({
      target: { __typename: 'ShoppingListItem', id: itemId },
      patch: { quantity: newQuantity },
      convergence: 'absolute',
    });

    const fail = (error: unknown) => {
      // Undoes the local write from the intent's own inverse, so a concurrent
      // change to the same field is not clobbered by a restored snapshot.
      revert();
      handleMutationError(error, {
        operation: 'Update Quantity',
        checks: [versionConflictCheck({ onRefresh: () => refetchItems() })],
      });
    };

    let result;
    try {
      result = await updateQuantity({
        variables: {
          input: {
            itemId,
            quantity: newQuantity.toString(),
            version: cachedItem.version,
            // Claimed by the server BEFORE its version check, so a queued
            // replay converges instead of being refused on a stale version.
            idempotencyKey: generateEntityId(),
          },
        },
        context,
      });
    } catch (error) {
      fail(error);
      return;
    }

    // `errorPolicy: 'all'` RESOLVES a failed mutation with `error` set instead
    // of rejecting, so the catch above only sees a link-level throw. Both
    // outcomes must undo the local quantity — without this a refused update
    // stayed on screen with no message and no version-conflict refresh.
    if (result.error) {
      fail(result.error);
      return;
    }

    // A union refusal (ValidationError / ConflictError) arrives as DATA with no
    // `error`, so `onError` never fires and the branch above cannot see it. A
    // queued write classifies as `'queued'` and keeps the local quantity; the
    // queue owns its undo, including after a restart.
    if (classifyCreateResult(result) === 'rejected') {
      revert();
      alertRejectedMutation(result, t('errors.updateItemFailed'));
    }
  };

  const handleIncrementQuantity = (itemId: string) => adjustQuantity(itemId, 1);
  const handleDecrementQuantity = (itemId: string) =>
    adjustQuantity(itemId, -1);

  // Toggle purchase handler
  const handleTogglePurchase = async (itemId: string) => {
    Telemetry.trackEvent('toggle_item_purchase', { item_id: itemId });
    await executeTogglePurchase(haptic, toggleItem, itemId);
  };

  // Delete item handler
  const handleDeleteItem = async (itemId: string) => {
    Telemetry.trackEvent('delete_item', { item_id: itemId });
    await executeDeleteItem(haptic, removeItem, itemId);
  };

  // Clear items handler — online-only; the rows go on the server's response.
  const { clearItems } = useClearShoppingListItems({
    listId: currentListId,
    unpurchasedItems,
    purchasedItems,
    refetch: refetchItems,
  });

  const handleClearAllPurchased = async () => {
    if (purchasedItems.length === 0) return;
    await executeClearItems(haptic, clearItems, true);
  };

  // Clear all shopping (unpurchased) items handler
  const handleClearAllShopping = async () => {
    if (unpurchasedItems.length === 0) return;
    await executeClearItems(haptic, clearItems, false);
  };

  // Add item from search handler
  const handleAddItemFromSearch = async (itemName: string) => {
    if (!currentListId) {
      toastService.error(t('toasts.selectShoppingListFirst'));
      return;
    }

    Telemetry.trackEvent('add_item_from_search', {
      list_id: currentListId,
      item_name_length: itemName.trim().length,
    });

    // Clear search input immediately for instant feedback
    setSearchQuery('');

    await executeAddItemFromSearch(addItem, haptic, itemName, setSearchQuery);
  };

  return {
    // Quantity
    handleIncrementQuantity,
    handleDecrementQuantity,

    // Item actions
    handleTogglePurchase,
    handleDeleteItem,
    handleClearAllPurchased,
    handleClearAllShopping,
    handleAddItemFromSearch,
  };
}
