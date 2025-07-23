import {gql} from '@apollo/client';

export const GET_PANTRIES = gql`
  query Pantries($homeId: ID!) {
    pantries(homeId: $homeId) {
      id
      home {
        id
      }
      name
      version
      createdAt
      updatedAt
      deletedAt
      items {
        id
        unit {
          symbol
          name
        }
        item {
          name
          status
          storageState
        }
        storageState
        expiresAt
      }
    }
  }
`;
