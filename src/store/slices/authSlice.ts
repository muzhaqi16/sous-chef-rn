import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {
  RefreshTokenMutation,
  LoginMutation,
  RegisterMutation,
  GetCompleteUserQuery,
  GetAuthUserQuery,
} from '#generated';

// Types from your auth mutations (with minimal user data)
type LoginResponse = NonNullable<LoginMutation['login']>;
type RegisterResponse = NonNullable<RegisterMutation['register']>;
type AuthResponse = LoginResponse | RegisterResponse;

// Auth user type (minimal data from login/register)
type AuthUser = NonNullable<GetAuthUserQuery['me']>;

// Complete user type (from profile queries)
type CompleteUser = NonNullable<GetCompleteUserQuery['me']>;

export interface AuthState {
  user: AuthUser | CompleteUser | null; // Can be minimal or complete user data
  accessToken: string | null;
  refreshToken: string | null;
  pendingEmail?: string;
  pendingPassword?: string;
  isAuthenticated: boolean;

  // Auth methods
  setAuthFromResponse: (response: AuthResponse) => void;
  setCompleteUser: (user: CompleteUser) => void;
  setAuth: (
    user: AuthUser | CompleteUser,
    accessToken?: string,
    refreshToken?: string,
  ) => void;
  setTokens: ({
    accessToken,
    refreshToken,
  }: {
    accessToken?: string;
    refreshToken?: string;
  }) => void;
  updateUser: (updates: Partial<AuthUser | CompleteUser>) => void;
  setEmailVerified: (emailVerified: boolean) => void;
  setTokensFromRefresh: (
    response: NonNullable<RefreshTokenMutation['refresh']>,
  ) => void;
  setPendingCredentials: (email: string, password: string) => void;
  clearPendingCredentials: () => void;
  logout: () => Promise<void>;

  // Utility methods
  hasCompleteUserData: () => boolean; // Check if user has complete data
}

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  pendingEmail: undefined,
  pendingPassword: undefined,
  isAuthenticated: false,
};

export const createAuthSlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  AuthState
> = (set, get) => ({
  ...initialAuthState,

  get isAuthenticated() {
    const state = get();
    return !!(state?.user && state?.accessToken);
  },

  setAuthFromResponse: response =>
    set(state => {
      state.user = response.user; // Minimal user data from auth
      state.accessToken = response.accessToken;
      state.refreshToken = response.refreshToken;
    }),

  setCompleteUser: user =>
    set(state => {
      // Keep existing tokens, just update user data to complete version
      state.user = user;
    }),

  setAuth: (user, accessToken, refreshToken) =>
    set(state => {
      state.user = user;
      if (accessToken) state.accessToken = accessToken;
      if (refreshToken) state.refreshToken = refreshToken;
    }),

  setTokens: ({accessToken, refreshToken}) =>
    set(state => {
      if (accessToken) state.accessToken = accessToken;
      if (refreshToken) state.refreshToken = refreshToken;
    }),

  updateUser: updates =>
    set(state => {
      if (state.user) {
        Object.assign(state.user, updates);
      }
    }),

  setEmailVerified: emailVerified =>
    set(state => {
      if (state.user) {
        state.user.emailVerified = emailVerified;
      }
    }),

  setTokensFromRefresh: response =>
    set(state => {
      state.accessToken = response.accessToken;
      state.refreshToken = response.refreshToken;
    }),

  setPendingCredentials: (email, password) =>
    set(state => {
      state.pendingEmail = email;
      state.pendingPassword = password;
    }),

  clearPendingCredentials: () =>
    set(state => {
      state.pendingEmail = undefined;
      state.pendingPassword = undefined;
    }),

  // Enhanced logout that properly clears everything
  logout: async () => {
    console.log('AuthSlice: Starting logout process...');

    try {
      // The reset manager will be available on the store when this is called
      const store = get();
      if ('resetStore' in store) {
        await (store as any).resetStore('LOGOUT');
        console.log('AuthSlice: Logout completed successfully');
      } else {
        console.error(
          'AuthSlice: Reset manager not available, performing manual reset',
        );
        // Fallback manual reset
        set(initialAuthState);
      }
    } catch (error) {
      console.error('AuthSlice: Error during logout:', error);
      // Ensure we at least clear the auth state even if other cleanup fails
      set(initialAuthState);
    }
  },

  hasCompleteUserData: () => {
    const state = get();
    // Check if user has properties that only exist in complete user data
    return !!(state.user && 'addresses' in state.user);
  },
});
