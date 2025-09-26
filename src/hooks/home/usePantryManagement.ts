import { Alert } from 'react-native';
import {
  useAddItemToPantryMutation,
  useUpdatePantryItemMutation,
  useRemoveItemFromPantryMutation,
  StorageState,
} from '#generated';
import { usePantryItems } from '#hooks/pantry/usePantryItems';

export interface PantryItemInput {
  itemName: string;
  brand?: string;
  quantity: number;
  unit?: string;
  unitId: string;
  autoReorderPoint?: number;
  storageState: StorageState;
  location?: string;
  expirationDate?: string;
  notes?: string;
  category?: string;
  barcode?: string;
  imageUrl?: string;
}

export interface PantryItemUpdate extends Partial<PantryItemInput> {
  currentQuantity?: number;
}

/**
 * Simplified pantry management hook using consolidated usePantryItems
 * Focuses on mutations while delegating data management to usePantryItems
 */
export function usePantryManagement(pantryId: string | undefined) {
  // Use the consolidated pantry items hook for all data operations
  const pantryData = usePantryItems(pantryId);

  // Mutations with Apollo's optimistic updates
  const [addItemMutation] = useAddItemToPantryMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Add item error:', error);
      Alert.alert('Error', 'Failed to add item');
    },
  });

  const [updateItemMutation] = useUpdatePantryItemMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Update item error:', error);
      Alert.alert('Error', 'Failed to update item');
    },
  });

  const [removeItemMutation] = useRemoveItemFromPantryMutation({
    errorPolicy: 'all',
    onError: error => {
      console.error('Remove item error:', error);
      Alert.alert('Error', 'Failed to remove item');
    },
  });

  // Simplified add item - let Apollo handle optimistic updates
  const addItem = async (input: PantryItemInput) => {
    if (!pantryId) return false;

    try {
      const result = await addItemMutation({
        variables: {
          input: {
            pantryId,
            initialQuantity: input.quantity,
            itemName: input.itemName,
            unitId: input.unitId,
            storageState: input.storageState,
            ...(input.brand && { itemBrand: input.brand }),
            ...(input.location && { storageLocation: input.location }),
            ...(input.expirationDate && { expiresAt: input.expirationDate }),
            ...(input.notes && { storageNotes: input.notes }),
            ...(input.category && { itemCategory: input.category }),
            ...(input.barcode && { itemUpc: input.barcode }),
          },
        },
        // Apollo will handle cache updates automatically
      });

      return result.data?.addItemToPantry ?? false;
    } catch (error) {
      console.error('Add item error:', error);
      return false;
    }
  };

  // Simplified update item
  const updateItem = async (itemId: string, updates: PantryItemUpdate) => {
    if (!pantryId) return false;

    try {
      const result = await updateItemMutation({
        variables: {
          id: itemId,
          input: updates,
        },
      });

      return result.data?.updatePantryItem ?? false;
    } catch (error) {
      console.error('Update item error:', error);
      return false;
    }
  };

  // Simplified remove item
  const removeItem = async (itemId: string) => {
    if (!pantryId) return false;

    try {
      await removeItemMutation({
        variables: { id: itemId },
      });

      return true;
    } catch (error) {
      console.error('Remove item error:', error);
      return false;
    }
  };

  return {
    // Data from consolidated pantry hook
    ...pantryData,

    // Additional mutation actions
    addItem,
    updateItem,
    removeItem,
  };
}
