import {gql} from '@apollo/client';

export const UPDATE_USER = gql`
  mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
    updateUser(id: $id, input: $input) {
      id
      email
      emailVerified
      role
      onBoarded
      timezone
      preferredCurrency
      language
      defaultShoppingListId
      defaultHomeId
      createdAt
      updatedAt
      lastActiveAt
    }
  }
`;
