import { useCallback } from 'react';
import { useAppStore } from '#store/useAppStore';

export const useUserPreferences = () => {
  const user = useAppStore(state => state.user);
  const getUserNavigationState = useAppStore(state => state.getUserNavigationState);
  const setUserNavigationState = useAppStore(state => state.setUserNavigationState);

  const shouldShowCredentialPrompt = useCallback((userId?: string): boolean => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return false;

    const navState = getUserNavigationState(targetUserId);
    return !navState?.credentialPromptDeclined;
  }, [user?.id, getUserNavigationState]);

  const markBiometricDeclined = useCallback((userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricDeclinedPermanently: true,
    });
  }, [user?.id, setUserNavigationState]);

  const markBiometricEnabled = useCallback((userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricEnabled: true,
      biometricPromptRemindLater: false,
      lastBiometricPromptDeclined: undefined,
      biometricDeclinedPermanently: false,
    });
  }, [user?.id, setUserNavigationState]);

  const markCredentialPromptDeclined = useCallback((userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      credentialPromptDeclined: true,
      lastCredentialPromptShown: Date.now(),
    });
  }, [user?.id, setUserNavigationState]);

  const resetBiometricDeclination = useCallback((userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricDeclinedPermanently: false,
    });
  }, [user?.id, setUserNavigationState]);

  const resetAllPreferences = useCallback((userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      biometricDeclinedPermanently: false,
      credentialPromptDeclined: false,
    });
  }, [user?.id, setUserNavigationState]);

  const trackCredentialPromptShown = useCallback((userId?: string) => {
    const targetUserId = userId || user?.id;
    if (!targetUserId) return;

    setUserNavigationState(targetUserId, {
      lastCredentialPromptShown: Date.now(),
    });
  }, [user?.id, setUserNavigationState]);

  const clearRegistrationPreferences = useCallback((userId: string) => {
    setUserNavigationState(userId, {
      credentialPromptDeclined: false,
      biometricDeclinedPermanently: false,
    });
  }, [setUserNavigationState]);

  const trackLogout = useCallback((userId: string) => {
    setUserNavigationState(userId, {
      biometricEnabled: false,
    });
  }, [setUserNavigationState]);

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