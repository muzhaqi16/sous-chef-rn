import {useCallback} from 'react';
import {useStore} from '#store';
import {RESET_SCENARIOS, ResetOptions} from '#store/resetManager';

export const useStoreReset = () => {
  const resetStore = useStore(state => state.resetStore);

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
  const user = useStore(state => state.user);
  const isAuthenticated = useStore(state => state.isAuthenticated);

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
