import {StateCreator} from 'zustand';
import {client} from '../apollo/client';
import {LOGIN_MUTATION, SIGNUP_MUTATION} from '../api/mutations';
import {storage} from '../storage/mmkv';

export interface AuthState {
  user: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string) => Promise<string | null>;
  signup: (
    username: string,
    email: string,
    password: string,
  ) => Promise<string | null>;
  logout: () => void;
}

export const createAuthSlice: StateCreator<AuthState> = set => ({
  user: null,
  accessToken: null,
  refreshToken: null,

  login: async (email, password) => {
    try {
      const {data} = await client.mutate({
        mutation: LOGIN_MUTATION,
        variables: {email, password},
      });
      // Expecting data.login to return { token, refreshToken, user }
      const {accessToken, refreshToken, user} = data.login;
      set({
        user,
        accessToken,
        refreshToken,
      });
      storage.set('accessToken', accessToken);
      storage.set('refreshToken', refreshToken);
      return null;
    } catch (error) {
      console.error('Login failed:', error);
      if (error instanceof Error) {
        return error.message;
      }
      return 'An unknown error occurred';
    }
  },

  signup: async (username, email, password) => {
    try {
      const {data} = await client.mutate({
        mutation: SIGNUP_MUTATION,
        variables: {username, email, password},
      });
      // Expecting data.signup to return { token, refreshToken, user }
      const {accessToken, refreshToken, user} = data.signup;
      set({
        user,
        accessToken: accessToken,
        refreshToken: refreshToken,
      });
      storage.set('accessToken', accessToken);
      storage.set('refreshToken', refreshToken);
      return null;
    } catch (error) {
      console.error('Signup failed:', error);
      if (error instanceof Error) {
        return error.message;
      }
      return 'An unknown error occurred';
    }
  },

  logout: () => {
    set({user: null, accessToken: null, refreshToken: null});
    storage.delete('authToken');
    storage.delete('refreshToken');
  },
});
