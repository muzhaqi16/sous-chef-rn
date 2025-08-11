import {gql} from '@apollo/client';

export const PANTRY_ITEMS_CHANGED_SUBSCRIPTION = gql`
  subscription PantryItemsChanged($pantryId: ID!) {
    pantryItemsChanged(pantryId: $pantryId) {
      pantryId
      item {
        id
        unit {
          name
        }
        itemName
      }
      updatedFields
      mutation
      timestamp
      userId
    }
  }
`;
