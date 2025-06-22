import {client} from '../../apollo/client';
import {UPDATE_USER_PROFILE_MUTATION} from '../graphql/mutations/profile';
import {GET_USER_PROFILE} from '../graphql/queries/profile';

import {UserProfile, UpdateUserSettingsInput} from '../graphql/generated';

export async function fetchUserProfileApi(): Promise<UserProfile> {
  const response = await client.query({
    query: GET_USER_PROFILE,
    fetchPolicy: 'network-only',
  });
  if (!response || !response.data) {
    throw new Error('No data returned from server');
  }
  const profile = response.data.userProfile;
  if (!profile) {
    throw new Error('No profile found');
  }
  // Return as UserProfile. Optionally, keep dateOfBirth raw here and format in slice or UI.
  return profile;
}

export async function updateUserProfileApi(
  data: UpdateUserSettingsInput,
): Promise<UserProfile> {
  const response = await client.mutate({
    mutation: UPDATE_USER_PROFILE_MUTATION,
    variables: {data},
  });
  if (!response || !response.data) {
    throw new Error('No data returned from server');
  }
  const profile = response.data.updateUserProfile;
  if (!profile) {
    throw new Error('No profile returned');
  }
  return profile;
}
