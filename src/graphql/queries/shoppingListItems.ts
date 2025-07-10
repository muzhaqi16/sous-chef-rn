import {gql} from '@apollo/client';

export const GET_SHOPPING_LIST_ITEMS = gql`
  query ShoppingListItems($shoppingListId: ID!) {
    shoppingListItems(shoppingListId: $shoppingListId) {
      id
      label
      quantity
      itemName
      unitSymbol
      isPurchased
      createdAt
      updatedAt
      item {
        imageUrl
      }
    }
  }
`;
