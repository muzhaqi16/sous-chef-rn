import {gql} from '@apollo/client';

export const GET_SHOPPING_LIST = gql`
  query ShoppingList($id: ID!) {
    shoppingList(id: $id) {
      id
      name
      description
      isDefault
      isPublic
      shareCode
      tags
      budgetAmount
      totalCost
      estimatedTotal
      currency
      category
      priority
      status
      isCompleted
      completedAt
      totalItems
      completedItems
      createdAt
      updatedAt
      items {
        id
        quantity
        estimatedPrice
        budgetPrice
        isPurchased
        purchasedQuantity
        purchasedPrice
        purchaseDate
        itemName
        itemBarcode
        unitName
        notes
        priority
        category
        sortOrder
        isAutoAdded
        autoAddReason
        isFromMealPlan
        item {
          id
          name
          description
          barcode
          imageUrl
          type
          storageState
          averagePrice
        }
        unit {
          id
          name
          symbol
        }
        preferredStore {
          id
          name
          address
        }
        purchasedBy {
          id
          email
        }
        addedBy {
          id
          email
        }
        createdAt
        updatedAt
      }
      collaborators {
        id
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
        lastViewedAt
      }
      targetStore {
        id
        name
        address
      }
    }
  }
`;

export const GET_SHOPPING_LISTS = gql`
  query ShoppingLists {
    shoppingLists {
      id
      name
      description
      isDefault
      isPublic
      tags
      totalItems
      completedItems
      estimatedTotal
      currency
      status
      isCompleted
      priority
      createdAt
      updatedAt
      items {
        id
        isPurchased
      }
      collaborators {
        id
        email
        role
      }
    }
  }
`;

export const GET_DEFAULT_SHOPPING_LIST = gql`
  query DefaultShoppingList {
    defaultShoppingList {
      id
      name
      description
      isDefault
      totalItems
      completedItems
      items {
        id
        itemName
        quantity
        isPurchased
        item {
          id
          name
          imageUrl
        }
      }
    }
  }
`;
