import {gql} from '@apollo/client';

export const GET_ITEMS = gql`
  query Items(
    $filters: ItemFilters
    $sort: ItemSortInput
    $pagination: PaginationInput
  ) {
    items(filters: $filters, sort: $sort, pagination: $pagination) {
      items {
        id
        name
        description
        type
        barcode
        storageState
        imageUrl
        shelfLifeDays
        tags
        status
        visibility
        showInOnboarding
        units {
          id
          isDefault
        }
        brands {
          id
        }
        categories {
          id
        }
        nutritions
        categories {
          id
        }
        healthBenefits
        metadata
        createdAt
        updatedAt
        deletedAt
        version
      }
      totalCount
    }
  }
`;

export const GET_ITEMS_FOR_AUTOCOMPLETE = gql`
  query SearchItems($input: SearchItemsInput!) {
    searchItems(input: $input) {
      items {
        id
        name
      }
      totalCount
      hasMore
    }
  }
`;

export const SEARCH_ITEM_BY_BARCODE = gql`
  query SearchItemsByBarcode($barcode: String!) {
    searchItemsByBarcode(barcode: $barcode) {
      id
      name
      description
      imageUrl
      barcode
    }
  }
`;
