import { requirePlatform } from '#platform/install';
import { toastService } from '#/services/toastService';
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
}

// Module-level: their try bodies would otherwise bail the hook out of the
// React Compiler.
async function executeTogglePurchase(
  toggleItem: (itemId: string) => Promise<unknown>,
  itemId: string,
): Promise<void> {
  try {
    requirePlatform('haptics').selection();
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
    requirePlatform('haptics').warning();
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
    requirePlatform('haptics').warning();
    await clearItems(purchased);
  } catch {
    toastService.error(t('shoppingListScreens.failedToClear'));
  }
}

/**
 * Sort-order updates are NOT here — `useItemReordering` is the one handler.
 * Each action fires its own haptic, so every control that runs it gives the
 * same feedback, and a clear with nothing to remove gives none.
 */
export function useShoppingListActions({
  currentListId,
  unpurchasedItems,
  purchasedItems,
  toggleItem,
  removeItem,
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
