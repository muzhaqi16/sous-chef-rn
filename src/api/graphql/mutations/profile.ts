import {gql} from '@apollo/client';

export const UPDATE_USER_PROFILE_MUTATION = gql`
  mutation UpdateUserProfile($data: UpdateUserSettingsInput!) {
    updateUserProfile(data: $data) {
      id
      firstName
      lastName
      avatarUrl
      phone
      dateOfBirth
    }
  }
`;
