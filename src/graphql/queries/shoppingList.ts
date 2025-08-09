import {gql} from '@apollo/client';

export const GET_SHOPPING_LISTS = gql`
  query ShoppingLists {
    shoppingLists {
      id
      name
      isDefault
      metadata
      tags
      items {
        id
        shoppingList {
          id
        }
        item {
          id
          name
          description
          barcode
          dataSource
          type
          storageState
          shelfLifeDays
          showInOnboarding
          status
          visibility
          imageUrl
          healthBenefits
          allergens
          nutritions
          metadata
          tags
          createdAt
          updatedAt
          version
        }
        unit {
          id
        }
        quantity
        itemName
        unitName
        isPurchased
        createdAt
        updatedAt
        deletedAt
        version
      }
      collaborators {
        id
      }
      createdAt
      updatedAt
      deletedAt
    }
  }
`;
