import {StateCreator} from 'zustand';
import {client} from '../apollo/client';
import {GET_SHOPPING_LIST_ITEMS} from '../api/queries';
import {ADD_ITEM, REMOVE_ITEM} from '../api/mutations';

export interface Item {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

export interface ItemsState {
  items: Item[];
  fetchItems: ({shoppingListId}: {shoppingListId: string}) => Promise<void>;
  addItem: (name: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  setItems: (items: Item[]) => void;
}

export const createItemsSlice: StateCreator<ItemsState> = set => ({
  items: [],

  // Fetch all items for the current shopping list
  fetchItems: async ({shoppingListId}) => {
    try {
      const {data} = await client.query({
        query: GET_SHOPPING_LIST_ITEMS,
        variables: {shoppingListId},
      });
      set({items: data.items});
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  },

  // Add a new item to the list
  addItem: async (name, quantity) => {
    try {
      const {data} = await client.mutate({
        mutation: ADD_ITEM,
        variables: {name, quantity},
      });
      set(state => ({items: [...state.items, data.addItem]}));
    } catch (error) {
      console.error('Error adding item:', error);
    }
  },

  // Remove an item from the list
  removeItem: async id => {
    try {
      await client.mutate({
        mutation: REMOVE_ITEM,
        variables: {id},
      });
      set(state => ({items: state.items.filter(i => i.id !== id)}));
    } catch (error) {
      console.error('Error removing item:', error);
    }
  },

  setItems: (items: Item[]) => set({items}),
});
