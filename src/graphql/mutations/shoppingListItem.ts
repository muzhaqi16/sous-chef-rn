import {gql} from '@apollo/client';

// Add an item to shopping list
export const ADD_ITEM_TO_SHOPPING_LIST = gql`
  mutation AddItemToShoppingList($input: CreateShoppingListItemInput!) {
    addItemToShoppingList(input: $input) {
      id
      addedBy {
        id
      }
      isPurchased
      itemName
    }
  }
`;

export const REMOVE_ITEM = gql`
  mutation RemoveItemFromShoppingList($removeItemFromShoppingListId: ID!) {
    removeItemFromShoppingList(id: $removeItemFromShoppingListId)
  }
`;

// Update an item in shopping list
export const UPDATE_ITEM_IN_SHOPPING_LIST = gql`
  mutation UpdateShoppingListItem(
    $updateShoppingListItemId: ID!
    $data: UpdateShoppingListItemInput!
    $input: UpdateShoppingListItemInput!
  ) {
    updateShoppingListItem(
      id: $updateShoppingListItemId
      data: $data
      input: $input
    ) {
      id
      quantity
      item {
        id
        name
      }
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
