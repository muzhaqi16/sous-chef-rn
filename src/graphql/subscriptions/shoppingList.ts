import {gql} from '@apollo/client';

export const ShoppingListUpdatedDocument = gql`
  subscription ShoppingListUpdated($listId: ID!) {
    shoppingListUpdated(listId: $listId) {
      id
      shoppingList {
        id
      }
      quantity
      itemName
      unitName
      isPurchased
      createdAt
      updatedAt
    }
  }
`;
