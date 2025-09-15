import {StateCreator} from 'zustand';
import {getPantryItemsApi} from '../api/services/pantryService';
import {PantryItem} from '../api/graphql/generated';

export interface PantryState {
  pantryItems: PantryItem[];
  addItemToPantry: (item: PantryItem) => Promise<void>;
  fetchPantryItems: () => Promise<void>;
  deletePantryItem: (id: string) => Promise<void>;
  editPantryItem: (id: string, data: Partial<PantryItem>) => Promise<void>;
}

export const initialPantryListState: Pick<PantryState, 'pantryItems'> = {
  pantryItems: [],
};

export const createPantrySlice: StateCreator<PantryState> = set => ({
  ...initialPantryListState,

  fetchPantryItems: async () => {
    try {
      const pantryItems = await getPantryItemsApi();
      set({pantryItems});
    } catch (error) {
      console.error('Error fetching pantry items lists:', error);
    }
  },
  addItemToPantry: async item => {
    try {
      // Here you would typically call an API to add the item
      // For now, we just log it
      console.log('Adding item to pantry:', item);
      set(state => ({
        pantryItems: [...state.pantryItems, item],
      }));
    } catch (error) {
      console.error('Error adding item to pantry:', error);
    }
  },
  deletePantryItem: async id => {
    try {
      // Here you would typically call an API to delete the item
      // For now, we just log it
      console.log('Deleting item from pantry:', id);
      set(state => ({
        pantryItems: state.pantryItems.filter(item => item.id !== id),
      }));
    } catch (error) {
      console.error('Error deleting item from pantry:', error);
    }
  },
  editPantryItem: async (id, data) => {
    try {
      // Here you would typically call an API to edit the item
      // For now, we just log it
      console.log('Editing item in pantry:', id, data);
      set(state => ({
        pantryItems: state.pantryItems.map(item =>
          item.id === id ? {...item, ...data} : item,
        ),
      }));
    } catch (error) {
      console.error('Error editing item in pantry:', error);
    }
  },
});
