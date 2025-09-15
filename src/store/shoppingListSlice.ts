import {StateCreator} from 'zustand';
import {
  fetchShoppingListsApi,
  createShoppingListApi,
  shareShoppingListApi,
} from '../api/services/shoppingListService';
import {RootState} from '.';
import {ShoppingList} from '../api/graphql/generated';

export interface ShoppingListState {
  shoppingLists: ShoppingList[] | null;
  defaultShoppingList: ShoppingList | null;
  addQuantity: (id: string) => Promise<void>;
  removeQuantity: (id: string) => Promise<void>;
  deleteFromList: (id: string) => Promise<void>;
  moveToPantry: (id: string) => Promise<void>;
  fetchShoppingLists: () => Promise<void>;
  createShoppingList: (name: string) => Promise<void>;
  shareShoppingList: (shoppingListId: string, email: string) => Promise<void>;
  setDefaultShoppingList: (shoppingList: ShoppingList) => void;
}

export const initialShoppingListState: Pick<
  ShoppingListState,
  'shoppingLists' | 'defaultShoppingList'
> = {
  shoppingLists: null,
  defaultShoppingList: null,
};

export const createShoppingListSlice: StateCreator<
  RootState,
  [],
  [],
  ShoppingListState
> = (set, get) => ({
  ...initialShoppingListState,

  fetchShoppingLists: async () => {
    try {
      const lists = await fetchShoppingListsApi();
      set({shoppingLists: lists});

      set(state => ({
        defaultShoppingList: state.defaultShoppingList || lists[0] || null,
      }));
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
      // Optionally, you could surface the error to state or return it:
      // throw error;
    }
  },

  createShoppingList: async name => {
    try {
      const newList = await createShoppingListApi(name);
      set(state => ({
        shoppingLists: [...(state.shoppingLists ?? []), newList],
        defaultShoppingList: state.defaultShoppingList || newList,
      }));
    } catch (error) {
      console.error('Error creating shopping list:', error);
      // Optionally rethrow or handle
    }
  },

  shareShoppingList: async (shoppingListId, email) => {
    try {
      await shareShoppingListApi(shoppingListId, email);
      // You might want to update local state, e.g. refetch or mark collaborator added:
      // e.g. call fetchShoppingLists again, or update a specific list
    } catch (error) {
      console.error('Error sharing shopping list:', error);
    }
  },

  setDefaultShoppingList: shoppingList => {
    set({defaultShoppingList: shoppingList});
  },
  addQuantity: async id => {
    // Implement logic to add quantity to an item in the shopping list
    console.log(`Adding quantity for item with id: ${id}`);
    // This is a placeholder; actual implementation would involve API calls
  },
  removeQuantity: async id => {
    // Implement logic to remove quantity from an item in the shopping list
    console.log(`Removing quantity for item with id: ${id}`);
    // This is a placeholder; actual implementation would involve API calls
  },
  deleteFromList: async id => {
    // Implement logic to delete an item from the shopping list
    console.log(`Deleting item with id: ${id}`);
    // This is a placeholder; actual implementation would involve API calls
  },
  moveToPantry: async id => {
    // Implement logic to move an item from the shopping list to the pantry
    console.log(`Moving item with id: ${id} to pantry`);
    // This is a placeholder; actual implementation would involve API calls
  },
});
