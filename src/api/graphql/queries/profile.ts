import {gql} from '@apollo/client';

export const GET_USER_PROFILE = gql`
  query UserProfile {
    userProfile {
      id
      userId
      firstName
      lastName
      avatarUrl
      phone
      dateOfBirth
      createdAt
      updatedAt
    }
  }
`;
