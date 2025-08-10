import {gql} from '@apollo/client';

export const PantryItemChangedSubscription = gql`
  subscription PantryItemsChanged($pantryId: ID!, $itemId: String!) {
    pantryItemsChanged(pantryId: $pantryId, itemId: $itemId) {
      pantryId
      itemId
      item {
        itemId
        itemName
      }
    }
  }
`;
