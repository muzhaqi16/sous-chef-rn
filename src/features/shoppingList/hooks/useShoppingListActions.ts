import { toastService } from '#/services/toastService';
import { HapticService } from '#services/haptic/HapticService';
import { Telemetry } from '#/services/telemetry';
import { useClearShoppingListItems } from './mutations/useClearShoppingListItems';
import type { ShoppingListItemNode } from './usePaginatedShoppingItems';
import { t } from '#/i18n';

interface UseShoppingListActionsOptions {
  currentListId: string | undefined;
  unpurchasedItems: ShoppingListItemNode[];
  purchasedItems: ShoppingListItemNode[];
  toggleItem: (itemId: string) => Promise<unknown>;
  removeItem: (itemId: string) => Promise<boolean>;
  refetchItems: () => Promise<unknown>;
}

// Module-level: their try bodies would otherwise bail the hook out of the
// React Compiler.
async function executeTogglePurchase(
  toggleItem: (itemId: string) => Promise<unknown>,
  itemId: string,
): Promise<void> {
  try {
    HapticService.selection();
    await toggleItem(itemId);
    Telemetry.trackEvent('toggle_item_purchase_success');
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to toggle item purchase',
      { component: 'ShoppingListMain', operation: 'togglePurchase' },
    );
    toastService.error(t('toasts.itemToggleFailed'));
  }
}

async function executeDeleteItem(
  removeItem: (itemId: string) => Promise<boolean>,
  itemId: string,
): Promise<void> {
  try {
    HapticService.warning();
    // A refusal is reported by `removeItem` itself; only a removal that took
    // effect counts as a success.
    if (await removeItem(itemId)) Telemetry.trackEvent('delete_item_success');
  } catch (error) {
    Telemetry.trackError(
      error instanceof Error ? error : 'Failed to delete item',
      { component: 'ShoppingListMain', operation: 'deleteItem' },
    );
    toastService.error(t('errors.deleteItemFailed'));
  }
}

async function executeClearItems(
  clearItems: (purchased: boolean) => Promise<void>,
  purchased: boolean,
): Promise<void> {
  try {
    HapticService.warning();
    await clearItems(purchased);
  } catch {
    toastService.error(t('shoppingListScreens.failedToClear'));
  }
}

/** Sort-order updates are NOT here — `useItemReordering` is the one handler. */
export function useShoppingListActions({
  currentListId,
  unpurchasedItems,
  purchasedItems,
  toggleItem,
  removeItem,
  refetchItems,
}: UseShoppingListActionsOptions) {
  const handleTogglePurchase = async (itemId: string) => {
    Telemetry.trackEvent('toggle_item_purchase', { item_id: itemId });
    await executeTogglePurchase(toggleItem, itemId);
  };

  const handleDeleteItem = async (itemId: string) => {
    Telemetry.trackEvent('delete_item', { item_id: itemId });
    await executeDeleteItem(removeItem, itemId);
  };

  const { clearItems } = useClearShoppingListItems({
    listId: currentListId,
    unpurchasedItems,
    purchasedItems,
    refetch: refetchItems,
  });

  const handleClearAllPurchased = async () => {
    if (purchasedItems.length === 0) return;
    await executeClearItems(clearItems, true);
  };

  const handleClearAllShopping = async () => {
    if (unpurchasedItems.length === 0) return;
    await executeClearItems(clearItems, false);
  };

  return {
    handleTogglePurchase,
    handleDeleteItem,
    handleClearAllPurchased,
    handleClearAllShopping,
  };
}
