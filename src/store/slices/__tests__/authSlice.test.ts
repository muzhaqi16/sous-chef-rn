import { createTestStore } from '#/test-utils/createTestStore';

// Mock external dependencies that authSlice imports
jest.mock('../../../apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelTokenRefresh: jest.fn(),
}));
jest.mock('../../../apollo/links/refreshToken', () => ({
  proactiveTokenRefresh: jest.fn(),
}));

const { scheduleTokenRefresh, cancelTokenRefresh } = require('../../../apollo/links/tokenScheduler');

const testUser = {
  id: 'user-1',
  email: 'Test@Example.com',
  emailVerified: true,
  onBoarded: true,
  firstName: 'Test',
  lastName: 'User',
};

describe('authSlice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial state', () => {
    it('starts with null user and tokens', () => {
      const store = createTestStore();
      expect(store.getState().user).toBeNull();
      expect(store.getState().accessToken).toBeNull();
      expect(store.getState().refreshToken).toBeNull();
    });

    it('getIsAuthenticated returns false initially', () => {
      const store = createTestStore();
      expect(store.getState().getIsAuthenticated()).toBe(false);
    });
  });

  describe('setAuth', () => {
    it('sets user and tokens', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'access-tk', 'refresh-tk');
      const state = store.getState();
      expect(state.user?.id).toBe('user-1');
      expect(state.accessToken).toBe('access-tk');
      expect(state.refreshToken).toBe('refresh-tk');
    });

    it('normalizes email to lowercase', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'a', 'r');
      expect(store.getState().user?.email).toBe('test@example.com');
    });

    it('flattens profile fields from GraphQL response', () => {
      const store = createTestStore();
      const userWithProfile = {
        ...testUser,
        profile: { firstName: 'Profile', lastName: 'Name', displayName: 'pname', avatar: 'avatar.jpg' },
      };
      store.getState().setAuth(userWithProfile as any, 'a', 'r');
      const user = store.getState().user;
      expect(user?.firstName).toBe('Profile');
      expect(user?.lastName).toBe('Name');
      expect(user?.name).toBe('pname');
      expect(user?.profilePicture).toBe('avatar.jpg');
    });

    it('clears navigation state when user changes', () => {
      const store = createTestStore({
        selectedHomeId: 'home-1',
        selectedPantryId: 'pantry-1',
        selectedShoppingListId: 'list-1',
      } as any);
      store.getState().setAuth(testUser, 'a', 'r');
      expect(store.getState().selectedHomeId).toBeNull();
      expect(store.getState().selectedPantryId).toBeNull();
      expect(store.getState().selectedShoppingListId).toBeNull();
    });

    it('schedules token refresh', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'access-tk', 'r');
      expect(scheduleTokenRefresh).toHaveBeenCalledWith('access-tk', expect.any(Function));
    });

    it('clears isAutoLoggingIn', () => {
      const store = createTestStore({ isAutoLoggingIn: true } as any);
      store.getState().setAuth(testUser, 'a', 'r');
      expect(store.getState().isAutoLoggingIn).toBe(false);
    });

    it('getIsAuthenticated returns true after setAuth', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'a', 'r');
      expect(store.getState().getIsAuthenticated()).toBe(true);
    });
  });

  describe('updateUser', () => {
    it('updates user fields', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'a', 'r');
      store.getState().updateUser({ firstName: 'Updated' });
      expect(store.getState().user?.firstName).toBe('Updated');
    });

    it('normalizes email in updates', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'a', 'r');
      store.getState().updateUser({ email: ' New@Email.COM ' });
      expect(store.getState().user?.email).toBe('new@email.com');
    });

    it('does nothing when user is null', () => {
      const store = createTestStore();
      store.getState().updateUser({ firstName: 'X' });
      expect(store.getState().user).toBeNull();
    });
  });

  describe('setTokens', () => {
    it('updates accessToken', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'old', 'r');
      store.getState().setTokens({ accessToken: 'new' });
      expect(store.getState().accessToken).toBe('new');
    });

    it('schedules refresh for new access token', () => {
      const store = createTestStore();
      store.getState().setTokens({ accessToken: 'new' });
      expect(scheduleTokenRefresh).toHaveBeenCalledWith('new', expect.any(Function));
    });
  });

  describe('setEmailVerified', () => {
    it('updates emailVerified on user', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'a', 'r');
      store.getState().setEmailVerified(false);
      expect(store.getState().user?.emailVerified).toBe(false);
    });
  });

  describe('setOnboarded', () => {
    it('updates onBoarded on user', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'a', 'r');
      store.getState().setOnboarded(false);
      expect(store.getState().user?.onBoarded).toBe(false);
    });
  });

  describe('clearAuth', () => {
    it('clears user and tokens', () => {
      const store = createTestStore();
      store.getState().setAuth(testUser, 'a', 'r');
      store.getState().clearAuth();
      expect(store.getState().user).toBeNull();
      expect(store.getState().accessToken).toBeNull();
      expect(store.getState().refreshToken).toBeNull();
    });

    it('cancels token refresh', () => {
      const store = createTestStore();
      store.getState().clearAuth();
      expect(cancelTokenRefresh).toHaveBeenCalled();
    });
  });

  describe('setHasStoredCredentials', () => {
    it('sets hasStoredCredentials', () => {
      const store = createTestStore();
      store.getState().setHasStoredCredentials(true);
      expect(store.getState().hasStoredCredentials).toBe(true);
    });
  });

  describe('setIsAutoLoggingIn', () => {
    it('sets isAutoLoggingIn', () => {
      const store = createTestStore();
      store.getState().setIsAutoLoggingIn(true);
      expect(store.getState().isAutoLoggingIn).toBe(true);
    });
  });
});
