import {StateCreator} from 'zustand';
import {client} from '../apollo/client';
import {UPDATE_USER_PROFILE_MUTATION} from '../api/mutations';
import {GET_USER_PROFILE} from '../api/queries';

export interface ProfileState {
  profileId: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  dateOfBirth: string | null;

  updateProfile: (
    data: Partial<{
      firstName: string;
      lastName: string;
      avatarUrl: string;
      phone: string;
      dateOfBirth: string;
    }>,
  ) => Promise<string | null>;
  getUserProfile: () => Promise<void>;
}

export const createProfileSlice: StateCreator<ProfileState> = set => ({
  profileId: null,
  firstName: null,
  lastName: null,
  avatarUrl: null,
  phone: null,
  dateOfBirth: null,

  updateProfile: async data => {
    try {
      const response = await client.mutate<{
        updateUserProfile: {
          id: string;
          firstName: string | null;
          lastName: string | null;
          avatarUrl: string | null;
          phone: string | null;
          dateOfBirth: string | null;
        };
      }>({
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

      set({
        profileId: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        dateOfBirth: profile.dateOfBirth,
      });
      return null;
    } catch (error) {
      console.error('Failed to update profile:', error);
      if (error instanceof Error) {
        return error.message;
      }
      return 'An unexpected error occurred.';
    }
  },

  getUserProfile: async () => {
    try {
      const response = await client.query<{
        userProfile: {
          id: string;
          firstName: string | null;
          lastName: string | null;
          avatarUrl: string | null;
          phone: string | null;
          dateOfBirth: string | null;
        };
      }>({
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

      set({
        profileId: profile?.id,
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        avatarUrl: profile?.avatarUrl,
        phone: profile.phone,
        // Ensure dateOfBirth is handled correctly, it is if full ISO string but can be null if not set
        dateOfBirth: profile.dateOfBirth
          ? new Date(profile.dateOfBirth).toISOString().split('T')[0]
          : null,
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  },
});
