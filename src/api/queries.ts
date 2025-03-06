import {gql} from '@apollo/client';

export const GET_SHOPPING_LISTS = gql`
  query ShoppingLists {
    shoppingLists {
      id
      name
      createdBy
      createdAt
      updatedAt
      sharedWith {
        id
        user {
          id
          name
          email
        }
      }
    }
  }
`;

export const GET_SHOPPING_LIST_ITEMS = gql`
  query ShoppingListItems($id: ID!) {
    shoppingList(id: $id) {
      shoppingListItems {
        id
        item {
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
          createdBy
          createdAt
          updatedAt
        }
        notes
        quantity
        weight
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
