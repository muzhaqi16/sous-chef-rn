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

export const UPDATE_SHOPPING_LIST = gql`
  mutation UpdateShoppingList($id: ID!, $input: UpdateShoppingListInput!) {
    updateShoppingList(id: $id, input: $input) {
      id
      name
      description
      tags
      budgetAmount
      currency
      category
      priority
      status
      isCompleted
      isDefault
      updatedAt
    }
  }
`;

export const DELETE_SHOPPING_LIST = gql`
  mutation DeleteShoppingList($id: ID!) {
    deleteShoppingList(id: $id)
  }
`;

export const SET_DEFAULT_SHOPPING_LIST = gql`
  mutation SetDefaultShoppingList($id: ID!) {
    setDefaultShoppingList(id: $id) {
      id
      name
      isDefault
    }
  }
`;

export const SHARE_SHOPPING_LIST = gql`
  mutation ShareShoppingList($id: ID!, $input: ShareShoppingListInput!) {
    shareShoppingList(id: $id, input: $input) {
      id
      isPublic
      shareCode
    }
  }
`;
