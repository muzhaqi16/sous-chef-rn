import {gql} from '@apollo/client';

export const ShoppingListUpdatedDocument = gql`
  subscription ShoppingListUpdated($listId: ID!) {
    shoppingListUpdated(listId: $listId) {
      id
      shoppingListId
      label
      quantity
      itemName
      unitSymbol
      isPurchased
      createdAt
      updatedAt
    }
  }
`;
