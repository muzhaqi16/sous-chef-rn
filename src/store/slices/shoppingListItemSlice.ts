import {StateCreator} from 'zustand';
import {v4 as uuidv4} from 'uuid';
import {
  fetchItemsApi,
  addItemApi,
  removeItemApi,
} from '../../api/services/shoppingListItemService';
import type {ShoppingListItem} from '../../api/graphql/generated';
import type {RootState} from '../index';

export interface ShoppingListItemState {
  itemsByList: Record<
    string,
    {byId: Record<string, ShoppingListItem>; allIds: string[]}
  >;
  setItemsForList: (listId: string, items: ShoppingListItem[]) => void;
  upsertItemInList: (item: ShoppingListItem) => void;
  removeItemFromList: (listId: string, id: string) => void;
  fetchItemsForList: (listId: string) => Promise<void>;

  // new async actions
  addItem: (
    listId: string,
    name: string,
    quantity: number,
    price: number,
  ) => Promise<void>;
  deleteItem: (listId: string, id: string) => Promise<void>;
}

export const createShoppingListItemSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  ShoppingListItemState
> = (set, get) => ({
  itemsByList: {},

  setItemsForList: (listId, items) =>
    set(state => {
      state.itemsByList[listId] = {byId: {}, allIds: []};
      items.forEach(it => {
        state.itemsByList[listId].byId[it.id] = it;
        state.itemsByList[listId].allIds.push(it.id);
      });
    }),

  upsertItemInList: item =>
    set(state => {
      const bucket = state.itemsByList[item.shoppingListId] || {
        byId: {},
        allIds: [],
      };
      if (!state.itemsByList[item.shoppingListId]) {
        state.itemsByList[item.shoppingListId] = bucket;
      }
      if (!bucket.byId[item.id]) {
        bucket.allIds.push(item.id);
      }
      bucket.byId[item.id] = item;
    }),

  removeItemFromList: (listId, id) =>
    set(state => {
      const bucket = state.itemsByList[listId];
      if (!bucket) return;
      delete bucket.byId[id];
      bucket.allIds = bucket.allIds.filter(x => x !== id);
    }),

  fetchItemsForList: async listId => {
    const items = await fetchItemsApi(listId);
    set(state => {
      state.itemsByList[listId] = {byId: {}, allIds: []};
      items.forEach(it => {
        state.itemsByList[listId].byId[it.id] = it;
        state.itemsByList[listId].allIds.push(it.id);
      });
    });
  },

  addItem: async (listId, name, quantity, price) => {
    // 1) optimistic insert
    const tempId = uuidv4();
    const now = new Date().toISOString();
    const optimistic: ShoppingListItem = {
      id: tempId,
      shoppingListId: listId,
      label: name,
      quantity,
      itemName: name,
      unitSymbol: null,
      isPurchased: false,
      createdAt: now,
      updatedAt: now,
    };
    get().upsertItemInList(optimistic);

    try {
      // 2) call your addItemApi
      const saved = await addItemApi(name, quantity, price, listId);

      // 3) replace temp with real
      set(state => {
        const bucket = state.itemsByList[listId];
        if (!bucket) return;
        // remove temp
        delete bucket.byId[tempId];
        bucket.allIds = bucket.allIds.filter(id => id !== tempId);
        // insert real
        bucket.byId[saved.id] = saved;
        bucket.allIds.push(saved.id);
      });
    } catch (err) {
      // 4) rollback
      get().removeItemFromList(listId, tempId);
      throw err;
    }
  },

  deleteItem: async (listId, id) => {
    // 1) optimistic remove
    get().removeItemFromList(listId, id);

    try {
      await removeItemApi(id);
    } catch (err) {
      // 2) rollback by refetching
      await get().fetchItemsForList(listId);
      throw err;
    }
  },
});
