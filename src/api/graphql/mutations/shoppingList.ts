import {gql} from '@apollo/client';

export const CREATE_SHOPPING_LIST = gql`
  mutation CreateShoppingList($data: CreateShoppingListInput!) {
    createShoppingList(data: $data) {
      id
      name
      isDefault
      tags
      createdAt
      updatedAt
      owner {
        email
        id
      }
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
      collaborator {
        email
        id
        role
      }
    }
  }
`;
