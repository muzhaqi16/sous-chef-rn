import { BackButton } from '#components/atoms/BackButton';
import { useTranslation } from 'react-i18next';
import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { ThemedSafeAreaView } from '#components/atoms/themedComponents';
import { Text } from '#components/atoms/Text';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { OnboardingSteps } from '#components/navigation/OnboardingSteps/OnboardingSteps';
import { OnboardingNavigation } from '#components/navigation/OnboardingNavigation/OnboardingNavigation';
import { useOnboardingContextSafe } from '#/context/OnboardingContext';
import type { NavigationAction } from '#components/navigation/OnboardingNavigation/types';
import { AppPressable } from '#components/atoms/AppPressable';

const ThemedBackButton = withUnistyles(BackButton, theme => ({
  color: theme.colors.primary,
}));

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
          <ThemedBackButton
            onPress={onBack}
            style={styles.iconButton}
            testID={testID ? `${testID}-back-button` : undefined}
          />
        ) : (
          <View style={styles.iconButton} />
        )}
        {!!displayTitle && (
          <Text style={styles.headerTitle}>{displayTitle}</Text>
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
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContainer}
        bottomOffset={16}
        keyboardShouldPersistTaps="handled"
      >
        {!!displaySubtitle && (
          <Text style={styles.subtitle}>{displaySubtitle}</Text>
        )}
        <View style={styles.content}>{children}</View>
      </KeyboardAwareScrollView>
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
              <Text style={styles.skipText}>{t('labels.skip')}</Text>
            </AppPressable>
          )}
          {step != null && totalSteps != null && (
            <View style={styles.progressBarBackground}>
              <View
                style={[styles.progressBarFill, { width: `${progress}%` }]}
              />
            </View>
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
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.fonts.weight.bold,
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
    fontWeight: theme.fonts.weight.medium,
  },
  progressBarBackground: {
    flex: 1,
    height: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xs,
    borderCurve: 'continuous',
    marginHorizontal: theme.spacing.md,
  },
  progressBarFill: {
    height: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.xs,
    borderCurve: 'continuous',
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
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'space-around',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
