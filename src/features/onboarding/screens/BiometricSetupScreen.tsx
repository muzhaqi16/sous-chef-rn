import React, { useState, useEffect } from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';
import { useAuthPreferences } from '#hooks/navigation/useAuthPreferences';
import { useAppStore, useUser } from '#store/useAppStore';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import {
  loadTempRegistrationPassword,
  clearTempRegistrationPassword,
} from '#/storage/keychain';
import { Text } from '#components/atoms/Text';
import { BiometricSetupView } from '#components/organisms/biometric/BiometricSetupView';
import { useBiometricSetup } from '#components/organisms/biometric/useBiometricSetup';

/** Module scope so the try/catch stays out of the component (compiler bailout). */
async function tryLoadTempPassword(email: string): Promise<string | null> {
  try {
    return await loadTempRegistrationPassword(email);
  } catch {
    return null;
  }
}

/**
 * Onboarding's biometric step. The card and logic are the shared
 * `BiometricSetupView` + `useBiometricSetup`; this shell owns only where the
 * password comes from and advancing the flow.
 */
export const BiometricSetupScreen = () => {
  const { t } = useTranslation();
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
  const { markBiometricDeclined, markBiometricEnabled } = useAuthPreferences();

  // Recovers the password from the keychain after a restart mid-onboarding; with
  // neither source the shared card falls back to an inline field.
  const [keychainPassword, setKeychainPassword] = useState<string | null>(null);
  useEffect(() => {
    if (registrationPassword || !user?.email) return;
    tryLoadTempPassword(user.email).then(setKeychainPassword);
  }, [registrationPassword, user?.email]);
  const presetPassword = registrationPassword ?? keychainPassword ?? undefined;

  const handleComplete = (biometricEnabled: boolean) => {
    clearRegistrationPassword();
    clearTempRegistrationPassword(); // fire-and-forget keychain cleanup

    if (biometricEnabled) {
      markBiometricEnabled();
    } else {
      markBiometricDeclined();
    }

    if (user?.id) {
      setUserNavigationState(user.id, {
        hasCompletedOnboarding: true,
        onboardingCompletedAt: Date.now(),
        biometricSetupOffered: true,
        isNewUser: false,
      });
    }

    navigateToNextStep('BiometricSetup');
  };

  const bio = useBiometricSetup({
    mode: 'onboarding',
    userEmail: user?.email ?? '',
    presetPassword,
    onComplete: handleComplete,
  });

  if (bio.checking) {
    return (
      <OnBoardingWrapper
        subtitle={t('onBoarding.settingUpSecurity')}
        step={7}
        totalSteps={7}
      >
        <View style={styles.loadingContainer}>
          <Text size="md" tone="secondary" align="center">
            {t('onBoarding.checkingBiometricAvailability')}
          </Text>
        </View>
      </OnBoardingWrapper>
    );
  }

  if (!bio.available) return null;

  return (
    <OnBoardingWrapper
      subtitle={t('onBoarding.secureYourAccount')}
      step={7}
      totalSteps={7}
      testID="biometric-setup-screen"
    >
      <View style={styles.container}>
        <BiometricSetupView
          iconName={bio.iconName}
          title={bio.title}
          description={bio.description}
          benefits={bio.benefits}
          footer={bio.footer}
          needsPassword={bio.needsPassword}
          password={bio.password}
          onPasswordChange={bio.setPassword}
          passwordLabel={bio.passwordLabel}
          passwordPlaceholder={bio.passwordPlaceholder}
          isEnabling={bio.isEnabling}
          enableLabel={bio.enableLabel}
          skipLabel={bio.skipLabel}
          onEnable={bio.handleEnable}
          onSkip={bio.handleSkip}
          testID="biometric-setup"
        />
      </View>
    </OnBoardingWrapper>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
