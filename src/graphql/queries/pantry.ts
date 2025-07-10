import {gql} from '@apollo/client';

export const GET_PANTRY_ITEMS = gql`
  query PantryItems($pantryId: ID!) {
    pantryItems(pantryId: $pantryId) {
      id
      pantryId
      itemId
      unitId
      quantity
      grams
      addedAt
      lastUsedAt
      expiresAt
      storageState
      deletedAt
      version
      item {
        name
      }
      unit {
        symbol
        name
      }
    }
  }
`;

export const GET_PANTRIES = gql`
  query Pantries($homeId: ID!) {
    pantries(homeId: $homeId) {
      id
      homeId
      name
      version
      createdAt
      updatedAt
      deletedAt
      items {
        itemId
        unit {
          symbol
          name
        }
        item {
          name
          status
          storageState
        }
        storageState
        expiresAt
        id
        grams
      }
    }
  }
`;

export const GET_ONBOARDING_PANTRY_ITEMS = gql`
  query OnBoardingPantryItems {
    onBoardingPantryItems {
      id
      name
      imageUrl
    }
  }
`;
