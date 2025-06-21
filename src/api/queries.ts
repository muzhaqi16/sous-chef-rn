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

export const GET_USER_PROFILE = gql`
  query UserProfile {
    userProfile {
      id
      userId
      firstName
      lastName
      avatarUrl
      phone
      dateOfBirth
      createdAt
      updatedAt
    }
  }
`;
export const GET_SHOPPING_LIST_ITEMS = gql`
  query ShoppingListItems($shoppingListId: ID!) {
    shoppingListItems(shoppingListId: $shoppingListId) {
      id
      label
      quantity
      itemName
      unitSymbol
      isPurchased
      createdAt
      updatedAt
      item {
        imageUrl
      }
    }
  }
`;

export const GET_ITEMS = gql`
  query GetItems($status: ItemStatus) {
    items(status: $status) {
      id
      name
      description
      barcode
      type
      quantity
      unit
      category
      imageUrl
      createdAt
      updatedAt
    }
  }
`;

export const GET_ITEMS_FOR_AUTOCOMPLETE = gql`
  query AutocompleteItems($name: String!) {
    autocompleteItems(name: $name) {
      id
      name
    }
  }
`;
