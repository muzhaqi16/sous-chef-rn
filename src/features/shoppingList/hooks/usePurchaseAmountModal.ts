import { useState } from 'react';
import { useFragment } from '@apollo/client/react';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UsePurchaseAmountModal_ItemFragmentDoc } from './usePurchaseAmountModal.generated';
import { t } from '#/i18n';
import { unitPriceFromTotal } from '#features/shoppingList/utils/purchasePrice';

export interface PurchaseAmountItem {
  id: string;
  itemName: string;
  requestedQuantity: number;
  unitName: string | null;
  /** PER UNIT estimate; the sheet multiplies it out to seed the total input. */
  estimatedPrice: number | null;
}

export interface RecordPurchaseAmounts {
  purchasedQuantity: number;
  /**
   * PER UNIT — the API multiplies it by `purchasedQuantity` to record
   * `Purchase.totalPrice`, and move-to-pantry derives its per-unit cost from it.
   */
  purchasedPrice: number | null;
}

export interface UsePurchaseAmountModalOptions {
  /** Fallback lookup for the initial open, before the cache holds the entity. */
  items: ShoppingListItemDisplayFragment[];
  /** Owned by `useToggleShoppingItem`; this hook never runs the mutation. */
  recordPurchase: (
    itemId: string,
    amounts: RecordPurchaseAmounts,
  ) => Promise<boolean>;
}

export interface UsePurchaseAmountModalResult {
  visible: boolean;
  selectedItem: PurchaseAmountItem | null;
  isLoading: boolean;
  openForItem: (itemId: string) => void;
  close: () => void;
  /** Takes the TOTAL paid, not the per-unit price. */
  confirm: (quantity: number, totalPrice: number | null) => Promise<void>;
}

/**
 * Opens pre-filled when an unpurchased item is marked purchased; Cancel leaves
 * the item unpurchased. Only the entity id is held in state — the live item is
 * read from the cache via `useFragment`, so updates reach the open sheet.
 */
export function usePurchaseAmountModal(
  options: UsePurchaseAmountModalOptions,
): UsePurchaseAmountModalResult {
  const { items, recordPurchase } = options;

  const [visible, setVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // `from: null` makes `useFragment` return `complete: false`.
  const { data: liveItem, complete: liveItemComplete } = useFragment({
    fragment: UsePurchaseAmountModal_ItemFragmentDoc,
    fragmentName: 'usePurchaseAmountModal_item',
    from: selectedItemId
      ? { __typename: 'ShoppingListItem', id: selectedItemId }
      : null,
  });

  // The `items` snapshot covers the initial open before the cache has the entity;
  // the Display fragment lacks `priceEstimate`, so that path shows no estimate
  // until the live copy arrives.
  const fallbackItem = selectedItemId
    ? items.find(i => i.id === selectedItemId) ?? null
    : null;
  const useLive = !!selectedItemId && liveItemComplete;
  const liveEstimatedPrice = useLive
    ? liveItem.priceEstimate?.estimated ?? null
    : null;
  const selectedItemRaw = useLive ? liveItem : fallbackItem;

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

  const confirm = async (quantity: number, totalPrice: number | null) => {
    if (!selectedItem) return;

    setIsLoading(true);
    await recordPurchase(selectedItem.id, {
      purchasedQuantity: quantity,
      // The sheet collects what the receipt says; the API stores per unit.
      purchasedPrice: unitPriceFromTotal(totalPrice, quantity),
    });
    setIsLoading(false);

    close();
  };

  return { visible, selectedItem, isLoading, openForItem, close, confirm };
}
