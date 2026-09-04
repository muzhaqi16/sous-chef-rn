import { BackButton } from '#components/atoms/BackButton';
import { useTranslation } from '#/i18n';
import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { ThemedKeyboardAwareScrollView } from '#components/atoms/themedComponents';
import { ThemedSafeAreaView } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { OnboardingSteps } from '#features/onboarding/components/OnboardingSteps/OnboardingSteps';
import { OnboardingNavigation } from '#features/onboarding/components/OnboardingNavigation/OnboardingNavigation';
import { useOnboardingContextSafe } from '#features/onboarding/context/OnboardingContext';
import type { NavigationAction } from '#features/onboarding/components/OnboardingNavigation/types';
import { AppPressable } from '#components/atoms/AppPressable';
import { ProgressBar } from '#components/atoms/ProgressBar';

const ThemedOnboardingNavigation = withUnistyles(OnboardingNavigation);

interface OnboardingWrapperProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  // Legacy props - deprecated but kept for backward compatibility
  step?: number;
  totalSteps?: number;
  onBack?: () => void;
  onSkip?: () => void;
  // New props for enhanced navigation
  showSteps?: boolean;
  showNavigation?: boolean;
  continueAction?: NavigationAction;
  skipAction?: NavigationAction;
  allowStepNavigation?: boolean;
  testID?: string;
}

export const OnBoardingWrapper = ({
  children,
  title,
  subtitle,
  step,
  totalSteps,
  onBack,
  onSkip,
  showSteps = true,
  showNavigation = true,
  continueAction,
  skipAction,
  allowStepNavigation = false,
  testID,
}: OnboardingWrapperProps) => {
  const { t } = useTranslation();
  const progress = step && totalSteps ? (step / totalSteps) * 100 : 0;

  // Always call the hook, but handle if context is not provided
  const onboardingContext = useOnboardingContextSafe();

  const isLegacyMode = !onboardingContext;
  // The step table is module-level, so it carries key paths and the title is
  // resolved here where the hook lives.
  const stepTitleKey = onboardingContext?.currentStep?.titleKey;
  const stepSubtitleKey = onboardingContext?.currentStep?.subtitleKey;
  const displayTitle = title || (stepTitleKey ? t(stepTitleKey) : undefined);
  const displaySubtitle =
    subtitle || (stepSubtitleKey ? t(stepSubtitleKey) : undefined);

  return (
    <ThemedSafeAreaView style={styles.safeArea} testID={testID}>
      <View style={styles.headerContainer}>
        {onBack ? (
          <BackButton
            tone="primary"
            onPress={onBack}
            style={styles.iconButton}
            testID={testID ? `${testID}-back-button` : undefined}
          />
        ) : (
          <View style={styles.iconButton} />
        )}
        {!!displayTitle && (
          <Text role="bodyStrong" style={styles.headerTitle}>
            {displayTitle}
          </Text>
        )}
        <View style={styles.iconButton} />
      </View>
      {/* Animated Step Indicator */}
      {!!showSteps && !isLegacyMode && !!onboardingContext && (
        <View style={styles.stepsContainer}>
          <OnboardingSteps
            steps={onboardingContext.steps}
            activeIndex={onboardingContext.activeStepIndex}
            stepSize={12}
            onStepPress={
              allowStepNavigation ? onboardingContext.goToStep : undefined
            }
            allowStepNavigation={allowStepNavigation}
          />
        </View>
      )}
      <ThemedKeyboardAwareScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {!!displaySubtitle && (
          <Text role="bodyStrong" style={styles.subtitle}>
            {displaySubtitle}
          </Text>
        )}
        <View style={styles.content}>{children}</View>
      </ThemedKeyboardAwareScrollView>
      {/* Enhanced Navigation or Legacy Bottom Navigation */}
      {showNavigation && !isLegacyMode && onboardingContext ? (
        <ThemedOnboardingNavigation
          showBackButton={onboardingContext.canGoBack}
          showContinueButton={
            onboardingContext.canGoNext || onboardingContext.isLastStep
          }
          showSkipButton={!!skipAction}
          uniProps={theme => ({
            backAction: {
              label: t('labels.back'),
              onPress: onboardingContext.goToPreviousStep,
              backgroundColor: theme.colors.surface,
              labelColor: theme.colors.textPrimary,
            },
            continueAction: continueAction || {
              label: t('labels.continue'),
              onPress: onboardingContext.goToNextStep,
              backgroundColor: theme.colors.primary,
              labelColor: theme.colors.background,
            },
          })}
          skipAction={skipAction}
          isLastStep={onboardingContext.isLastStep}
        />
      ) : (
        <View style={styles.bottomNavigation}>
          {!!onSkip && (
            <AppPressable
              onPress={onSkip}
              style={styles.skipButton}
              testID={testID ? `${testID}-skip-button` : undefined}
            >
              <Text role="bodyStrong" style={styles.skipText}>
                {t('labels.skip')}
              </Text>
            </AppPressable>
          )}
          {step != null && totalSteps != null && (
            <ProgressBar
              value={progress / 100}
              style={styles.progressBar}
              accessibilityLabel={t('onboarding.progress', {
                step,
                total: totalSteps,
              })}
            />
          )}
        </View>
      )}
    </ThemedSafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  headerTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  stepsContainer: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },

  iconButton: {
    width: theme.sizes.button.md,
    height: theme.sizes.button.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    marginLeft: 'auto',
    padding: theme.spacing.sm,
  },
  skipText: {
    color: theme.colors.textSecondary,
  },
  progressBar: {
    flex: 1,
    marginHorizontal: theme.spacing.md,
  },
  scrollContainer: {
    // flexGrow without flex so short screens still fill the viewport while
    // taller ones (or ones pushed up by the keyboard) can actually scroll.
    flexGrow: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  bottomNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-around',
  },
}));
