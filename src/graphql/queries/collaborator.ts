import {gql} from '@apollo/client';

export const GET_SHOPPING_LIST_COLLABORATORS = gql`
  query ShoppingListCollaborators($shoppingListId: ID!) {
    shoppingListCollaborators(shoppingListId: $shoppingListId) {
      id
      role
      status
      invitedAt
      statusChangedAt
      email
      collaborator {
        email
        role
        emailVerified
        id
      }
    }
  }
`;
