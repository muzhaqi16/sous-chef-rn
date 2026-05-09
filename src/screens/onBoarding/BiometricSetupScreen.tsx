import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Pressable } from '#components/atoms/themedComponents';
import { alertService } from '#/services/alertService';
import { StyleSheet } from 'react-native-unistyles';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { Icon } from '#utils/iconUtils';
import { authService } from '#/services/authService';
import { useTextInputModal } from '#components/organisms/modal/useTextInputModal';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { useUserPreferences } from '#hooks/navigation/useUserPreferences';
import { useAppStore, useUser } from '#store/useAppStore';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  loadTempRegistrationPassword,
  clearTempRegistrationPassword,
} from '#/storage/keychain';
import { executeWithLoadingState } from '#/utils/compilerSafeWrappers';
import { Text } from '#components/atoms/Text';

/** Module-level helper to fetch biometric availability info.
 *  Extracted to avoid try/catch inside the component's useEffect (React Compiler bailout). */
async function loadBiometricInfoSafe(
  setBiometricInfo: (info: {
    isAvailable: boolean;
    biometryType: string | null;
  }) => void,
  setHasCheckedBiometric: (v: boolean) => void,
): Promise<void> {
  try {
    const info = await authService.getBiometricInfo();
    setBiometricInfo(info);
  } catch (error) {
    console.error('Error loading biometric info:', error);
    setBiometricInfo({ isAvailable: false, biometryType: null });
  } finally {
    setHasCheckedBiometric(true);
  }
}

/** Module-level helper that tries to load a temp registration password from keychain.
 *  Returns null on failure. Extracted to avoid try/catch inside an event handler closure
 *  in the component body (React Compiler bailout). */
async function tryLoadTempPassword(email: string): Promise<string | null> {
  try {
    return await loadTempRegistrationPassword(email);
  } catch {
    return null;
  }
}

