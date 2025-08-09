import {gql} from '@apollo/client';

export const PantryItemUpdatedDocument = gql`
  subscription PantryItemUpdated($pantryId: ID!) {
    pantryItemUpdated(pantryId: $pantryId) {
      id
      unit {
        name
      }
      unitName
      itemName
    }
  }
`;
