import {gql} from '@apollo/client';

export const CREATE_SHOPPING_LIST = gql`
  mutation CreateShoppingList($data: CreateShoppingListInput!) {
    createShoppingList(data: $data) {
      id
      name
      tags
      version
      updatedAt
      isDefault
      owner {
        id
      }
      createdAt
      deletedAt
      metadata
    }
  }
`;

export const ADD_COLLABORATOR_MUTATION = gql`
  mutation AddCollaborator($data: AddCollaboratorInput!) {
    addCollaborator(data: $data) {
      id
      role
      status
      invitedAt
      statusChangedAt
      email
    }
  }
`;
