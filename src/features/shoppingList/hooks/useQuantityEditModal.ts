import { useState } from 'react';
import { alertService } from '#/services/alertService';
import { useFragment, useMutation } from '@apollo/client/react';
import { UpdateShoppingListItemQuantityDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import {
  ShoppingListItemDisplayFragmentDoc,
  type ShoppingListItemDisplayFragment,
} from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { Telemetry } from '#/services/telemetry';
import { executeMutation } from '#/utils/compilerSafeWrappers';
import { resolveImageUrl } from '#utils/imageUtils';

/**
 * Transformed item for QuantityEditSheet
 */
export interface QuantityEditItem {
  id: string;
  itemName: string;
  quantity: number;
  unitName: string | null;
  unitId: string | null;
  category: string | null;
  imageUrl?: string | null;
  version: number;
  itemUnits: Array<{
    id: string;
    symbol: string;
    name: string;
    isDefault: boolean;
    isPreferred: boolean;
    displayNameSingular?: string | null;
    displayNamePlural?: string | null;
  }>;
}

/**
 * Options for useQuantityEditModal hook
 */
export interface UseQuantityEditModalOptions {
  /** Items array to find item by ID */
  items: ShoppingListItemDisplayFragment[];
}

/**
 * Return value from useQuantityEditModal hook
 */
export interface UseQuantityEditModalResult {
  /** Whether the modal is visible */
  visible: boolean;
  /** Transformed item for QuantityEditSheet (or null if not selected) */
  selectedItem: QuantityEditItem | null;
  /** Whether a save operation is in progress */
  isLoading: boolean;
  /** Open modal for a specific item */
  openForItem: (itemId: string) => void;
  /** Close the modal */
  close: () => void;
  /** Save quantity changes */
  save: (
    quantity: string,
    unitName: string | null,
    unitId: string | null,
  ) => Promise<void>;
}

/**
 * Hook to manage QuantityEditSheet state and mutations.
 *
 * Stores only the entity id in state; the live item is read from the Apollo
 * cache via `useFragment`, so mutations to the item are reflected in the open
 * sheet without re-snapshotting.
 */
export function useQuantityEditModal(
  options: UseQuantityEditModalOptions,
): UseQuantityEditModalResult {
  const { items } = options;

  const [visible, setVisible] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Update mutation
  const [updateQuantity] = useMutation(UpdateShoppingListItemQuantityDocument, {
    onError: error => {
      alertService.alert('Error', error.message || 'Failed to update item');
    },
  });

  // Subscribe to the selected item in the cache. When `selectedItemId` is null
  // we pass `null` to `from` which makes `useFragment` return `complete: false`.
  const { data: liveItem, complete: liveItemComplete } = useFragment({
    fragment: ShoppingListItemDisplayFragmentDoc,
    fragmentName: 'ShoppingListItemDisplayFragment',
    from: selectedItemId
      ? { __typename: 'ShoppingListItem', id: selectedItemId }
      : null,
  });

  // Prefer the live cache copy; fall back to the snapshot in `items` for the
  // initial open before the cache has the entity (tests, edge cases).
  const fallbackItem = selectedItemId
    ? items.find(i => i.id === selectedItemId) ?? null
    : null;
  const selectedItemRaw: ShoppingListItemDisplayFragment | null =
    selectedItemId && liveItemComplete ? liveItem : fallbackItem;

  // Transform raw item to QuantityEditItem format
  const selectedItem: QuantityEditItem | null = selectedItemRaw
    ? {
        id: selectedItemRaw.id,
        itemName: selectedItemRaw.itemName || 'Item',
        quantity: selectedItemRaw.quantity ?? 0,
        unitName:
          selectedItemRaw.unit?.symbol || selectedItemRaw.unitName || null,
        unitId: selectedItemRaw.unit?.id || null,
        category: selectedItemRaw.category || null,
        imageUrl: resolveImageUrl(selectedItemRaw) || null,
        version: selectedItemRaw.version,
        // Units are available on the Full fragment (detail view) but not the Display
        // fragment used in list views. Provide the current unit as the only option.
        itemUnits: selectedItemRaw.unit
          ? [
              {
                id: selectedItemRaw.unit.id,
                symbol: selectedItemRaw.unit.symbol,
                name: selectedItemRaw.unit.name,
                isDefault: true,
                isPreferred: true,
                displayNameSingular: null,
                displayNamePlural: null,
              },
            ]
          : [],
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

  const save = async (
    quantity: string,
    _unitName: string | null,
    unitId: string | null,
  ) => {
    if (!selectedItemRaw) return;

    setIsLoading(true);

    await executeMutation(
      async () => {
        await updateQuantity({
          variables: {
            itemId: selectedItemRaw.id,
            quantity,
            unitId,
            version: selectedItemRaw.version,
          },
        });

        Telemetry.trackEvent('shopping_item_quantity_updated', {
          item_id: selectedItemRaw.id,
          quantity,
        });

        setVisible(false);
        setSelectedItemId(null);
      },
      () => {
        // Error handled by mutation onError
      },
    );

    setIsLoading(false);
  };

  return { visible, selectedItem, isLoading, openForItem, close, save };
}
