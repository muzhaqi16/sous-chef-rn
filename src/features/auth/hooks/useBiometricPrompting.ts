import { useAppStore, useUser } from '#store/useAppStore';

export const useBiometricPrompting = () => {
  const user = useUser();
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );

  const recordBiometricPromptResponse = (
    enabled: boolean,
    declinedPermanently = false,
  ) => {
    if (!user?.id) return;

    if (enabled) {
      // User enabled biometric - clear any decline state
      setUserNavigationState(user.id, {
        biometricEnabled: true,
        biometricDeclinedPermanently: false,
      });
    } else if (declinedPermanently) {
      // User chose "Never ask again"
      setUserNavigationState(user.id, {
        biometricDeclinedPermanently: true,
      });
    }
  };

  return { recordBiometricPromptResponse };
};
