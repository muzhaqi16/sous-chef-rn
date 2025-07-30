import {gql} from '@apollo/client';

export const ADD_NEW_ITEM = gql`
  mutation CreateItem($data: CreateUpdateItemInput!) {
    createItem(data: $data) {
      id
      name
      description
      barcode
      dataSource
      type
      storageState
      shelfLifeDays
      popularityCount
      showInOnboarding
      status
      visibility
      imageUrl
      healthBenefits
      allergens
      nutritions
      metadata
      tags
    }
  }
`;
