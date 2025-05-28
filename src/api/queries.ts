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
      shoppingListItems {
        itemName
        item {
          name
          price
        }
      }
      collaborators {
        userId
      }
      metadata
      tags
      createdAt
      updatedAt
    }
  }
`;

export const GET_SHOPPING_LIST_ITEMS = gql`
  query ShoppingListItems($shoppingListId: ID!) {
    shoppingListItems(shoppingListId: $shoppingListId) {
      id
      item {
        name
        imageUrl
      }
      label
      quantity
      unit {
        name
        symbol
      }
      itemName
      unitSymbol
      isPurchased
      createdAt
      updatedAt
      deletedAt
      version
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
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_ITEMS_FOR_AUTOCOMPLETE = gql`
  query ItemsAutocomplete($name: String!) {
    itemsAutocomplete(name: $name) {
      id
      name
    }
  }
`;
