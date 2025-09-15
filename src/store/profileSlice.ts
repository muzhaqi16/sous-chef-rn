import {StateCreator} from 'zustand';
import {
  fetchUserProfileApi,
  updateUserProfileApi,
} from '../api/services/profileService';
import {UserProfile} from '../api/graphql/generated';

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

  /** Update profile fields; returns null on success or an error message */
  updateProfile: (
    data: Partial<{
      firstName: string;
      lastName: string;
      avatarUrl: string;
      phone: string;
      dateOfBirth: string; // ISO string or 'YYYY-MM-DD'
    }>,
  ) => Promise<string | null>;

  /** Fetch current user profile from backend */
  getUserProfile: () => Promise<void>;
}

// Initial empty state
export const initialProfileState: Pick<ProfileState, 'userProfile'> = {
  userProfile: null,
};

export const createProfileSlice: StateCreator<ProfileState> = set => ({
  ...initialProfileState,

  updateProfile: async data => {
    try {
      const updated: UserProfile = await updateUserProfileApi(data);
      // Optionally format dateOfBirth to 'YYYY-MM-DD' if desired:
      set({
        userProfile: {
          ...updated,
          dateOfBirth: formatDate(updated.dateOfBirth),
        },
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
      const profile: UserProfile = await fetchUserProfileApi();
      set({
        userProfile: {
          ...profile,
          dateOfBirth: formatDate(profile.dateOfBirth),
        },
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      // Optionally: you could set error state or leave fields as-is
    }
  },
});
