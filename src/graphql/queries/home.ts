import {gql} from '@apollo/client';

export const GET_HOME = gql`
  query Home($homeId: ID!) {
    home(id: $homeId) {
      id
      name
      description
      pantries {
        name
        id
        isDefault
      }
      memberships {
        id
        homeId
        userId
        user {
          email
        }
      }
      membershipStats {
        total
        active
        recentlyActive
      }
    }
  }
`;

export const GET_HOMES = gql`
  query Homes {
    homes {
      id
      name
      createdAt
      updatedAt
      pantries {
        id
        name
        isDefault
      }
    }
  }
`;
