import {gql} from '@apollo/client';

export const SHOPPING_LIST_UPDATED_SUBSCRIPTION = gql`
  subscription ShoppingListUpdated($listId: ID!) {
    shoppingListUpdated(listId: $listId) {
      mutation
      node {
        id
        name
        totalItems
        completedItems
        estimatedTotal
        status
        isCompleted
        completedAt
        budgetAmount
        totalCost
        items {
          id
          itemName
          quantity
          isPurchased
          estimatedPrice
        }
      }
      updatedFields
      previousValues {
        name
        status
        isCompleted
        budgetAmount
        totalCost
        estimatedTotal
      }
      userId
      timestamp
    }
  }
`;

export const MY_SHOPPING_LISTS_UPDATED_SUBSCRIPTION = gql`
  subscription MyShoppingListsUpdated {
    myShoppingListsUpdated {
      mutation
      node {
        id
        name
        totalItems
        completedItems
        estimatedTotal
        status
        isCompleted
      }
      previousValues {
        name
        status
        isCompleted
      }
      updatedFields
      userId
      timestamp
    }
  }
`;

export const SHOPPING_LIST_ITEMS_CHANGED_SUBSCRIPTION = gql`
  subscription ShoppingListItemsChanged($listId: ID!) {
    shoppingListItemsChanged(listId: $listId) {
      mutation
      listId
      item {
        id
        itemName
        quantity
        estimatedPrice
        isPurchased
        purchasedQuantity
        purchasedPrice
        notes
        priority
        category
        addedBy {
          id
          email
          profile {
            displayName
          }
        }
      }
      previousValues {
        name
        quantity
        isCompleted
        price
        notes
      }
      updatedFields
      userId
      timestamp
    }
  }
`;

export const SHOPPING_LIST_COLLABORATORS_CHANGED_SUBSCRIPTION = gql`
  subscription ShoppingListCollaboratorsChanged($listId: ID!) {
    shoppingListCollaboratorsChanged(listId: $listId) {
      mutation
      listId
      collaborator {
        id
        collaboratorId
        email
        role
        status
        canEdit
        canAddItems
        canRemoveItems
        canMarkPurchased
        invitedAt
        collaborator {
          id
          email
          profile {
            displayName
            avatar
          }
        }
      }
      userId
      timestamp
    }
  }
`;

export const SHOPPING_LIST_STATUS_CHANGED_SUBSCRIPTION = gql`
  subscription ShoppingListStatusChanged($listId: ID!) {
    shoppingListStatusChanged(listId: $listId) {
      mutation
      listId
      newStatus
      previousStatus
      completedBy {
        id
        email
        profile {
          displayName
        }
      }
      userId
      timestamp
    }
  }
`;

export const SHOPPING_LIST_ITEM_ADDED_SUBSCRIPTION = gql`
  subscription ShoppingListItemAdded($shoppingListId: ID!) {
    shoppingListItemAdded(shoppingListId: $shoppingListId) {
      id
      itemName
      quantity
      estimatedPrice
      isPurchased
      priority
      category
      notes
      addedBy {
        id
        email
        profile {
          displayName
        }
      }
      item {
        id
        name
        imageUrl
        averagePrice
      }
      unit {
        id
        symbol
        name
      }
      createdAt
    }
  }
`;

export const SHOPPING_LIST_ITEM_UPDATED_SUBSCRIPTION = gql`
  subscription ShoppingListItemUpdated($shoppingListId: ID!) {
    shoppingListItemUpdated(shoppingListId: $shoppingListId) {
      id
      itemName
      quantity
      estimatedPrice
      isPurchased
      purchasedQuantity
      purchasedPrice
      notes
      priority
      category
      lastEditedBy {
        id
        email
        profile {
          displayName
        }
      }
      updatedAt
    }
  }
`;

export const SHOPPING_LIST_ITEM_REMOVED_SUBSCRIPTION = gql`
  subscription ShoppingListItemRemoved($shoppingListId: ID!) {
    shoppingListItemRemoved(shoppingListId: $shoppingListId) {
      id
      itemName
    }
  }
`;
