import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { OnBoardingWrapper } from '#components/templates';
import { Icon } from '#utils';
import { useAuth } from '#hooks';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
import { useUserPreferences } from '#hooks/navigation/useUserPreferences';
import { useAppStore, selectUser } from '#store/useAppStore';

export const BiometricSetupScreen = () => {
  const { navigateToNextStep } = useOnboardingNavigation();
  const user = useAppStore(selectUser);
  const setUserNavigationState = useAppStore(state => state.setUserNavigationState);
  const {
    registrationPassword,
    clearRegistrationPassword,
    getBiometricInfo,
    storeCredentials,
  } = useAuth();
  const { markBiometricDeclined, markBiometricEnabled } = useUserPreferences();
  const [biometricInfo, setBiometricInfo] = useState<{
    isAvailable: boolean;
    biometryType: string | null;
  }>({ isAvailable: false, biometryType: null });
  const [isEnabling, setIsEnabling] = useState(false);
  const [hasCheckedBiometric, setHasCheckedBiometric] = useState(false);

  const loadBiometricInfo = useCallback(async () => {
    try {
      const info = await getBiometricInfo();
      setBiometricInfo(info);
      setHasCheckedBiometric(true);
    } catch (error) {
      console.error('Error loading biometric info:', error);
      setBiometricInfo({ isAvailable: false, biometryType: null });
      setHasCheckedBiometric(true);
    }
  }, [getBiometricInfo]);

  useEffect(() => {
    loadBiometricInfo();
  }, [loadBiometricInfo]);

  // Handle completion with proper useCallback to prevent re-renders
  const handleComplete = useCallback(
    (biometricEnabled: boolean) => {
      // Clear registration password since onboarding is complete
      clearRegistrationPassword();

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
    },
    [
      clearRegistrationPassword,
      markBiometricEnabled,
      markBiometricDeclined,
      user?.id,
      setUserNavigationState,
      navigateToNextStep,
    ],
  );

  // Auto-skip if biometric is not available
  useEffect(() => {
    if (hasCheckedBiometric && !biometricInfo.isAvailable) {
      handleComplete(false);
    }
  }, [hasCheckedBiometric, biometricInfo.isAvailable, handleComplete]);

  const handleEnableBiometric = async () => {
    if (isEnabling || !registrationPassword || !user?.email) return;

    try {
      setIsEnabling(true);

      // Store credentials with biometric protection
      const success = await storeCredentials(user.email, registrationPassword);

      if (success) {
        handleComplete(true);
      } else {
        Alert.alert(
          'Setup Failed',
          'Biometric setup failed. You can enable it later in Settings.',
          [{ text: 'OK', onPress: () => handleComplete(false) }],
        );
      }
    } catch (error) {
      console.error('Error enabling biometric authentication:', error);
      Alert.alert(
        'Setup Failed',
        'Biometric setup failed. You can enable it later in Settings.',
        [{ text: 'OK', onPress: () => handleComplete(false) }],
      );
    } finally {
      setIsEnabling(false);
    }
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
          <Text style={styles.loadingText}>
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
        return 'face-recognition';
      case 'Touch ID':
      case 'Fingerprint':
        return 'fingerprint';
      default:
        return 'fingerprint';
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
    <OnBoardingWrapper
      title={getBiometricTitle()}
      subtitle="Secure your account"
      step={7}
      totalSteps={7}
    >
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <View style={styles.iconBackground}>
            <Icon name={getBiometricIcon()} size={48} color="#007AFF" />
          </View>
        </View>

        <Text style={styles.description}>{getBiometricDescription()}</Text>

        <View style={styles.benefits}>
          <View style={styles.benefitItem}>
            <Icon name="check-circle" size={20} color="#34D399" />
            <Text style={styles.benefitText}>Quick and secure access</Text>
          </View>
          <View style={styles.benefitItem}>
            <Icon name="check-circle" size={20} color="#34D399" />
            <Text style={styles.benefitText}>No password required</Text>
          </View>
          <View style={styles.benefitItem}>
            <Icon name="check-circle" size={20} color="#34D399" />
            <Text style={styles.benefitText}>Enhanced security</Text>
          </View>
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity
            style={[styles.button, styles.primaryButton]}
            onPress={handleEnableBiometric}
            disabled={isEnabling}
          >
            <Text style={[styles.buttonText, styles.primaryButtonText]}>
              {isEnabling ? 'Setting up...' : 'Enable Now'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleSkip}
            disabled={isEnabling}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Set up later
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          You can always enable this later in Settings
        </Text>
      </View>
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  description: {
    fontSize: theme.fonts.size.md,
    color: theme.colors.textSecondary,
    textAlign: 'center',
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
    fontSize: theme.fonts.size.md,
    color: theme.colors.textPrimary,
    flex: 1,
  },
  buttons: {
    alignSelf: 'stretch',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  buttonText: {
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
  primaryButtonText: {
    color: theme.colors.background,
  },
  secondaryButtonText: {
    color: theme.colors.textSecondary,
  },
  footer: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
}));
