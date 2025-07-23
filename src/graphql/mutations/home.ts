import {gql} from '@apollo/client';

export const CREATE_HOME = gql`
  mutation CreateHome($input: CreateHomeInput!) {
    createHome(input: $input) {
      id
      name
      type
      owner {
        id
      }
      createdAt
      updatedAt
      version
      deletedAt
    }
  }
`;
