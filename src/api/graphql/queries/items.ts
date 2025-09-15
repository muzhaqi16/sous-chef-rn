import {gql} from '@apollo/client';

export const GET_ITEMS = gql`
  query Items($filter: ItemFilterInput, $limit: Int, $offset: Int) {
    items(filter: $filter, limit: $limit, offset: $offset) {
      totalCount
      items {
        id
        name
        description
        barcode
        aisle
        storageState
        imageUrl
        shelfLifeDays
        popularityCount
        tags
        status
        visibility
        showInOnboarding
        unit {
          conversionFactor
          id
          name
          symbol
          type
        }
        categories {
          name
        }
        skus {
          sku
        }
        updatedAt
        deletedAt
        version
      }
    }
  }
`;

export const GET_ITEMS_FOR_AUTOCOMPLETE = gql`
  query AutocompleteItems($name: String!) {
    autocompleteItems(name: $name) {
      id
      name
    }
  }
`;
