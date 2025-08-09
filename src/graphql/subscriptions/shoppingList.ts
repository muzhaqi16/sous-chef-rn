import {gql} from '@apollo/client';

export const ShoppingListUpdatedDocument = gql`
  subscription ShoppingListUpdated($listId: ID!) {
    shoppingListUpdated(listId: $listId) {
      mutation
      node {
        id
        name
      }
      previousValues {
        name
        status
        totalCost
        isCompleted
        estimatedTotal
        description
        budgetAmount
      }
      updatedFields
      userId
      timestamp
    }
  }
`;
