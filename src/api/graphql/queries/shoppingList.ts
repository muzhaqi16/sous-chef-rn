import {gql} from '@apollo/client';

export const GET_SHOPPING_LISTS = gql`
  query ShoppingLists {
    shoppingLists {
      id
      name
      owner {
        email
        id
      }
      isDefault
      tags
      createdAt
      updatedAt
    }
  }
`;
