import { BackButton } from '#components/atoms/BackButton';
import React, { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, View, ScrollView } from 'react-native';
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
  const progress = step && totalSteps ? (step / totalSteps) * 100 : 0;

  // Always call the hook, but handle if context is not provided
  const onboardingContext = useOnboardingContextSafe();

  const isLegacyMode = !onboardingContext;
  const displayTitle = title || onboardingContext?.currentStep?.title;
  const displaySubtitle = subtitle || onboardingContext?.currentStep?.subtitle;

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
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
        >
          {!!displaySubtitle && (
            <Text style={styles.subtitle}>{displaySubtitle}</Text>
          )}
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Enhanced Navigation or Legacy Bottom Navigation */}
      {showNavigation && !isLegacyMode && onboardingContext ? (
        <ThemedOnboardingNavigation
          showBackButton={onboardingContext.canGoBack}
          showContinueButton={
            onboardingContext.canGoNext || onboardingContext.isLastStep
          }
          showSkipButton={!!skipAction}
          uniProps={t => ({
            backAction: {
              label: 'Back',
              onPress: onboardingContext.goToPreviousStep,
              backgroundColor: t.colors.surface,
              labelColor: t.colors.textPrimary,
            },
            continueAction: continueAction || {
              label: 'Continue',
              onPress: onboardingContext.goToNextStep,
              backgroundColor: t.colors.primary,
              labelColor: t.colors.background,
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
              <Text style={styles.skipText}>Skip</Text>
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
    marginHorizontal: theme.spacing.md,
  },
  progressBarFill: {
    height: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.xs,
  },
  keyboardAvoid: {
    flex: 1,
    flexDirection: 'column',
  },
  scrollContainer: {
    flexGrow: 1,
    flex: 1,
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
    flex: 1,
    justifyContent: 'space-around',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
