import {gql} from '@apollo/client';

export const GET_PANTRIES = gql`
  query Pantries($homeId: ID!) {
    pantries(homeId: $homeId) {
      id
      homeId
      name
      isDefault
      items {
        id
        itemName
        item {
          name
        }
      }
      createdAt
      updatedAt
      version
      tags
    }
  }
`;