export const BiometricSetupScreen = () => {
  useScreenTransition('BiometricSetupScreen');
  const { navigateToNextStep } = useOnboardingNavigation();
  const user = useUser();
  const setUserNavigationState = useAppStore(
    state => state.setUserNavigationState,
  );
  const registrationPassword = useAppStore(state => state.registrationPassword);
  const clearRegistrationPassword = useAppStore(
    state => state.clearRegistrationPassword,
  );
  const { markBiometricDeclined, markBiometricEnabled } = useUserPreferences();
  const { show: showPasswordModal, TextModalComponent } = useTextInputModal();
  const [biometricInfo, setBiometricInfo] = useState<{
    isAvailable: boolean;
    biometryType: string | null;
  }>({ isAvailable: false, biometryType: null });
  const [isEnabling, setIsEnabling] = useState(false);
  const [hasCheckedBiometric, setHasCheckedBiometric] = useState(false);

  useEffect(() => {
    loadBiometricInfoSafe(setBiometricInfo, setHasCheckedBiometric);
  }, []);

  // Handle completion
  const handleComplete = (biometricEnabled: boolean) => {
    // Clear registration password since onboarding is complete
    clearRegistrationPassword();
    clearTempRegistrationPassword(); // fire-and-forget keychain cleanup

    // Track biometric decision using preference hooks
    if (biometricEnabled) {
      markBiometricEnabled();
    } else {
      markBiometricDeclined();
    }

    // Track onboarding completion
    if (user?.id) {
      setUserNavigationState(user.id, {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: Date.now(),
        biometricSetupOffered: true,
        isNewUser: false, // Clear new user flag after onboarding completion
      });
    }

    // Navigate to OnboardingComplete screen
    navigateToNextStep('BiometricSetup');
  };

  // Auto-skip if biometric is not available
  useEffect(() => {
    if (hasCheckedBiometric && !biometricInfo.isAvailable) {
      // Inline handleComplete logic to avoid dependency on function that changes every render
      clearRegistrationPassword();
      clearTempRegistrationPassword();
      markBiometricDeclined();
      if (user?.id) {
        setUserNavigationState(user.id, {
          hasCompletedOnboarding: true,
          onboardingCompletedAt: Date.now(),
          biometricSetupOffered: true,
          isNewUser: false,
        });
      }
      navigateToNextStep('BiometricSetup');
    }
  }, [
    hasCheckedBiometric,
    biometricInfo.isAvailable,
    clearRegistrationPassword,
    markBiometricDeclined,
    user?.id,
    setUserNavigationState,
    navigateToNextStep,
  ]);

  const enableBiometricWithPassword = (email: string, password: string) => {
    executeWithLoadingState(
      async () => {
        const success = await authService.storeCredentials(email, password);
        if (success) {
          handleComplete(true);
        } else {
          alertService.alert(
            'Setup Failed',
            'Biometric setup failed. You can enable it later in Settings.',
            [{ text: 'OK', onPress: () => handleComplete(false) }],
          );
        }
      },
      setIsEnabling,
      error => {
        console.error('Error enabling biometric authentication:', error);
        alertService.alert(
          'Setup Failed',
          'Biometric setup failed. You can enable it later in Settings.',
          [{ text: 'OK', onPress: () => handleComplete(false) }],
        );
      },
    );
  };

  const handleEnableBiometric = async () => {
    if (isEnabling) return;

    if (!user?.email) {
      // Edge case: no email means auth state is broken, skip biometric
      handleComplete(false);
      return;
    }

    if (!registrationPassword) {
      // Password lost from memory (app restart) — try loading from keychain first
      const keychainPassword = await tryLoadTempPassword(user.email);
      if (keychainPassword) {
        await enableBiometricWithPassword(user.email, keychainPassword);
        return;
      }

      // Keychain didn't have it either — ask the user to re-enter
      showPasswordModal({
        title: 'Re-Enter Your Password',
        placeholder: 'Password',
        submitText: 'Enable',
        textInputProps: { secureTextEntry: true, autoCapitalize: 'none' },
        onSubmit: async (password: string) => {
          await enableBiometricWithPassword(user.email, password);
        },
      });
      return;
    }

    await enableBiometricWithPassword(user.email, registrationPassword);
  };

  const handleSkip = () => {
    handleComplete(false);
  };

  // Don't render anything while checking biometric availability
  if (!hasCheckedBiometric) {
    return (
      <OnBoardingWrapper
        title="Setting up security"
        subtitle="Checking device capabilities"
        step={7}
        totalSteps={7}
      >
        <View style={styles.loadingContainer}>
          <Text size="md" tone="secondary" align="center">
            Checking biometric availability...
          </Text>
        </View>
      </OnBoardingWrapper>
    );
  }

  // If biometric is not available, the useEffect will auto-skip
  if (!biometricInfo.isAvailable) {
    return null;
  }

  const getBiometricIcon = () => {
    switch (biometricInfo.biometryType) {
      case 'Face ID':
        return 'scan-outline';
      case 'Touch ID':
      case 'Fingerprint':
        return 'finger-print';
      default:
        return 'finger-print';
    }
  };

  const getBiometricTitle = () => {
    return `Enable ${biometricInfo.biometryType || 'Biometric'} Login`;
  };

  const getBiometricDescription = () => {
    const authType = biometricInfo.biometryType || 'biometric authentication';
    return `Secure your pantry and shopping data with ${authType}. You can quickly log in without entering your password each time.`;
  };

  return (
    <>
      <OnBoardingWrapper
        title={getBiometricTitle()}
        subtitle="Secure your account"
        step={7}
        totalSteps={7}
        testID="biometric-setup-screen"
      >
        <View style={styles.container} testID="biometric-setup-container">
          <View style={styles.iconContainer}>
            <View style={styles.iconBackground}>
              <Icon name={getBiometricIcon()} size={48} tone="primary" />
            </View>
          </View>

          <Text
            size="md"
            tone="secondary"
            align="center"
            style={styles.description}
          >
            {getBiometricDescription()}
          </Text>

          <View style={styles.benefits}>
            <View style={styles.benefitItem}>
              <Icon name="checkmark-circle" size={20} tone="success" />
              <Text size="md" style={styles.benefitText}>
                Quick and secure access
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="checkmark-circle" size={20} tone="success" />
              <Text size="md" style={styles.benefitText}>
                No password required
              </Text>
            </View>
            <View style={styles.benefitItem}>
              <Icon name="checkmark-circle" size={20} tone="success" />
              <Text size="md" style={styles.benefitText}>
                Enhanced security
              </Text>
            </View>
          </View>

          <View style={styles.buttons}>
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleEnableBiometric}
              disabled={isEnabling}
              testID="biometric-setup-enable"
            >
              <Text
                size="md"
                weight="semibold"
                style={styles.primaryButtonText}
              >
                {isEnabling ? 'Setting up...' : 'Enable Now'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleSkip}
              disabled={isEnabling}
              testID="biometric-setup-skip"
            >
              <Text size="md" weight="semibold" tone="secondary">
                Set up later
              </Text>
            </Pressable>
          </View>

          <Text size="sm" tone="secondary" align="center">
            You can always enable this later in Settings
          </Text>
        </View>
      </OnBoardingWrapper>
      {TextModalComponent}
    </>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  description: {
    lineHeight: theme.fonts.size.md * 1.5,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  benefits: {
    alignSelf: 'stretch',
    marginBottom: theme.spacing.xl,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  benefitText: {
    flex: 1,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  primaryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.md,
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primaryButtonText: {
    color: theme.colors.background,
  },
}));
