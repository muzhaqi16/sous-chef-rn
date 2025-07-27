import {gql} from '@apollo/client';

// Add an item to shopping list
export const ADD_ITEM_TO_SHOPPING_LIST_MUTATION = gql`
  mutation AddItemToShoppingList($data: ShoppingListItemInput!) {
    addItemToShoppingList(data: $data) {
      id
      itemName
      unitName
      quantity
    }
  }
`;

export const REMOVE_ITEM = gql`
  mutation RemoveItemFromShoppingList($removeItemFromShoppingListId: ID!) {
    removeItemFromShoppingList(id: $removeItemFromShoppingListId)
  }
`;

// Update an item in shopping list
export const UPDATE_ITEM_IN_SHOPPING_LIST_MUTATION = gql`
  mutation UpdateShoppingListItem($id: ID!, $data: ShoppingListItemInput!) {
    updateShoppingListItem(id: $id, data: $data) {
      id
      quantity
      itemName
      unitName
      isPurchased
      createdAt
      updatedAt
      deletedAt
      version
    }
  }
`;
