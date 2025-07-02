import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {
  fetchUserProfileApi,
  updateUserProfileApi,
} from '../../api/services/profileService';
import {UserProfile} from '../../api/graphql/generated';

const formatDate = (date: string | Date): string => {
  if (typeof date === 'string') {
    return new Date(date).toISOString().split('T')[0];
  } else if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return '';
};

export interface ProfileState {
  userProfile: UserProfile | null;
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

export const initialProfileState: Pick<ProfileState, 'userProfile'> = {
  userProfile: null,
};

export const createProfileSlice: StateCreator<
  RootState,
  [],
  [],
  ProfileState
> = set => ({
  userProfile: initialProfileState.userProfile,

  updateProfile: async data => {
    try {
      const updated: UserProfile = await updateUserProfileApi(data);
      set(state => {
        return {
          userProfile: {
            ...state.userProfile,
            ...updated,
            dateOfBirth: formatDate(updated.dateOfBirth),
          },
        };
      });
      return null;
    } catch (error) {
      console.error('Failed to update profile:', error);
      return error instanceof Error
        ? error.message
        : 'An unexpected error occurred.';
    }
  },

  getUserProfile: async () => {
    try {
      const profile: UserProfile = await fetchUserProfileApi();
      set(state => {
        return {
          userProfile: {
            ...state.userProfile,
            ...profile,
            dateOfBirth: formatDate(profile.dateOfBirth),
          },
        };
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  },
});
