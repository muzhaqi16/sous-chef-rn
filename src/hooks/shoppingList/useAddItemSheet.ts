import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { Telemetry } from '#/services/telemetry';

/**
 * Options for useAddItemSheet hook
 */
export interface UseAddItemSheetOptions {
  /** Current shopping list ID (required to add items) */
  currentListId: string | undefined;
  /** Callback to navigate to list settings */
  onNavigateToListSettings?: () => void;
}

/**
 * Return value from useAddItemSheet hook
 */
export interface UseAddItemSheetResult {
  /** Whether the sheet is visible */
  visible: boolean;
  /** Open the sheet (validates list is selected first) */
  open: () => void;
  /** Close the sheet */
  close: () => void;
}

/**
 * Hook to manage AddToShoppingListSheet state.
 *
 * Handles:
 * - Sheet visibility state
 * - Validation that a list is selected before opening
 * - Telemetry tracking
 *
 * @example
 * ```tsx
 * const addItemSheet = useAddItemSheet({
 *   currentListId,
 *   onNavigateToListSettings: () => navigate('ListSettings'),
 * });
 *
 * // In render:
 * <AddToShoppingListSheet
 *   visible={addItemSheet.visible}
 *   onClose={addItemSheet.close}
 *   shoppingListId={currentListId}
 * />
 * ```
 */
export function useAddItemSheet(
  options: UseAddItemSheetOptions,
): UseAddItemSheetResult {
  const { currentListId, onNavigateToListSettings } = options;

  const [visible, setVisible] = useState(false);

  const open = useCallback(() => {
    if (!currentListId) {
      Telemetry.trackEvent('add_item_no_list_selected');
      Alert.alert(
        'No List Selected',
        'Please select or create a shopping list first.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Create List',
            onPress: () => {
              Telemetry.trackEvent('create_list_from_add_item');
              onNavigateToListSettings?.();
            },
          },
        ],
      );
      return;
    }
    Telemetry.trackEvent('add_item_clicked', { list_id: currentListId });
    setVisible(true);
  }, [currentListId, onNavigateToListSettings]);

  const close = useCallback(() => {
    setVisible(false);
  }, []);

  return { visible, open, close };
}
