import { useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import {
  useUpdateShoppingListItemQuantityMutation,
  ShoppingListItemDisplayFragment,
} from '#generated';
import { Telemetry } from '#/services/telemetry';
import { useStableRef } from '#/hooks/utils/useStableRef';
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
 * Handles:
 * - Modal visibility state
 * - Selected item transformation for QuantityEditSheet
 * - Update mutation with loading state
 * - Error handling with alerts
 *
 * @example
 * ```tsx
 * const quantityEdit = useQuantityEditModal({ items });
 *
 * // In render:
 * <QuantityEditSheet
 *   visible={quantityEdit.visible}
 *   item={quantityEdit.selectedItem}
 *   onClose={quantityEdit.close}
 *   onSave={quantityEdit.save}
 *   loading={quantityEdit.isLoading}
 * />
 * ```
 */
export function useQuantityEditModal(
  options: UseQuantityEditModalOptions,
): UseQuantityEditModalResult {
  const { items } = options;

  const [visible, setVisible] = useState(false);
  const [selectedItemRaw, setSelectedItemRaw] =
    useState<ShoppingListItemDisplayFragment | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Store items in stable ref to avoid recreating callbacks on every items change
  const itemsRef = useStableRef(items);

  // Update mutation
  const [updateQuantity] = useUpdateShoppingListItemQuantityMutation({
    errorPolicy: 'all',
    onError: error => {
      Alert.alert('Error', error.message || 'Failed to update item');
    },
  });

  // Transform raw item to QuantityEditItem format
  const selectedItem: QuantityEditItem | null = useMemo(
    () =>
      selectedItemRaw
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
            itemUnits:
              selectedItemRaw.item?.units
                ?.map(iu => ({
                  id: iu.unit?.id || iu.id,
                  symbol: iu.unit?.symbol || '',
                  name: iu.unit?.name || '',
                  isDefault: iu.isDefault,
                  isPreferred: iu.isPreferred,
                  displayNameSingular: iu.displayNameSingular,
                  displayNamePlural: iu.displayNamePlural,
                }))
                .filter(
                  u => u.symbol && u.symbol.toLowerCase() !== 'undetermined',
                ) || [],
          }
        : null,
    [selectedItemRaw],
  );

  const openForItem = useCallback((itemId: string) => {
    const item = itemsRef.current.find(i => i.id === itemId);
    if (item) {
      setSelectedItemRaw(item as ShoppingListItemDisplayFragment);
      setVisible(true);
    }
  }, [itemsRef]);

  const close = useCallback(() => {
    setVisible(false);
    setSelectedItemRaw(null);
  }, []);

  const save = useCallback(
    async (
      quantity: string,
      _unitName: string | null,
      unitId: string | null,
    ) => {
      if (!selectedItemRaw) return;

      setIsLoading(true);
      try {
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
        setSelectedItemRaw(null);
      } catch {
        // Error handled by mutation onError
      } finally {
        setIsLoading(false);
      }
    },
    [selectedItemRaw, updateQuantity],
  );

  return { visible, selectedItem, isLoading, openForItem, close, save };
}
