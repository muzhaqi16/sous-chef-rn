import {useCallback} from 'react';
import {useAppStore} from '#store/useAppStore';
import {RESET_SCENARIOS, ResetOptions} from '#store/resetManager';

export const useStoreReset = () => {
  const resetStore = useAppStore(state => state.resetStore);

  const logout = useCallback(() => {
    resetStore('LOGOUT');
  }, [resetStore]);

  const fullReset = useCallback(() => {
    resetStore('FULL_RESET');
  }, [resetStore]);

  const sessionExpired = useCallback(() => {
    resetStore('SESSION_EXPIRED');
  }, [resetStore]);

  const resetOnboarding = useCallback(() => {
    resetStore('ONBOARDING_RESET');
  }, [resetStore]);

  const customReset = useCallback(
    (options: ResetOptions) => {
      resetStore(options);
    },
    [resetStore],
  );

  return {
    logout,
    fullReset,
    sessionExpired,
    resetOnboarding,
    customReset,
    // Direct access to reset scenarios for flexibility
    scenarios: RESET_SCENARIOS,
  };
};

// Alternative: Individual hooks for specific use cases
export const useAuth = () => {
  const {logout} = useStoreReset();
  const user = useAppStore(state => state.user);
  const isAuthenticated = useAppStore(state => state.getIsAuthenticated());

  return {
    user,
    isAuthenticated,
    logout, // Clean logout that resets everything properly
  };
};

export const useSession = () => {
  const {sessionExpired} = useStoreReset();

  const handleSessionExpiry = useCallback(() => {
    // Could add additional logic here like showing a modal
    sessionExpired();
  }, [sessionExpired]);

  return {
    handleSessionExpiry,
  };
};
