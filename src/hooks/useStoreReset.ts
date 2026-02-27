import {useAppStore} from '#store/useAppStore';
import {RESET_SCENARIOS, ResetOptions} from '#store/resetManager';

export const useStoreReset = () => {
  const resetStore = useAppStore(state => state.resetStore);

  const logout = () => {
    resetStore('LOGOUT');
  };

  const fullReset = () => {
    resetStore('FULL_RESET');
  };

  const sessionExpired = () => {
    resetStore('SESSION_EXPIRED');
  };

  const resetOnboarding = () => {
    resetStore('ONBOARDING_RESET');
  };

  const customReset = (options: ResetOptions) => {
      resetStore(options);
    };

  return {
    logout,
    fullReset,
    sessionExpired,
    resetOnboarding,
    customReset,
    // Direct access to reset scenarios for flexibility
    scenarios: RESET_SCENARIOS };
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

  const handleSessionExpiry = () => {
    // Could add additional logic here like showing a modal
    sessionExpired();
  };

  return {
    handleSessionExpiry };
};
