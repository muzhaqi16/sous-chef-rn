import {gql} from '@apollo/client';

export const PantryItemUpdatedDocument = gql`
  subscription PantryItemUpdated($pantryId: ID!) {
    pantryItemUpdated(pantryId: $pantryId) {
      id
      pantry {
        id
      }
      item {
        id
      }
      itemName
      unit {
        id
      }
      unitName
      quantity
      addedAt
      lastUsedAt
      expiresAt
      storageState
      addedBy {
        id
      }
      deletedAt
      version
      tags
    }
  }
`;
