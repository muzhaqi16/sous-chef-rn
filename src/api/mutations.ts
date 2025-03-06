import {gql} from '@apollo/client';

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
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
      quantity
      price
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
  mutation CreateShoppingList($name: String!) {
    createShoppingList(name: $name) {
      id
      name
      createdAt
    }
  }
`;

export const ADD_ITEM_MUTATION = gql`
  mutation CreateShoppingListItem($data: CreateShoppingListItemInput!) {
    createShoppingListItem(data: $data) {
      item {
        id
        name
        description
        barcode
        type
        brand
        price
        aisle
        quantity
        shelfLife
        unit
        category
        imageUrl
        status
        createdBy
        createdAt
        updatedAt
      }
      id
      location
      notes
      purchased
      purchasedAt
      quantity
      weight
    }
  }
`;
