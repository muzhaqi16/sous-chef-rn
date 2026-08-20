import { useState } from 'react';
import { useFragment, useMutation } from '@apollo/client/react';
import { handleMutationError } from '#/utils/errorHandlers';
import { UpdateShoppingListItemQuantityDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { type ShoppingListItemDisplayFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UseQuantityEditModal_ItemFragmentDoc } from './useQuantityEditModal.generated';
import { Telemetry } from '#/services/telemetry';
import { t } from '#/i18n';
import { resolveImageUrl } from '#utils/imageUtils';
import { normalizeNumericTextForApi } from '#/utils/parseDecimalInput';
import { classifyCreateResult } from '#/apollo/utils/classifyCreateResult';
import { alertRejectedMutation } from '#/apollo/utils/alertRejectedMutation';

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
  /** Items array to find item by ID (fallback when the cache hasn't loaded yet) */
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
      handleMutationError(error, {
        operation: 'Update Shopping Item Quantity',
      });
    },
  });

  // Subscribe to the selected item in the cache. When `selectedItemId` is null
  // we pass `null` to `from` which makes `useFragment` return `complete: false`.
  const { data: liveItem, complete: liveItemComplete } = useFragment({
    fragment: UseQuantityEditModal_ItemFragmentDoc,
    fragmentName: 'useQuantityEditModal_item',
    from: selectedItemId
      ? { __typename: 'ShoppingListItem', id: selectedItemId }
      : null,
  });

  // Prefer the live cache copy; fall back to the snapshot in `items` for the
  // initial open before the cache has the entity (tests, edge cases).
  const fallbackItem = selectedItemId
    ? items.find(i => i.id === selectedItemId) ?? null
    : null;
  const selectedItemRaw =
    selectedItemId && liveItemComplete ? liveItem : fallbackItem;

  // Transform raw item to QuantityEditItem format
  const selectedItem: QuantityEditItem | null = selectedItemRaw
    ? {
        id: selectedItemRaw.id,
        itemName: selectedItemRaw.itemName || t('labels.item'),
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

    let result;
    try {
      result = await updateQuantity({
        variables: {
          input: {
            itemId: selectedItemRaw.id,
            // Separators normalized, fraction preserved: the server parses this
            // string itself and rejects a comma decimal outright, so a
            // comma-decimal keypad would otherwise lose every fractional edit.
            quantity: normalizeNumericTextForApi(quantity),
            unitId,
            version: selectedItemRaw.version,
          },
        },
      });
    } catch {
      // A link-level throw; the mutation's onError has already reported it.
    }

    setIsLoading(false);

    // A refused quantity resolves as a ValidationError payload with no `error`,
    // so onError never fires. Closing the sheet on that reads as a save that
    // took, and the value the user typed is simply gone. Keep the sheet open
    // and say so instead. 'queued' (offline) replays via SyncShoppingListItem,
    // so it closes like a success.
    if (classifyCreateResult(result) === 'rejected') {
      alertRejectedMutation(result, t('errors.adjustQuantityFailed'));
      return;
    }

    Telemetry.trackEvent('shopping_item_quantity_updated', {
      item_id: selectedItemRaw.id,
      quantity,
    });

    setVisible(false);
    setSelectedItemId(null);
  };

  return { visible, selectedItem, isLoading, openForItem, close, save };
}
