// src/store/profileSlice.ts
import {StateCreator} from 'zustand';
import {
  fetchUserProfileApi,
  updateUserProfileApi,
} from '../api/services/profileService';
import {UserProfile} from '../graphql/generated';

export interface ProfileState {
  profileId: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  dateOfBirth: string | null; // e.g. 'YYYY-MM-DD' or null

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
export const initialProfileState: Pick<
  ProfileState,
  'profileId' | 'firstName' | 'lastName' | 'avatarUrl' | 'phone' | 'dateOfBirth'
> = {
  profileId: null,
  firstName: null,
  lastName: null,
  avatarUrl: null,
  phone: null,
  dateOfBirth: null,
};

export const createProfileSlice: StateCreator<ProfileState> = set => ({
  ...initialProfileState,

  updateProfile: async data => {
    try {
      const updated: UserProfile = await updateUserProfileApi(data);
      // Optionally format dateOfBirth to 'YYYY-MM-DD' if desired:
      const dobFormatted = updated.dateOfBirth
        ? new Date(updated.dateOfBirth).toISOString().split('T')[0]
        : null;
      set({
        profileId: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        avatarUrl: updated.avatarUrl,
        phone: updated.phone,
        dateOfBirth: dobFormatted,
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
      const dobFormatted = profile.dateOfBirth
        ? new Date(profile.dateOfBirth).toISOString().split('T')[0]
        : null;
      set({
        profileId: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatarUrl: profile.avatarUrl,
        phone: profile.phone,
        dateOfBirth: dobFormatted,
      });
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      // Optionally: you could set error state or leave fields as-is
    }
  },
});
