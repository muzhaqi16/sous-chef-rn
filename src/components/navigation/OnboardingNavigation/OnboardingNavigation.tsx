import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  withTiming,
  LinearTransition,
} from 'react-native-reanimated';
import { TIMING } from '#constants/animations';
import { NavigationButton } from './NavigationButton';
import type { OnboardingNavigationProps } from './types';

const ButtonHeight = 60;
const LAYOUT_TRANSITION = LinearTransition.duration(TIMING.MODERATE);

export const OnboardingNavigation: React.FC<OnboardingNavigationProps> = ({
  showBackButton,
  showContinueButton,
  showSkipButton = false,
  backAction,
  continueAction,
  skipAction,
  isLastStep = false,
}) => {
  // GPU-composited opacity animation (no width/marginLeft layout recalc)
  const backButtonStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(showBackButton ? 1 : 0, {
        duration: TIMING.STANDARD,
      }),
    };
  }, [showBackButton]);

  return (
    <View style={styles.container}>
      {/* Skip button (if shown) */}
      {!!showSkipButton && !!skipAction && (
        <View style={styles.skipContainer}>
          <NavigationButton
            action={skipAction}
            style={styles.skipButton}
            textStyle={styles.skipText}
          />
        </View>
      )}

      {/* Main navigation buttons — LinearTransition handles reflow when back button appears/disappears */}
      <Animated.View
        style={styles.navigationContainer}
        layout={LAYOUT_TRANSITION}
      >
        {/* Back button */}
        {!!showBackButton && !!backAction && (
          <Animated.View
            style={[styles.backButtonContainer, backButtonStyle]}
            layout={LAYOUT_TRANSITION}
          >
            <NavigationButton
              action={backAction}
              style={styles.backButton}
              textStyle={styles.backText}
            />
          </Animated.View>
        )}

        {/* Continue/Finish button */}
        {!!showContinueButton && (
          <Animated.View
            style={styles.continueButtonContainer}
            layout={LAYOUT_TRANSITION}
          >
            <NavigationButton
              action={{
                ...continueAction,
                label: isLastStep ? 'Finish' : continueAction.label,
              }}
              style={styles.continueButton}
              textStyle={styles.continueText}
            />
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  skipContainer: {
    alignItems: 'flex-end',
    marginBottom: theme.spacing['3'],
  },
  skipButton: {
    backgroundColor: 'transparent',
    height: 40,
    paddingHorizontal: theme.spacing.md,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.fonts.weight.medium,
  },
  navigationContainer: {
    flexDirection: 'row',
    height: ButtonHeight,
    gap: 10,
  },
  backButtonContainer: {
    flex: 0.54, // 35% / 65% ≈ 0.54 ratio
  },
  continueButtonContainer: {
    flex: 1,
  },
  backButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backText: {
    color: theme.colors.textPrimary,
  },
  continueButton: {
    backgroundColor: theme.colors.primary,
  },
  continueText: {
    color: theme.colors.background,
    fontWeight: theme.fonts.weight.bold,
  },
}));
