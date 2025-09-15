import {gql} from '@apollo/client';

export const GET_USER_PANTRY_ITEMS = gql`
  query PantryItems {
    pantryItems {
      id
      itemId
      quantity
      unitId
      itemName
      unitSymbol
      addedDate
      lastUsedAt
      expirationDate
      storageState
      deletedAt
      version
      item {
        imageUrl
        id
        name
        storageState
      }
      unit {
        id
        symbol
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
