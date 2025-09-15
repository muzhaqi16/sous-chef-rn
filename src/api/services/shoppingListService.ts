// src/services/shoppingListService.ts
import {client} from '../../apollo/client';
import {GET_SHOPPING_LISTS} from '../graphql/queries/shoppingList';
import {
  CREATE_SHOPPING_LIST,
  ADD_COLLABORATOR_MUTATION,
} from '../graphql/mutations/shoppingList';
import {CollaboratorRole, ShoppingList} from '../graphql/generated';

export async function fetchShoppingListsApi(): Promise<ShoppingList[]> {
  const {data} = await client.query<{shoppingLists: ShoppingList[]}>({
    query: GET_SHOPPING_LISTS,
    fetchPolicy: 'network-only', // adjust as needed
  });
  return data.shoppingLists;
}

export async function createShoppingListApi(
  name: string,
): Promise<ShoppingList> {
  const {data} = await client.mutate<{createShoppingList: ShoppingList}>({
    mutation: CREATE_SHOPPING_LIST,
    variables: {name},
  });
  return data!.createShoppingList;
}

export async function shareShoppingListApi(
  shoppingListId: string,
  email: string,
  role: CollaboratorRole = CollaboratorRole.Editor,
): Promise<void> {
  await client.mutate({
    mutation: ADD_COLLABORATOR_MUTATION,
    variables: {
      data: {shoppingListId, email, role},
    },
  });
}
