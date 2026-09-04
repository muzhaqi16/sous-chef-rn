import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { OnBoardingWrapper } from '#features/onboarding/components/OnBoardingWrapper';
import { useOnboardingNavigation } from '#features/onboarding/hooks/useOnboardingNavigation';
import { useAuthPreferences } from '#hooks/navigation/useAuthPreferences';
import { useAppStore, useUser } from '#store/useAppStore';
import { useScreenTransition } from '#hooks/performance/useScreenTransition';
import { Text } from '#components/atoms/Text';
import { BiometricSetupView } from '#components/organisms/biometric/BiometricSetupView';
import { useBiometricSetup } from '#components/organisms/biometric/useBiometricSetup';
import { commonStyles } from '#/styles/commonStyles';

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
  const { markBiometricDeclined, markBiometricEnabled } = useAuthPreferences();

  const handleComplete = (biometricEnabled: boolean) => {
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
    onComplete: handleComplete,
  });

  if (bio.checking) {
    return (
      <OnBoardingWrapper
        subtitle={t('onBoarding.settingUpSecurity')}
        step={7}
        totalSteps={8}
      >
        <View style={commonStyles.loadingContainer}>
          <Text tone="secondary" align="center">
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
      totalSteps={8}
      testID="biometric-setup-screen"
    >
      <View style={styles.container}>
        <BiometricSetupView
          iconName={bio.iconName}
          title={bio.title}
          description={bio.description}
          benefits={bio.benefits}
          footer={bio.footer}
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
}));
