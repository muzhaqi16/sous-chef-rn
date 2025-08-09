import {gql} from '@apollo/client';

export const ADD_NEW_ITEM = gql`
  mutation CreateItem($input: CreateItemInput!) {
    createItem(input: $input) {
      id
      name
      description
      barcode
      fdcId
      dataSource
      type
      storageState
      showInOnboarding
      shelfLifeDays
      popularity
      status
      visibility
      averagePrice
      minPrice
      maxPrice
      priceUpdatedAt
      imageUrl
      tags
      healthBenefits
      allergens
      nutritions
      metadata
      ingredients
      createdAt
      updatedAt
      deletedAt
      version
      categories {
        id
        category {
          name
        }
      }
    }
  }
`;
