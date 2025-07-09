import {gql} from '@apollo/client';

export const GET_USER_PANTRY_ITEMS = gql`
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
        id
        imageUrl
        name
      }
      unit {
        id
        name
        symbol
        conversionFactor
        notes
        type
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
