import {client} from '../../apollo/client';
import {GET_SHOPPING_LIST_ITEMS} from '../graphql/queries/shoppingListItems';
import {
  ADD_ITEM_TO_SHOPPING_LIST_MUTATION,
  REMOVE_ITEM,
} from '../graphql/mutations/shoppingListItem';

import {ShoppingListItem} from '../graphql/generated';

/**
 * Fetch items for a given shopping list ID.
 * @param shoppingListId
 * @returns Promise resolving to an array of Item
 * @throws on network/GraphQL error or missing data
 */
export async function fetchItemsApi(
  shoppingListId: string,
): Promise<ShoppingListItem[]> {
  const response = await client.query({
    query: GET_SHOPPING_LIST_ITEMS,
    variables: {shoppingListId},
    fetchPolicy: 'network-only', // ensure fresh data
  });
  if (!response || !response.data) {
    throw new Error('No data returned from server');
  }
  const items = response.data.shoppingListItems;
  if (!Array.isArray(items)) {
    throw new Error('Invalid data format for items');
  }
  return items;
}

export async function addItemApi(
  name: string,
  quantity: number,
  price: number,
  shoppingListId?: string,
): Promise<ShoppingListItem> {
  const variables: Record<string, any> = {name, quantity, price};
  if (shoppingListId) {
    variables.shoppingListId = shoppingListId;
  }
  const response = await client.mutate({
    mutation: ADD_ITEM_TO_SHOPPING_LIST_MUTATION,
    variables,
  });
  if (!response || !response.data) {
    throw new Error('No data returned from server when adding item');
  }
  const newItem = response.data.addItem;
  if (!newItem) {
    throw new Error('No item returned from addItem mutation');
  }
  return newItem;
}

export async function removeItemApi(id: string): Promise<void> {
  const response = await client.mutate({
    mutation: REMOVE_ITEM,
    variables: {id},
  });
  // Optionally inspect response.data.removeItem.id
  if (!response || !response.data) {
    throw new Error('No data returned from server when removing item');
  }
  // If desired, you could return the removed ID:
  // const removed = response.data.removeItem;
  // if (!removed) throw new Error('No removeItem data');
  // return removed.id;
  return;
}
