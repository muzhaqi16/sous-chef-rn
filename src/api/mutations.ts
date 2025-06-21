import {gql} from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      accessToken
      refreshToken
      user {
        email
        id
        role
      }
    }
  }
`;

export const SIGNUP_MUTATION = gql`
  mutation Signup($username: String!, $email: String!, $password: String!) {
    signup(username: $username, email: $email, password: $password) {
      user {
        id
        email
        name
      }
      accessToken
      refreshToken
    }
  }
`;

export const ADD_ITEM = gql`
  mutation AddItem($name: String!, $quantity: Int!) {
    addItem(name: $name, quantity: $quantity) {
      id
      name
    }
  }
`;

export const REMOVE_ITEM = gql`
  mutation RemoveItem($id: ID!) {
    removeItem(id: $id) {
      id
    }
  }
`;

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
// Add an item to shopping list
export const ADD_ITEM_MUTATION = gql`
  mutation AddItemToShoppingList($data: ShoppingListItemInput!) {
    addItemToShoppingList(data: $data) {
      id
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

export const UPDATE_USER_PROFILE_MUTATION = gql`
  mutation UpdateUserProfile($data: UpdateUserSettingsInput!) {
    updateUserProfile(data: $data) {
      id
      firstName
      lastName
      avatarUrl
      phone
      dateOfBirth
    }
  }
`;
