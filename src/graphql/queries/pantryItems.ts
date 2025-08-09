import {gql} from '@apollo/client';

export const GET_PANTRY_ITEMS = gql`
  query PantryItems($pantryId: ID!) {
    pantryItems(pantryId: $pantryId) {
      unitName
      unitId
      pantryId
      itemName
      itemId
      itemBarcode
      item {
        imageUrl
      }
    }
  }
`;

export const GET_ONBOARDING_ITEMS = gql`
  query OnboardingItems {
    onboardingItems {
      id
      name
      description
      imageUrl
      type
      storageState
      popularity
      status
      units {
        id
        isDefault
        unit {
          id
          name
          symbol
        }
      }
    }
  }
`;
