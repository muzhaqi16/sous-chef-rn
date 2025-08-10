import {gql} from '@apollo/client';

export const ADD_ITEM_TO_SHOPPING_LIST = gql`
  mutation AddItemToShoppingList($input: CreateShoppingListItemInput!) {
    addItemToShoppingList(input: $input) {
      id
      quantity
      estimatedPrice
      itemName
      unitName
      notes
      priority
      category
      isPurchased
      item {
        id
        name
        description
        imageUrl
      }
      unit {
        id
        name
        symbol
      }
      shoppingList {
        id
        totalItems
        completedItems
        estimatedTotal
      }
    }
  }
`;

export const UPDATE_SHOPPING_LIST_ITEM = gql`
  mutation UpdateShoppingListItem(
    $id: ID!
    $input: UpdateShoppingListItemInput!
  ) {
    updateShoppingListItem(id: $id, input: $input) {
      id
      quantity
      estimatedPrice
      budgetPrice
      isPurchased
      purchasedQuantity
      purchasedPrice
      itemName
      unitName
      notes
      priority
      category
      item {
        id
        name
      }
      unit {
        id
        name
        symbol
      }
    }
  }
`;

export const REMOVE_ITEM_FROM_SHOPPING_LIST = gql`
  mutation RemoveItemFromShoppingList($id: ID!) {
    removeItemFromShoppingList(id: $id)
  }
`;

export const TOGGLE_SHOPPING_LIST_ITEM_COMPLETION = gql`
  mutation ToggleShoppingListItemCompletion($id: ID!) {
    toggleShoppingListItemCompletion(id: $id)
  }
`;

export const MARK_ITEM_PURCHASED = gql`
  mutation MarkItemPurchased($id: ID!) {
    markItemPurchased(id: $id)
  }
`;
