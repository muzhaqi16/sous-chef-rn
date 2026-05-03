import { useAppStore } from '#store/useAppStore';

export const useAuthState = () => {
  const user = useAppStore(state => state.user);
  const isHydrated = useAppStore(state => state.isHydrated);
  const navigationState = useAppStore(state => state.navigationState);
  const showBiometricSetup = useAppStore(state => state.showBiometricSetup);

  // New simplified state based on navigation state machine
  return {
    // Navigation state machine states
    isLoading: navigationState === 'loading',
    isUnauthenticated: navigationState === 'auth',
    needsVerification: navigationState === 'verification',
    needsBiometricSetup: navigationState === 'biometric_setup',
    needsOnboarding: navigationState === 'onboarding',
    isFullyAuthenticated: navigationState === 'main_app',

    // Legacy computed states for backward compatibility (will be removed later)
    baseIsAuthenticated: isHydrated && !!user,
    baseIsFullyAuthenticated:
      isHydrated && !!user && user.emailVerified && user.onBoarded === true,

    // Raw values for convenience
    user,
    isHydrated,
    navigationState,
    showBiometricSetup,
  };
};
