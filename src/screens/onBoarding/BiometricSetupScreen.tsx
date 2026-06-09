import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { OnBoardingWrapper } from '#components/templates/OnBoardingWrapper';
import { useOnboardingNavigation } from '#hooks/navigation/useOnboardingNavigation';
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

/** Module-level helper that loads a temp registration password from the
 *  keychain. Returns null on failure. Kept at module scope so the try/catch
 *  stays out of the component (React Compiler bailout — see CLAUDE.md). */
async function tryLoadTempPassword(email: string): Promise<string | null> {
  try {
    return await loadTempRegistrationPassword(email);
  } catch {
    return null;
  }
}

/**
 * Onboarding biometric enrollment step (final step before OnboardingComplete).
 * Renders the shared `BiometricSetupView` via `useBiometricSetup` — identical
 * card + logic as the post-login gate and the settings modal. This shell only
 * owns onboarding concerns: where the password comes from (registration
 * password → keychain → inline field), the completion side-effects, and
 * advancing the onboarding flow.
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

  // Recover the password from the keychain if it was lost from memory (app
  // restart mid-onboarding). If neither source has it, the shared card falls
  // back to an inline password field.
  const [keychainPassword, setKeychainPassword] = useState<string | null>(null);
  useEffect(() => {
    if (registrationPassword || !user?.email) return;
    tryLoadTempPassword(user.email).then(setKeychainPassword);
  }, [registrationPassword, user?.email]);
  const presetPassword = registrationPassword ?? keychainPassword ?? undefined;

  const handleComplete = (biometricEnabled: boolean) => {
    // Onboarding is finishing — clear the transient registration password.
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

  // Still probing device capability.
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

  // Unavailable → `useBiometricSetup` already advanced the flow via onComplete.
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
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
