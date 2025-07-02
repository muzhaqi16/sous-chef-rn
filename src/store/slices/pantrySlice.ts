import {StateCreator} from 'zustand';
import {immer} from 'zustand/middleware/immer';
import {RootState} from '../index';
import {
  getPantryItemsApi,
  deletePantryItemApi,
  updatePantryItemApi,
} from '../../api/services/pantryService';
import {PantryItem} from '../../api/graphql/generated';

export interface PantryState {
  pantryById: Record<string, PantryItem>;
  pantryIds: string[];
  sharedWithHousehold: Record<string, string[]>;

  // core: your existing reducers
  setPantryItems: (items: PantryItem[]) => void;
  upsertPantryItem: (item: PantryItem) => void;
  removePantryItem: (id: string) => void;
  setShared: (id: string, m: string[]) => void;

  fetchPantryItems: () => Promise<void>;
  deletePantryItem: (id: string) => Promise<void>;
  editPantryItem: (id: string, data: Partial<PantryItem>) => Promise<void>;
}

export const createPantrySlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  PantryState
> = (set, get) => ({
  pantryById: {},
  pantryIds: [],
  sharedWithHousehold: {},

  setPantryItems: items => {
    set(state => {
      state.pantryById = {};
      state.pantryIds = [];
      items.forEach(it => {
        state.pantryById[it.id] = it;
        state.pantryIds.push(it.id);
      });
    });
  },

  upsertPantryItem: item => {
    set(state => {
      if (!state.pantryById[item.id]) state.pantryIds.push(item.id);
      state.pantryById[item.id] = item;
    });
  },

  removePantryItem: id => {
    set(state => {
      delete state.pantryById[id];
      state.pantryIds = state.pantryIds.filter(x => x !== id);
      delete state.sharedWithHousehold[id];
    });
  },

  setShared: (id, members) => {
    set(state => {
      state.sharedWithHousehold[id] = members;
    });
  },

  // —————— Async thunks ——————

  fetchPantryItems: async () => {
    // you can toggle a loading flag here if you want
    const items = await getPantryItemsApi();
    set(state => {
      state.pantryById = {};
      state.pantryIds = [];
      items.forEach(it => {
        state.pantryById[it.id] = it;
        state.pantryIds.push(it.id);
      });
    });
  },

  deletePantryItem: async id => {
    // optimistic remove
    set(state => {
      delete state.pantryById[id];
      state.pantryIds = state.pantryIds.filter(x => x !== id);
    });
    try {
      await deletePantryItemApi(id);
    } catch {
      // on error, re-fetch or re-enqueue for offline
      await getPantryItemsApi().then(items => get().setPantryItems(items));
    }
  },

  editPantryItem: async (id, data) => {
    // optimistic update
    set(state => {
      state.pantryById[id] = {...state.pantryById[id], ...data};
    });
    try {
      const updated = await updatePantryItemApi(data as PantryItem);
      set(state => {
        state.pantryById[id] = updated;
      });
    } catch {
      // on error, re-fetch the one item or refetch all
      await getPantryItemsApi().then(items => get().setPantryItems(items));
    }
  },
});
