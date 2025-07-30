import {gql} from '@apollo/client';

export const GET_ITEMS = gql`
  query Items($filter: ItemFilterInput, $offset: Int, $limit: Int) {
    items(filter: $filter, offset: $offset, limit: $limit) {
      items {
        id
        name
        description
        type
        barcode
        storageState
        imageUrl
        shelfLifeDays
        popularityCount
        tags
        status
        visibility
        showInOnboarding
        units {
          id
          isDefault
          conversionFactor
          notes
        }
        brands {
          name
          id
        }
        categories {
          name
          id
        }
        nutritions
        categories {
          id
          name
        }
        healthBenefits
        metadata
        createdBy {
          id
        }
        updatedBy {
          id
        }
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
  query AutocompleteItems($name: String!, $limit: Int) {
    autocompleteItems(name: $name, limit: $limit) {
      name
      id
      imageUrl
      shelfLifeDays
      units {
        id
        unit {
          id
          name
          symbol
          type
          conversionFactor
          notes
        }
        isDefault
        conversionFactor
        notes
      }
    }
  }
`;

export const SEARCH_ITEM_BY_BARCODE = gql`
  query SearchItemByBarcode($barcode: String!) {
    itemByBarcode(barcode: $barcode) {
      id
      name
      description
      imageUrl
      barcode
    }
  }
`;
