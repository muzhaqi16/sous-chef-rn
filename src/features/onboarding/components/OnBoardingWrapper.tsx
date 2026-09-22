import { BackButton } from '#components/atoms/BackButton';
import { useTranslation } from '#/i18n';
import type { ReactNode } from 'react';
import React from 'react';
import { View } from 'react-native';
import { ThemedKeyboardAwareScrollView } from '#components/atoms/themedComponents';
import { ThemedSafeAreaView } from '#components/atoms/themedComponents';
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

  return (
    <ThemedSafeAreaView style={styles.safeArea} testID={testID}>
      <View style={styles.headerContainer}>
        {onBack ? (
          <BackButton
            tone="primary"
            onPress={onBack}
            style={styles.iconButton}
            testID={testID ? onboardingTestIDs.backButton(testID) : undefined}
          />
        ) : (
          <View style={styles.iconButton} />
        )}
        {!!title && (
          <Text role="bodyStrong" style={styles.headerTitle}>
            {title}
          </Text>
        )}
        <View style={styles.iconButton} />
      </View>
      <ThemedKeyboardAwareScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {!!subtitle && (
          <Text role="bodyStrong" style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
        <View style={styles.content}>{children}</View>
      </ThemedKeyboardAwareScrollView>
      <View style={styles.bottomNavigation}>
        {!!onSkip && (
          <AppPressable
            onPress={onSkip}
            style={styles.skipButton}
            testID={testID ? onboardingTestIDs.skipButton(testID) : undefined}
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
