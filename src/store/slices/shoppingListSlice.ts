import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {fetchShoppingListsApi} from '../../api/services/shoppingListService';
import {ShoppingList} from '../../api/graphql/generated';

export interface ShoppingListState {
  listById: Record<string, ShoppingList>;
  listIds: string[];
  collaborators: Record<string, string[]>;
  defaultListId?: string;
  selectedListId?: string | null; // null means no list selected

  setLists: (lists: ShoppingList[]) => void;
  upsertList: (list: ShoppingList) => void;
  removeList: (id: string) => void;
  setCollaborators: (listId: string, users: string[]) => void;
  setDefaultShoppingList: (list: ShoppingList) => void;
  fetchLists: () => Promise<void>;
  getDefaultShoppingList: () => ShoppingList | null;
  selectList: (id: string | null) => void;
}

export const createShoppingListSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  ShoppingListState
> = (set, get) => ({
  listById: {},
  listIds: [],
  collaborators: {},
  defaultListId: undefined,
  selectedListId: null,

  setLists: lists => {
    set(state => {
      const listById: Record<string, ShoppingList> = {};
      const listIds: string[] = [];
      lists.forEach(ls => {
        listById[ls.id] = ls;
        listIds.push(ls.id);
      });
      return {
        ...state,
        listById,
        listIds,
      };
    });
  },

  upsertList: list => {
    set(state => {
      const exists = !!state.listById[list.id];
      return {
        ...state,
        listById: {
          ...state.listById,
          [list.id]: list,
        },
        listIds: exists ? state.listIds : [...state.listIds, list.id],
      };
    });
  },

  removeList: id => {
    set(state => {
      const {[id]: _, ...newListById} = state.listById;
      const {[id]: __, ...newCollaborators} = state.collaborators;
      return {
        ...state,
        listById: newListById,
        listIds: state.listIds.filter(x => x !== id),
        collaborators: newCollaborators,
      };
    });
  },

  setCollaborators: (listId, users) => {
    set(state => ({
      ...state,
      collaborators: {
        ...state.collaborators,
        [listId]: users,
      },
    }));
  },
  setDefaultShoppingList: list =>
    set(state => {
      // 1) clear previous default
      state.listIds.forEach(id => {
        state.listById[id].isDefault = false;
      });
      // 2) set this one
      if (!state.listById[list.id]) {
        // if not in store yet, add it
        state.listIds.push(list.id);
      }
      state.listById[list.id] = {...list, isDefault: true};
    }),
  fetchLists: async () => {
    const lists = await fetchShoppingListsApi();
    // check if the default list is in the fetched lists
    const defaultList = lists.find(list => list.isDefault);
    if (defaultList) {
      set(state => ({
        ...state,
        defaultListId: defaultList.id,
        selectedListId: defaultList.id, // auto-select default list
      }));
    } else {
      set(state => ({
        ...state,
        defaultListId: undefined,
        selectedListId: null, // no default list found
      }));
    }
    get().setLists(lists);
  },
  getDefaultShoppingList: () => {
    const id = get().defaultListId;
    return id ? get().listById[id] : null;
  },
  selectList: id => {
    set(state => ({
      ...state,
      selectedListId: id,
    }));
  },
});
