import {StateCreator} from 'zustand';
import {RootState} from '.';
import {fetchItemsApi} from '../api/services/shoppingListItemService';
import {ShoppingListItem} from '../api/graphql/generated';

export interface ShoppingListItemState {
  shoppingListItems: ShoppingListItem[] | null;
  getShoppingListItems: () => Promise<void>;
}

export const initialShoppingListItemState: Pick<
  ShoppingListItemState,
  'shoppingListItems'
> = {
  shoppingListItems: null,
};

export const createShoppingListItemSlice: StateCreator<
  RootState,
  [],
  [],
  ShoppingListItemState
> = (set, get) => ({
  ...initialShoppingListItemState,

  getShoppingListItems: async () => {
    try {
      const {defaultShoppingList} = get();
      if (!defaultShoppingList) {
        console.warn('No default shopping list set');
        return;
      }
      // Set is loading state if needed
      set({isFetching: true, isError: false});
      const items = await fetchItemsApi(defaultShoppingList.id);
      set({shoppingListItems: items});
    } catch (error) {
      console.error('Error fetching shopping list items:', error);
      set({isError: true});
    } finally {
      // 4) always turn fetching off
      set({isFetching: false});
    }
  },
});
