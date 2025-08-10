import {gql} from '@apollo/client';

export const GET_PANTRY_ITEMS = gql`
  query PantryItems($pantryId: ID!) {
    pantryItems(pantryId: $pantryId) {
      id
      unitName
      unitId
      pantryId
      itemName
      itemId
      itemBarcode
      item {
        id
        name
        description
        imageUrl
      }
      expiresAt
      storageLocation
      storageState
      initialQuantity
      unit {
        id
        name
        symbol
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
        itemId
        unitId
        unit {
          id
          name
          symbol
          type
          isMetric
          baseUnitId
          conversionFactor
          isCommon
        }
      }
    }
  }
`;
