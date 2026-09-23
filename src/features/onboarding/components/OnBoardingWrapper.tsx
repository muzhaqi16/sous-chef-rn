import { useTranslation } from '#/i18n';
import type { ReactNode } from 'react';
import React from 'react';
import { View } from 'react-native';
import { Screen } from '#components/templates/Screen';
import { Text } from '#components/atoms/Text';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { ProgressBar } from '#components/atoms/ProgressBar';
import { useRoute } from '@react-navigation/native';
import {
  ONBOARDING_STEPS,
  onboardingStepIndex,
} from '#features/onboarding/hooks/useOnboardingNavigation';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

interface OnboardingWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  testID?: string;
}

export const OnBoardingWrapper = ({
  children,
  title,
  subtitle,
  onBack,
  onSkip,
  testID,
}: OnboardingWrapperProps) => {
  const { t } = useTranslation();
  // Read off the route, so the flow's one sequence answers both numbers. A
  // screen stating its own position is a second definition, and it is the one
  // that goes stale when a step is added or removed.
  const route = useRoute();
  const stepIndex = onboardingStepIndex(route.name);
  const step = stepIndex >= 0 ? stepIndex + 1 : null;
  const totalSteps = ONBOARDING_STEPS.length;

  const hasFooter = !!onSkip || step != null;

  return (
    <Screen
      scroll="form"
      testID={testID}
      header={
        title || onBack
          ? { title: title ?? '', back: onBack }
          : { variant: 'none' }
      }
      footer={
        hasFooter ? (
          <View style={styles.bottomNavigation}>
            {!!onSkip && (
              <AppPressable
                onPress={onSkip}
                style={styles.skipButton}
                testID={
                  testID ? onboardingTestIDs.skipButton(testID) : undefined
                }
              >
                <Text role="bodyStrong" style={styles.skipText}>
                  {t('labels.skip')}
                </Text>
              </AppPressable>
            )}
            {step != null && (
              <ProgressBar
                value={step / totalSteps}
                style={styles.progressBar}
                accessibilityLabel={t('onboarding.progress', {
                  step,
                  total: totalSteps,
                })}
              />
            )}
          </View>
        ) : undefined
      }
    >
      {!!subtitle && (
        <Text role="bodyStrong" style={styles.subtitle}>
          {subtitle}
        </Text>
      )}
      <View style={styles.content}>{children}</View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  skipButton: {
    marginLeft: 'auto',
    padding: theme.spacing.sm,
  },
  skipText: {
    color: theme.colors.textSecondary,
  },
  progressBar: {
    flex: 1,
  },
  bottomNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-around',
    paddingTop: theme.spacing.md,
  },
}));
