import {StateCreator} from 'zustand';
import {RootState} from '../index';
import {storage} from '#/storage/mmkv';
import NavigationService from '#/services/NavigationService';
import {LogoutCleanup} from '#/apollo/logoutCleanup';
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

// User-specific navigation state
interface UserNavigationState {
  lastRoute?: string;
  onboardingProgress?: string;
  lastLoginTimestamp?: number;
  rememberMeChoice?: boolean;
  hasCompletedOnboarding?: boolean;
  // Add these if you want to track more onboarding details
  onboardingStartedAt?: number;
  onboardingCompletedAt?: number;
  skippedOnboardingSteps?: string[];
  isNewUser?: boolean;
}

// Auth flow tracking
interface AuthFlow {
  isNewUser: boolean;
  requiresVerification: boolean;
  loginMethod: 'email' | 'biometric' | 'social' | null;
  lastLoginTimestamp: number | null;
}

export interface AuthState {
  user: AuthUser | CompleteUser | null;
  hasStoredCredentials: boolean | null;
  accessToken: string | null;
  refreshToken: string | null;
  pendingEmail?: string;
  pendingPassword?: string;
  isAuthenticated: boolean;
  authFlow: AuthFlow;

  // User-specific state management
  userStates: Record<string, UserNavigationState>;

  // Auth methods
  setAuthFromResponse: (response: AuthResponse) => void;
  checkStoredCredentials: () => Promise<void>;
  completeAuthentication: (
    response: AuthResponse,
    rememberMe?: boolean,
  ) => Promise<void>;
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

  // Auth flow methods
  setAuthFlow: (flow: Partial<AuthFlow>) => void;

  // User-specific state methods
  setUserNavigationState: (
    userId: string,
    state: Partial<UserNavigationState>,
  ) => void;
  getUserNavigationState: (userId: string) => UserNavigationState | null;
  clearUserNavigationState: (userId: string) => void;

  // Utility methods
  hasCompleteUserData: () => boolean;
}

const initialAuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  pendingEmail: undefined,
  pendingPassword: undefined,
  isAuthenticated: false,
  hasStoredCredentials: null,
  authFlow: {
    isNewUser: false,
    requiresVerification: false,
    loginMethod: null,
    lastLoginTimestamp: null,
  },
  userStates: {},
};

// Helper to get user state key
const getUserStateKey = (userId: string) => `user_nav_state_${userId}`;

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
      state.user = response.user;
      state.accessToken = response.accessToken;
      state.refreshToken = response.refreshToken;

      // Set auth flow based on response
      state.authFlow.requiresVerification = !response.user.emailVerified;
      state.authFlow.lastLoginTimestamp = Date.now();
    }),

  completeAuthentication: async (
    response: AuthResponse,
    rememberMe?: boolean,
  ) => {
    const {user, accessToken, refreshToken} = response;

    // Load any existing user state
    const existingUserState = storage.getString(getUserStateKey(user.id));
    let userNavState: UserNavigationState = {};

    if (existingUserState) {
      try {
        userNavState = JSON.parse(existingUserState);
      } catch (e) {
        console.error('Failed to parse user state:', e);
      }
    }

    // Update store
    set(state => {
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.authFlow = {
        ...state.authFlow,
        lastLoginTimestamp: Date.now(),
        requiresVerification: !user.emailVerified,
      };

      // Store user-specific state
      state.userStates[user.id] = {
        ...userNavState,
        lastLoginTimestamp: Date.now(),
        rememberMeChoice: rememberMe,
      };
    });

    // Save to persistent storage
    storage.set(
      getUserStateKey(user.id),
      JSON.stringify(get().userStates[user.id]),
    );

    // Navigation is now handled declaratively via useNavigationFlow
  },

  setCompleteUser: user =>
    set(state => {
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

  setAuthFlow: flow =>
    set(state => {
      state.authFlow = {...state.authFlow, ...flow};
    }),

  // User-specific navigation state management
  setUserNavigationState: (
    userId: string,
    navState: Partial<UserNavigationState>,
  ) => {
    const state = get();
    const currentUserState = state.userStates[userId] || {};
    const updatedState = {...currentUserState, ...navState};

    // Update in-memory state
    set(state => {
      state.userStates[userId] = updatedState;
    });

    // Persist to storage
    storage.set(getUserStateKey(userId), JSON.stringify(updatedState));
  },

  getUserNavigationState: (userId: string) => {
    const state = get();

    // Check in-memory first
    if (state.userStates[userId]) {
      return state.userStates[userId];
    }

    // Check persistent storage
    const stored = storage.getString(getUserStateKey(userId));
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Update in-memory cache
        set(state => {
          state.userStates[userId] = parsed;
        });
        return parsed;
      } catch (e) {
        console.error('Failed to parse user navigation state:', e);
      }
    }

    return null;
  },

  clearUserNavigationState: (userId: string) => {
    // Clear from memory
    set(state => {
      delete state.userStates[userId];
    });

    // Clear from storage
    storage.delete(getUserStateKey(userId));
  },

  logout: async () => {
    console.log('🔐 AuthSlice: Starting logout process...');

    const currentUser = get().user;

    try {
      // 1. Set logout state immediately to prevent queries
      const store = get();
      if ('setLoggingOut' in store) {
        store.setLoggingOut(true);
        console.log('🔄 Set global logout state to true');
      }

      // 2. Initiate logout in navigation state machine
      if ('initiateLogout' in store) {
        store.initiateLogout();
      }

      // 3. Perform Apollo cleanup first
      console.log('🧹 Starting Apollo cleanup...');
      await LogoutCleanup.performLogoutCleanup();

      // 4. Save any important user state before logout
      if (currentUser?.id) {
        const userState = get().userStates[currentUser.id];
        if (userState) {
          // Keep remember me choice but clear session data
          const preservedState: UserNavigationState = {
            rememberMeChoice: userState.rememberMeChoice,
            hasCompletedOnboarding: currentUser.onBoarded,
          };
          storage.set(
            getUserStateKey(currentUser.id),
            JSON.stringify(preservedState),
          );
        }
      }

      // 5. Reset the store via reset manager
      if ('resetStore' in store) {
        await store.resetStore('LOGOUT');
      } else {
        console.error(
          'AuthSlice: Reset manager not available, performing manual reset',
        );
        set(initialAuthState);
      }

      // 6. Complete logout cleanup
      LogoutCleanup.completeLogout();

      // 7. Complete navigation state transition
      if ('completeLogout' in store) {
        store.completeLogout();
      }

      // 8. Clear logout state
      if ('setLoggingOut' in store) {
        store.setLoggingOut(false);
        console.log('🔄 Cleared global logout state');
      }

      // 9. Navigate to auth
      NavigationService.push('AuthStack' as any);

      console.log('✅ AuthSlice: Logout completed successfully');
    } catch (error) {
      console.error('❌ AuthSlice: Error during logout:', error);

      // Fallback: complete cleanup and reset state
      LogoutCleanup.completeLogout();

      // Clear logout state in error case too
      const store = get();
      if ('setLoggingOut' in store) {
        store.setLoggingOut(false);
      }

      set(initialAuthState);
      NavigationService.push('AuthStack' as any);
    }
  },

  hasCompleteUserData: () => {
    const state = get();
    return !!(state.user && 'addresses' in state.user);
  },
  checkStoredCredentials: async () => {
    try {
      const {hasCredentials} = await import('#/storage/keychain');
      const hasCreds = await hasCredentials();
      set({hasStoredCredentials: hasCreds});
    } catch (error) {
      console.error('Error checking stored credentials:', error);
      set({hasStoredCredentials: false});
    }
  },
});
