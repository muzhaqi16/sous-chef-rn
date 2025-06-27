import {StateCreator} from 'zustand';
import {getPantryItemsApi} from '../api/services/pantryService';
import {PantryItem} from '../api/graphql/generated';

export interface PantryState {
  pantryItems: PantryItem[];
  fetchPantryItems: () => Promise<void>;
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
});
