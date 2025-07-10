import {gql} from '@apollo/client';

export const ADD_ITEM_TO_PANTRY = gql`
  mutation AddItemToPantry($input: CreatePantryItemInput!) {
    addItemToPantry(input: $input) {
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
        imageUrl
      }
      unit {
        name
        id
        symbol
      }
    }
  }
`;
