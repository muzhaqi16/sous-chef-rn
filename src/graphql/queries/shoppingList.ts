import {gql} from '@apollo/client';

export const GET_SHOPPING_LISTS = gql`
  query ShoppingLists {
    shoppingLists {
      id
      name
      owner {
        id
        email
        emailVerified
        onBoarded
        role
      }
      isDefault
      tags
      createdAt
      updatedAt
      version
    }
  }
`;
