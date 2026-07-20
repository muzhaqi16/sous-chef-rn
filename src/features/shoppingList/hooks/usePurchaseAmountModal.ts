import { useState } from 'react';
import { useFragment } from '@apollo/client/react';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UsePurchaseAmountModal_ItemFragmentDoc } from './usePurchaseAmountModal.generated';
import { t } from '#/i18n/t';

/**
 * Transformed item for PurchaseAmountSheet
 */
export interface PurchaseAmountItem {
  id: string;
  itemName: string;
  /** Requested quantity to pre-fill the quantity input (defaults to 1) */
  requestedQuantity: number;
  /** Unit symbol/name shown as a suffix on the quantity input */
  unitName: string | null;
  /** Estimated price to pre-fill the price input (null when unknown) */
  estimatedPrice: number | null;
}

/**
 * Recorded purchase amounts confirmed by the user.
 */
export interface RecordPurchaseAmounts {
  purchasedQuantity: number;
  purchasedPrice: number | null;
}

/**
 * Options for usePurchaseAmountModal hook
 */
export interface UsePurchaseAmountModalOptions {
  /** Items array to find item by ID (fallback when the cache hasn't loaded yet) */
  items: ShoppingListItemDisplayFragment[];
  /**
   * Records the actual purchase amounts. Owned by `useToggleShoppingItem` and
   * threaded down through the screen facade — this hook never instantiates the
   * mutation itself.
   */
  recordPurchase: (
    itemId: string,
    amounts: RecordPurchaseAmounts,
  ) => Promise<boolean>;
}

/**
 * Return value from usePurchaseAmountModal hook
 */
export interface UsePurchaseAmountModalResult {
  /** Whether the modal is visible */
  visible: boolean;
  /** Transformed item for PurchaseAmountSheet (or null if not selected) */
  selectedItem: PurchaseAmountItem | null;
  /** Whether a record operation is in progress */
  isLoading: boolean;
  /** Open modal for a specific item */
  openForItem: (itemId: string) => void;
  /** Close the modal */
  close: () => void;
  /** Record the confirmed purchase amounts, then close */
  confirm: (quantity: number, price: number | null) => Promise<void>;
}

/**
 * Hook to manage PurchaseAmountSheet state.
 *
 * When the user marks an unpurchased item as purchased, this opens a pre-filled
 * sheet (requested quantity + estimated price). Confirm records the actual
 * amounts via the passed-in `recordPurchase`; Cancel leaves the item unpurchased.
 *
 * Stores only the entity id in state; the live item is read from the Apollo
 * cache via `useFragment`, so cache updates are reflected in the open sheet.
 */
export function usePurchaseAmountModal(
  options: UsePurchaseAmountModalOptions,
): UsePurchaseAmountModalResult {
  const { items, recordPurchase } = options;

  const [visible, setVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to the selected item in the cache. When `selectedItemId` is null
  // we pass `null` to `from` which makes `useFragment` return `complete: false`.
  const { data: liveItem, complete: liveItemComplete } = useFragment({
    fragment: UsePurchaseAmountModal_ItemFragmentDoc,
    fragmentName: 'usePurchaseAmountModal_item',
    from: selectedItemId
      ? { __typename: 'ShoppingListItem', id: selectedItemId }
      : null,
  });

  // Prefer the live cache copy; fall back to the snapshot in `items` for the
  // initial open before the cache has the entity (tests, edge cases). The
  // Display fragment lacks `priceEstimate`, so the fallback yields a null
  // estimated price — acceptable, the cache copy fills it in moments later.
  const fallbackItem = selectedItemId
    ? items.find(i => i.id === selectedItemId) ?? null
    : null;
  const useLive = !!selectedItemId && liveItemComplete;
  const liveEstimatedPrice = useLive
    ? liveItem.priceEstimate?.estimated ?? null
    : null;
  const selectedItemRaw = useLive ? liveItem : fallbackItem;

  // Transform raw item to PurchaseAmountItem format
  const selectedItem: PurchaseAmountItem | null = selectedItemRaw
    ? {
        id: selectedItemRaw.id,
        itemName: selectedItemRaw.itemName || t('labels.item'),
        requestedQuantity: selectedItemRaw.quantity ?? 1,
        unitName:
          selectedItemRaw.unit?.symbol || selectedItemRaw.unitName || null,
        estimatedPrice: liveEstimatedPrice,
      }
    : null;

  const openForItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setSelectedItemId(item.id);
      setVisible(true);
    }
  };

  const close = () => {
    setVisible(false);
    setSelectedItemId(null);
  };

  const confirm = async (quantity: number, price: number | null) => {
    if (!selectedItem) return;

    setIsLoading(true);
    await recordPurchase(selectedItem.id, {
      purchasedQuantity: quantity,
      purchasedPrice: price,
    });
    setIsLoading(false);

    close();
  };

  return { visible, selectedItem, isLoading, openForItem, close, confirm };
}
