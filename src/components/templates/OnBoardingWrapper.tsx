import { Icon } from '#/utils';
import React, { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { OnboardingSteps } from '#components/navigation/OnboardingSteps';
import { OnboardingNavigation } from '#components/navigation/OnboardingNavigation';
import { useOnboardingContextSafe } from '#context';
import type { NavigationAction } from '#components/navigation/OnboardingNavigation/types';

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
  const { theme } = useUnistyles();
  const progress = step && totalSteps ? (step / totalSteps) * 100 : 0;

  // Always call the hook, but handle if context is not provided
  const onboardingContext = useOnboardingContextSafe();

  const isLegacyMode = !onboardingContext;
  const displayTitle = title || onboardingContext?.currentStep?.title;
  const displaySubtitle = subtitle || onboardingContext?.currentStep?.subtitle;

  return (
    <SafeAreaView style={styles.safeArea} testID={testID}>
      <View style={styles.headerContainer}>
        {onBack && (
          <TouchableOpacity onPress={onBack} style={styles.iconButton} testID={testID ? `${testID}-back-button` : undefined}>
            <Icon
              library="Feather"
              name="arrow-left"
              size={24}
              color={theme.colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Animated Step Indicator */}
      {showSteps && !isLegacyMode && onboardingContext && (
        <View style={styles.stepsContainer}>
          <OnboardingSteps
            steps={onboardingContext.steps}
            activeIndex={onboardingContext.activeStepIndex}
            stepSize={12}
            onStepPress={allowStepNavigation ? onboardingContext.goToStep : undefined}
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
          {displayTitle && <Text style={styles.title}>{displayTitle}</Text>}
          {displaySubtitle && <Text style={styles.subtitle}>{displaySubtitle}</Text>}
          <View style={styles.content}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
      {/* Enhanced Navigation or Legacy Bottom Navigation */}
      {showNavigation && !isLegacyMode && onboardingContext ? (
        <OnboardingNavigation
          showBackButton={onboardingContext.canGoBack}
          showContinueButton={onboardingContext.canGoNext || onboardingContext.isLastStep}
          showSkipButton={!!skipAction}
          backAction={{
            label: 'Back',
            onPress: onboardingContext.goToPreviousStep,
            backgroundColor: theme.colors.surface,
            labelColor: theme.colors.textPrimary,
          }}
          continueAction={continueAction || {
            label: 'Continue',
            onPress: onboardingContext.goToNextStep,
            backgroundColor: theme.colors.primary,
            labelColor: theme.colors.background,
          }}
          skipAction={skipAction}
          isLastStep={onboardingContext.isLastStep}
        />
      ) : (
        <View style={styles.bottomNavigation}>
          {onSkip && (
            <TouchableOpacity onPress={onSkip} style={styles.skipButton} testID={testID ? `${testID}-skip-button` : undefined}>
              <Text style={styles.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
          {step != null && totalSteps != null && (
            <View style={styles.progressBarBackground}>
              <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create(theme => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  headerContainer: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    paddingHorizontal: 24,
  },
  stepsContainer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },

  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  skipButton: {
    marginLeft: 'auto',
    padding: 8,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  progressBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: 2,
    marginHorizontal: 16,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  keyboardAvoid: {
    flex: 1,
    flexDirection: 'column',
  },
  scrollContainer: {
    flexGrow: 1,
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  bottomNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'space-around',
  },
}));
