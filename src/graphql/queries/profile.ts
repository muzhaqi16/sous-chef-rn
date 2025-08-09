import {gql} from '@apollo/client';

export const GET_USER_PROFILE = gql`
  query UserProfile {
    userProfile {
      id
      userId
      firstName
      lastName
      displayName
      bio
      avatar
      coverImage
      phone
      website
      dateOfBirth
      gender
      profileVisibility
      showEmail
      showPhone
      createdAt
      updatedAt
    }
  }
`;
