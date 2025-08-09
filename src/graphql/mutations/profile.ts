import {gql} from '@apollo/client';

export const UPDATE_USER_PROFILE_MUTATION = gql`
  mutation UpdateProfile($input: UpdateUserProfileInput!) {
    updateProfile(input: $input) {
      id
      firstName
      lastName
      avatar
      phone
      dateOfBirth
    }
  }
`;
