import {gql} from '@apollo/client';

export const GET_SHOPPING_LIST_ITEMS = gql`
  query ShoppingListItems($shoppingListId: ID!) {
    shoppingListItems(shoppingListId: $shoppingListId) {
      id
      quantity
      itemName
      unitName
      isPurchased
      createdAt
      updatedAt
      item {
        id
        name
        imageUrl
      }
    }
  }
`;
