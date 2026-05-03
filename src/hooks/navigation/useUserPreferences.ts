import { useAppStore } from '#store/useAppStore';

export const useUserPreferences = () => {
  const user = useAppStore(state => state.user);
  const getUserNavigationState = useAppStore(
    state => state.getUserNavigationState,
  );
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );

  const shouldShowCredentialPrompt = (userId?: string): boolean => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return false;

    const navState = getUserNavigationState(targetUserId);
    return !navState?.credentialPromptDeclined;
  };

  const markBiometricDeclined = (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricDeclinedPermanently: true,
    });
  };

  const markBiometricEnabled = (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricEnabled: true,
      biometricPromptRemindLater: false,
      lastBiometricPromptDeclined: undefined,
      biometricDeclinedPermanently: false,
    });
  };

  const markCredentialPromptDeclined = (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      credentialPromptDeclined: true,
      lastCredentialPromptShown: Date.now(),
    });
  };

  const resetBiometricDeclination = (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricDeclinedPermanently: false,
    });
  };

  const resetAllPreferences = (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricDeclinedPermanently: false,
      credentialPromptDeclined: false,
    });
  };

  const trackCredentialPromptShown = (userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      lastCredentialPromptShown: Date.now(),
    });
  };

  const clearRegistrationPreferences = (userId: string) => {
    setUserNavigationState(userId, {
      credentialPromptDeclined: false,
      biometricDeclinedPermanently: false,
    });
  };

  const trackLogout = (userId: string) => {
    setUserNavigationState(userId, {
      biometricEnabled: false,
    });
  };

  return {
    shouldShowCredentialPrompt,
    markBiometricDeclined,
    markBiometricEnabled,
    markCredentialPromptDeclined,
    resetBiometricDeclination,
    resetAllPreferences,
    trackCredentialPromptShown,
    clearRegistrationPreferences,
    trackLogout,
  };
};
