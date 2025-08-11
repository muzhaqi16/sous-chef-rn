import {gql} from '@apollo/client';

export const PANTRY_UPDATED_SUBSCRIPTION = gql`
  subscription PantryUpdated($id: ID!) {
    pantryUpdated(id: $id) {
      id
      homeId
      name
      description
      location
      temperature
      tags
      metadata
      version
      updatedAt
      home {
        id
        name
      }
    }
  }
`;

export const MY_PANTRIES_UPDATED_SUBSCRIPTION = gql`
  subscription MyPantriesUpdated($homeId: ID!) {
    myPantriesUpdated(homeId: $homeId) {
      id
      name
      description
      isDefault
      location
      items {
        id
        currentQuantity
      }
    }
  }
`;

export const PANTRY_ACTIVITY_ADDED_SUBSCRIPTION = gql`
  subscription PantryActivityAdded($pantryId: ID!) {
    pantryActivityAdded(pantryId: $pantryId) {
      id
      pantryId
      userId
      action
      description
      itemName
      quantity
      oldValue
      newValue
      metadata
      createdAt
      user {
        id
        email
        profile {
          displayName
        }
      }
    }
  }
`;

export const PANTRY_LOW_STOCK_ALERT_SUBSCRIPTION = gql`
  subscription PantryLowStockAlert($pantryId: ID!) {
    pantryLowStockAlert(pantryId: $pantryId) {
      id
      itemId
      itemName
      currentQuantity
      autoReorderPoint
      unitName
      item {
        id
        name
        imageUrl
        averagePrice
      }
    }
  }
`;

export const PANTRY_EXPIRING_ITEMS_ALERT_SUBSCRIPTION = gql`
  subscription PantryExpiringItemsAlert($pantryId: ID!) {
    pantryExpiringItemsAlert(pantryId: $pantryId) {
      id
      itemId
      itemName
      expiresAt
      bestByDate
      currentQuantity
      unitName
      item {
        id
        name
        imageUrl
      }
    }
  }
`;
