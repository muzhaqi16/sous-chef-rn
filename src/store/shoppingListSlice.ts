import {StateCreator} from 'zustand';
import {
  fetchShoppingListsApi,
  createShoppingListApi,
  shareShoppingListApi,
} from '../api/services/shoppingListService';
import {ShoppingList} from '../types';

export interface ShoppingListState {
  shoppingLists: ShoppingList[];
  defaultShoppingList: ShoppingList | null;
  fetchShoppingLists: () => Promise<void>;
  createShoppingList: (name: string) => Promise<void>;
  shareShoppingList: (shoppingListId: string, email: string) => Promise<void>;
  setDefaultShoppingList: (shoppingList: ShoppingList) => void;
}

export const initialShoppingListState: Pick<
  ShoppingListState,
  'shoppingLists' | 'defaultShoppingList'
> = {
  shoppingLists: [],
  defaultShoppingList: null,
};

export const createShoppingListSlice: StateCreator<
  ShoppingListState
> = set => ({
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
        shoppingLists: [...state.shoppingLists, newList],
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
});
