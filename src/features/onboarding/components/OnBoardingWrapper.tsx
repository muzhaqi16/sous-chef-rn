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
  onboardingProgress,
  useOnboardingStepContext,
} from '#features/onboarding/screens/useOnboardingNavigation';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

interface OnboardingWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  /** The step's main button: in the footer, so it stays above the keyboard. */
  primaryAction?: ReactNode;
  testID?: string;
}

export const OnBoardingWrapper = ({
  children,
  title,
  subtitle,
  onBack,
  onSkip,
  primaryAction,
  testID,
}: OnboardingWrapperProps) => {
  const { t } = useTranslation();
  // Read off the route, so the flow's one sequence answers both numbers. A
  // screen stating its own position is a second definition, and it is the one
  // that goes stale when a step is added or removed.
  const route = useRoute();
  const progress = onboardingProgress(route.name, useOnboardingStepContext());
  const progressLabel = progress
    ? t('onboarding.progress', { step: progress.step, total: progress.total })
    : null;

  const hasNavigation = !!onSkip || progress != null;
  const hasFooter = !!primaryAction || hasNavigation;

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
          <View style={styles.footer} testID={onboardingTestIDs.footer}>
            {primaryAction}
            {hasNavigation ? (
              <View style={styles.bottomNavigation}>
                {progress && progressLabel ? (
                  <>
                    {/* The bar carries the same words for a screen reader. */}
                    <Text
                      role="caption"
                      tone="secondary"
                      importantForAccessibility="no-hide-descendants"
                      accessibilityElementsHidden
                      testID={onboardingTestIDs.stepNumber}
                    >
                      {progressLabel}
                    </Text>
                    <ProgressBar
                      value={progress.step / progress.total}
                      style={styles.progressBar}
                      accessibilityLabel={progressLabel}
                    />
                  </>
                ) : null}
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
              </View>
            ) : null}
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
  footer: {
    gap: theme.spacing.md,
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
  // Top-aligned, so a step's choices sit under its question and stay put
  // when a choice reveals more; a child that wants the centre takes `flex: 1`.
  content: {
    flexGrow: 1,
    paddingTop: theme.spacing.md,
  },
}));
