import {StateCreator} from 'zustand';
import {RootState} from '../../index';

export interface Item {
  id: string;
  name: string;
  version: number;
  // ...other fields
}

export interface ItemsState {
  itemsById: Record<string, Item>;
  itemIds: string[];
  lastFetched: number | null;

  setItems: (items: Item[]) => void;
  upsertItem: (item: Item) => void;
  removeItem: (id: string) => void;
}

export const createItemsSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  ItemsState
> = set => ({
  itemsById: {},
  itemIds: [],
  lastFetched: null,

  setItems: items => {
    set(state => {
      state.itemsById = {};
      state.itemIds = [];
      items.forEach(item => {
        state.itemsById[item.id] = item;
        state.itemIds.push(item.id);
      });
      state.lastFetched = Date.now();
    });
  },

  upsertItem: item => {
    set(state => {
      if (!state.itemsById[item.id]) {
        state.itemIds.push(item.id);
      }
      state.itemsById[item.id] = item;
    });
  },

  removeItem: id => {
    set(state => {
      delete state.itemsById[id];
      state.itemIds = state.itemIds.filter(x => x !== id);
    });
  },
});
