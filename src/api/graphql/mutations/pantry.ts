import {gql} from '@apollo/client';

export const ADD_ITEM_TO_PANTRY = gql`
  mutation AddItemToPantry($input: AddItemToPantryInput!) {
    addItemToPantry(input: $input) {
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
    }
  }
`;
