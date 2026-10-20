import { useAppStore, useUser } from '#store/useAppStore';

export const useAuthPreferences = () => {
  const user = useUser();
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );

  const markBiometricDeclined = (userId?: string) => {
    const targetUserId = userId ?? user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricDeclinedPermanently: true,
    });
  };

  const markBiometricEnabled = (userId?: string) => {
    const targetUserId = userId ?? user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricEnabled: true,
      biometricPromptRemindLater: false,
      lastBiometricPromptDeclined: undefined,
      biometricDeclinedPermanently: false,
    });
  };

  const markCredentialPromptDeclined = (userId?: string) => {
    const targetUserId = userId ?? user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      credentialPromptDeclined: true,
      lastCredentialPromptShown: Date.now(),
    });
  };

  const resetBiometricDeclination = (userId?: string) => {
    const targetUserId = userId ?? user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricDeclinedPermanently: false,
    });
  };

  return {
    markBiometricDeclined,
    markBiometricEnabled,
    markCredentialPromptDeclined,
    resetBiometricDeclination,
  };
};
