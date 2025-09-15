import {StateCreator} from 'zustand';
import {
  fetchItemsApi,
  addItemApi,
  removeItemApi,
} from '../api/services/shoppingListItemService';
import {ShoppingListItem} from '../api/graphql/generated';

export interface ItemsState {
  items: ShoppingListItem[];

  /**
   * Fetch items for a shopping list.
   * @param params.shoppingListId
   */
  fetchItems: ({shoppingListId}: {shoppingListId: string}) => Promise<void>;

  /**
   * Add a new item.
   * @param name
   * @param quantity
   * @param price
   * @param shoppingListId optional ID if needed
   */
  addItem: (
    name: string,
    quantity: number,
    price: number,
    shoppingListId?: string,
  ) => Promise<void>;

  /**
   * Remove an item by ID.
   * @param id
   */
  removeItem: (id: string) => Promise<void>;

  /**
   * Directly set the items array (e.g., for initialization or reset).
   */
  setItems: (items: ShoppingListItem[]) => void;
}

// Optionally define an initial state object:
export const initialItemsState: Pick<ItemsState, 'items'> = {
  items: [],
};

export const createItemsSlice: StateCreator<ItemsState> = set => ({
  items: [],

  fetchItems: async ({shoppingListId}) => {
    try {
      const itemsFromApi: ShoppingListItem[] =
        await fetchItemsApi(shoppingListId);
      set({items: itemsFromApi});
    } catch (error) {
      console.error('Error fetching items:', error);
      // Optionally: set an error state if you add one
    }
  },

  addItem: async (name, quantity, price, shoppingListId) => {
    try {
      const newItem: ShoppingListItem = await addItemApi(
        name,
        quantity,
        price,
        shoppingListId,
      );
      set(state => ({items: [...state.items, newItem]}));
    } catch (error) {
      console.error('Error adding item:', error);
    }
  },

  removeItem: async id => {
    try {
      await removeItemApi(id);
      set(state => ({items: state.items.filter(i => i.id !== id)}));
    } catch (error) {
      console.error('Error removing item:', error);
    }
  },

  setItems: (items: ShoppingListItem[]) => {
    set({items});
  },
});
