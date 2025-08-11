import {gql} from '@apollo/client';

export const PURCHASE_CREATED_SUBSCRIPTION = gql`
  subscription PurchaseCreated($userId: ID) {
    purchaseCreated(userId: $userId) {
      id
      userId
      itemId
      storeId
      quantity
      unitPrice
      totalPrice
      purchaseDate
      itemName
      storeName
      unitSymbol
      currencySymbol
      user {
        id
        email
      }
      item {
        id
        name
        imageUrl
      }
      store {
        id
        name
        address
      }
    }
  }
`;

export const PURCHASE_UPDATED_SUBSCRIPTION = gql`
  subscription PurchaseUpdated($userId: ID) {
    purchaseUpdated(userId: $userId) {
      id
      userId
      quantity
      unitPrice
      totalPrice
      purchaseDate
      updatedAt
    }
  }
`;

export const PURCHASE_DELETED_SUBSCRIPTION = gql`
  subscription PurchaseDeleted($userId: ID) {
    purchaseDeleted(userId: $userId) {
      id
      userId
      deletedAt
    }
  }
`;
