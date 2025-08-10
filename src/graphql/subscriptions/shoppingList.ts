import {gql} from '@apollo/client';

export const SHOPPING_LIST_UPDATED_SUBSCRIPTION = gql`
  subscription ShoppingListUpdated($listId: ID!) {
    shoppingListUpdated(listId: $listId) {
      mutation
      node {
        id
        name
        totalItems
        completedItems
        estimatedTotal
        items {
          id
          itemName
          quantity
          isPurchased
        }
      }
    }
  }
`;

export const SHOPPING_LIST_ITEM_ADDED_SUBSCRIPTION = gql`
  subscription ShoppingListItemAdded($shoppingListId: ID!) {
    shoppingListItemAdded(shoppingListId: $shoppingListId) {
      id
      itemName
      quantity
      isPurchased
      addedBy {
        id
        email
      }
    }
  }
`;

export const SHOPPING_LIST_ITEM_UPDATED_SUBSCRIPTION = gql`
  subscription ShoppingListItemUpdated($shoppingListId: ID!) {
    shoppingListItemUpdated(shoppingListId: $shoppingListId) {
      id
      itemName
      quantity
      isPurchased
      notes
      priority
    }
  }
`;

export const SHOPPING_LIST_ITEM_REMOVED_SUBSCRIPTION = gql`
  subscription ShoppingListItemRemoved($shoppingListId: ID!) {
    shoppingListItemRemoved(shoppingListId: $shoppingListId) {
      id
    }
  }
`;
