import {gql} from '@apollo/client';

export const ADD_ITEM_TO_PANTRY = gql`
  mutation AddItemToPantry($input: CreatePantryItemInput!) {
    addItemToPantry(input: $input) {
      id
      pantry {
        id
      }
      item {
        id
      }
      unit {
        id
      }
      quantity
      addedAt
      lastUsedAt
      expiresAt
      storageState
      version
    }
  }
`;
