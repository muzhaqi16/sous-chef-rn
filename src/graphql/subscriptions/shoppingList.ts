import {gql} from '@apollo/client';

export const ShoppingListUpdatedDocument = gql`
  subscription ShoppingListUpdated($listId: ID!) {
    shoppingListUpdated(listId: $listId) {
      id
      shoppingList {
        id
      }
      item {
        id
        name
        imageUrl
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
