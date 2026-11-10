import React, { type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from '#/i18n';
import { Screen } from '#components/templates/Screen';
import { Text } from '#components/atoms/Text';
import { ProgressBar } from '#components/atoms/ProgressBar';
import { Button } from '#components/molecules/Button';
import { motion } from '#/theme/motion';
import {
  onboardingProgress,
  useOnboardingStepContext,
} from '#features/onboarding/screens/useOnboardingNavigation';
import { onboardingTestIDs } from '#features/onboarding/testIDs';

/** A step's main button, described rather than built, so each looks the same. */
export interface StepPrimary {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: React.ComponentProps<typeof Button>['icon'];
  testID?: string;
}

interface OnboardingStepScaffoldProps {
  children: ReactNode;
  title?: string;
  /** The step's question, at the top of its content. */
  question?: string;
  onBack?: () => void;
  /** Skip sits in the header, away from the step's own button. */
  onSkip?: () => void;
  primary?: StepPrimary;
  testID?: string;
}

/** Layout-only: each block of a step arrives a beat after the one above it. */
const StepEntrance = ({
  index,
  grow = false,
  children,
}: {
  index: number;
  /** Fills its parent, so a child taking `flex: 1` still can. */
  grow?: boolean;
  children: ReactNode;
}) => (
  <Animated.View
    entering={FadeInDown.delay(index * motion.timing.INSTANT).duration(
      motion.timing.MODERATE,
    )}
    style={grow ? styles.grow : undefined}
  >
    {children}
  </Animated.View>
);

export const OnboardingStepScaffold = ({
  children,
  title,
  question,
  onBack,
  onSkip,
  primary,
  testID,
}: OnboardingStepScaffoldProps) => {
  const { t } = useTranslation();
  // Read off the route, so the flow's one sequence answers both numbers. A
  // screen stating its own position is a second definition, and it is the one
  // that goes stale when a step is added or removed.
  const route = useRoute();
  const progress = onboardingProgress(route.name, useOnboardingStepContext());
  const progressLabel = progress
    ? t('onboarding.progress', { step: progress.step, total: progress.total })
    : null;
  const hasFooter = !!primary || progress != null;

  return (
    <Screen
      scroll="form"
      testID={testID}
      header={
        title || onBack || onSkip
          ? {
              title: title ?? '',
              back: onBack,
              actions: onSkip
                ? [
                    {
                      label: t('labels.skip'),
                      onPress: onSkip,
                      variant: 'secondary',
                      testID: testID
                        ? onboardingTestIDs.skipButton(testID)
                        : undefined,
                    },
                  ]
                : undefined,
            }
          : { variant: 'none' }
      }
      footer={
        hasFooter ? (
          <View style={styles.footer} testID={onboardingTestIDs.footer}>
            {primary ? (
              <Button
                title={primary.label}
                onPress={primary.onPress}
                loading={primary.loading}
                disabled={primary.disabled}
                variant={primary.variant ?? 'primary'}
                icon={primary.icon}
                testID={primary.testID}
                fullWidth
              />
            ) : null}
            {progress && progressLabel ? (
              <View style={styles.progress}>
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
              </View>
            ) : null}
          </View>
        ) : undefined
      }
    >
      {question ? (
        <StepEntrance index={0}>
          <Text role="bodyStrong" tone="secondary" style={styles.question}>
            {question}
          </Text>
        </StepEntrance>
      ) : null}
      <View style={styles.content}>
        <StepEntrance index={question ? 1 : 0} grow>
          {children}
        </StepEntrance>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create(theme => ({
  footer: {
    gap: theme.spacing.md,
  },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  progressBar: {
    flex: 1,
  },
  question: {
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
  grow: {
    flexGrow: 1,
  },
}));
