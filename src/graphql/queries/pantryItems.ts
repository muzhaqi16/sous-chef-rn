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
      version
      item {
        id
      }
      unit {
        symbol
        name
      }
    }
  }
`;

export const GET_ONBOARDING_PANTRY_ITEMS = gql`
  query OnBoardingPantryItems {
    onBoardingPantryItems {
      id
      imageUrl
      name
      units {
        id
      }
    }
  }
`;
