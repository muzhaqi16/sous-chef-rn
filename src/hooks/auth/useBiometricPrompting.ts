import { useAppStore, useUser } from '#store/useAppStore';
import {
  hasCredentialsForAccount,
  getBiometricCapability,
} from '#/storage/keychain';
import { executeQuery } from '#/utils/compilerSafeWrappers';

type BiometricPromptDecision =
  | { shouldShow: false; reason: string }
  | { shouldShow: true; reason?: undefined };

export const useBiometricPrompting = () => {
  const user = useUser();
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );
  const getUserNavigationState = useAppStore(
    state => state.getUserNavigationState,
  );

  const shouldShowPostLoginBiometricPrompt = async (targetUser?: {
    id: string;
    email: string;
  }): Promise<BiometricPromptDecision> => {
    const checkUser = targetUser || user;
    if (!checkUser?.id || !checkUser?.email) {
      return { shouldShow: false, reason: 'No user found' };
    }

    // Check if user is new and hasn't completed onboarding yet
    const navState = getUserNavigationState(checkUser.id);
    if (navState?.isNewUser && !navState?.hasCompletedOnboarding) {
      return {
        shouldShow: false,
        reason: 'New user - biometric setup handled during onboarding',
      };
    }

    const result = await executeQuery<BiometricPromptDecision>(async () => {
      // Check if biometric is available on device
      const biometricInfo = await getBiometricCapability();
      if (!biometricInfo.isAvailable) {
        return { shouldShow: false, reason: 'Biometric not available' };
      }

      // Check if user already has credentials saved
      const hasCreds = await hasCredentialsForAccount();
      if (hasCreds) {
        return { shouldShow: false, reason: 'Already has biometric setup' };
      }

      // Check if user permanently declined biometric authentication
      if (navState?.biometricDeclinedPermanently) {
        return {
          shouldShow: false,
          reason: 'User permanently declined biometric authentication',
        };
      }

      return { shouldShow: true };
    }, 'Error checking biometric prompt eligibility');

    return (
      result ?? { shouldShow: false, reason: 'Error checking eligibility' }
    );
  };

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

  const resetBiometricDeclination = () => {
    if (!user?.id) return;

    setUserNavigationState(user.id, {
      biometricDeclinedPermanently: false,
    });
  };

  return {
    shouldShowPostLoginBiometricPrompt,
    recordBiometricPromptResponse,
    resetBiometricDeclination,
  };
};
