import {gql} from '@apollo/client';

export const CREATE_PANTRY = gql`
  mutation CreatePantry($input: CreatePantryInput!) {
    createPantry(input: $input) {
      id
      homeId
      name
      description
      isDefault
      location
      temperature
      tags
      createdAt
      updatedAt
    }
  }
`;

export const ADD_ITEM_TO_PANTRY = gql`
  mutation AddItemToPantry($input: AddPantryItemInput!) {
    addItemToPantry(input: $input) {
      id
      pantryId
      itemId
      unitId
      initialQuantity
      currentQuantity
      itemName
      itemBarcode
      unitName
      expiresAt
      bestByDate
      storageState
      storageLocation
      condition
      acquisitionMethod
      createdAt
    }
  }
`;
