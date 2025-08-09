import {gql} from '@apollo/client';

export const CREATE_SHOPPING_LIST = gql`
  mutation CreateShoppingList($input: CreateShoppingListInput!) {
    createShoppingList(input: $input) {
      id
      name
      description
      isDefault
      tags
      metadata
      createdAt
      updatedAt
      ownerships {
        id
        userId
        shoppingListId
        createdAt
        transferredAt
        transferredFrom
      }
    }
  }
`;

export const ADD_COLLABORATOR_MUTATION = gql`
  mutation AddCollaborator($data: AddCollaboratorInput!) {
    addCollaborator(data: $data) {
      id
      shoppingListId
      email
      role
      status
      canEdit
      canAddItems
      canRemoveItems
      canEditItems
      canMarkPurchased
      canInviteOthers
      invitedAt
      statusChangedAt
    }
  }
`;
