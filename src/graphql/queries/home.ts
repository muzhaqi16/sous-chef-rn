import {gql} from '@apollo/client';

export const GET_OR_CREATE_DEFAULT_HOME = gql`
  query Home {
    home {
      id
      name
      owner {
        id
      }
      defaultPantry {
        id
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_HOME_BY_ID = gql`
  query HomeById($id: ID!) {
    home(id: $id) {
      id
      name
      owner {
        id
      }
      defaultPantry {
        id
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_HOMES = gql`
  query Homes {
    homes {
      id
      name
      owner {
        id
      }
      defaultPantry {
        id
      }
      createdAt
      updatedAt
    }
  }
`;
