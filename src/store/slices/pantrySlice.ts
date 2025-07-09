import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {zustandStorage} from '../../storage/mmkv';

import {PantryItem} from '../../api/graphql/generated';

export interface PantryState {
  pantryById: Record<string, PantryItem>;
  pantryIds: string[];
  addPantryItem: (item: PantryItem) => void;
  updatePantryItem: (id: string, item: PantryItem) => void;
  removePantryItem: (id: string) => void;
  clearPantry: () => void;
}

export const initialPantryState: PantryState = {
  pantryById: {},
  pantryIds: [],
  addPantryItem: () => {},
  updatePantryItem: () => {},
  removePantryItem: () => {},
  clearPantry: () => {},
};

export const createPantrySlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  PantryState
> = set => ({
  pantryById: {},
  pantryIds: [],

  addPantryItem: item =>
    set(state => {
      state.pantryById[item.id] = item;
      if (!state.pantryIds.includes(item.id)) {
        state.pantryIds.push(item.id);
      }
      zustandStorage.setItem(
        'pantry',
        JSON.stringify({
          pantryById: state.pantryById,
          pantryIds: state.pantryIds,
        }),
      );
    }),

  updatePantryItem: (id, item) =>
    set(state => {
      if (state.pantryById[item.id]) {
        state.pantryById[item.id] = {
          ...state.pantryById[item.id],
          ...item,
        };
        zustandStorage.setItem(
          'pantry',
          JSON.stringify({
            pantryById: state.pantryById,
            pantryIds: state.pantryIds,
          }),
        );
      }
    }),

  removePantryItem: id =>
    set(state => {
      delete state.pantryById[id];
      state.pantryIds = state.pantryIds.filter(x => x !== id);
      zustandStorage.setItem(
        'pantry',
        JSON.stringify({
          pantryById: state.pantryById,
          pantryIds: state.pantryIds,
        }),
      );
    }),

  clearPantry: () =>
    set(state => {
      state.pantryById = {};
      state.pantryIds = [];
      zustandStorage.setItem(
        'pantry',
        JSON.stringify({pantryById: {}, pantryIds: []}),
      );
    }),
});
