// src/store/shoppingListSlice.ts
import {StateCreator} from 'zustand';
import {client} from '../apollo/client';
import {GET_SHOPPING_LISTS} from '../api/queries';
import {
  CREATE_SHOPPING_LIST,
  ADD_COLLABORATOR_MUTATION,
} from '../api/mutations';
import {CollaboratorRole, ShoppingList} from '../types';

export interface ShoppingListState {
  shoppingLists: ShoppingList[];
  defaultShoppingList: ShoppingList | null;
  fetchShoppingLists: () => Promise<void>;
  createShoppingList: (name: string) => Promise<void>;
  setDefaultShoppingList: (shoppingList: ShoppingList) => void;
}

export const createShoppingListSlice: StateCreator<
  ShoppingListState
> = set => ({
  shoppingLists: [],
  defaultShoppingList: null,

  // Fetch all shopping lists from the backend
  fetchShoppingLists: async () => {
    try {
      const {data} = await client.query({
        query: GET_SHOPPING_LISTS,
      });

      const lists: ShoppingList[] = data.shoppingLists;
      set({shoppingLists: lists});
      // If there is no default yet, set the first one as default.
      set(state => ({
        defaultShoppingList: state.defaultShoppingList || lists[0] || null,
      }));
    } catch (error) {
      console.error('Error fetching shopping lists:', error);
    }
  },

  // Create a new shopping list
  createShoppingList: async (name: string) => {
    try {
      const {data} = await client.mutate({
        mutation: CREATE_SHOPPING_LIST,
        variables: {name},
      });
      const newList = data.createShoppingList;
      set(state => ({
        shoppingLists: [...state.shoppingLists, newList],
        // If no default is set, use the new list as the default.
        defaultShoppingList: state.defaultShoppingList || newList,
      }));
    } catch (error) {
      console.error('Error creating shopping list:', error);
    }
  },
  // Share shopping list with another user by email
  shareShoppingList: async (shoppingListId: string, email: string) => {
    try {
      await client.mutate({
        mutation: ADD_COLLABORATOR_MUTATION,
        variables: {
          data: {shoppingListId, email, role: CollaboratorRole.EDITOR},
        },
      });
    } catch (error) {
      console.error('Error sharing shopping list:', error);
    }
  },
  // Manually set a shopping list as the default
  setDefaultShoppingList: (shoppingList: ShoppingList) => {
    set({defaultShoppingList: shoppingList});
  },
});
