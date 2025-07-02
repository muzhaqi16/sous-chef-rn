import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {fetchItemsApi} from '../../api/services/shoppingListItemService';
import {ShoppingListItem} from '../../api/graphql/generated';

export interface ShoppingListItemState {
  itemsByList: Record<
    string,
    {byId: Record<string, ShoppingListItem>; allIds: string[]}
  >;
  setItemsForList: (listId: string, items: ShoppingListItem[]) => void;
  upsertItemInList: (item: ShoppingListItem) => void;
  removeItemFromList: (listId: string, id: string) => void;
  fetchItemsForList: (listId: string) => Promise<void>;
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
      const bucket = (state.itemsByList[item.id] ||= {
        byId: {},
        allIds: [],
      });
      if (!bucket.byId[item.id]) bucket.allIds.push(item.id);
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
    // transform GraphQL items into your slice shape if needed
    console.log('fetchItemsForList', {listId, items});

    set(state => {
      state.itemsByList[listId] = {byId: {}, allIds: []};
      items.forEach(it => {
        state.itemsByList[listId].byId[it.id] = it;
        state.itemsByList[listId].allIds.push(it.id);
      });
    });
  },
});
