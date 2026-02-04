import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { NavigationButton } from './NavigationButton';
import type { OnboardingNavigationProps } from './types';

const ButtonHeight = 60;

export const OnboardingNavigation: React.FC<OnboardingNavigationProps> = ({
  showBackButton,
  showContinueButton,
  showSkipButton = false,
  backAction,
  continueAction,
  skipAction,
  isLastStep = false,
}) => {
  const { width: windowWidth } = useWindowDimensions();

  const paddingHorizontal = 20;
  const gap = 10;

  // Calculate button widths based on what's shown
  const getButtonWidths = () => {
    const availableWidth = windowWidth - paddingHorizontal * 2;

    if (showBackButton && showContinueButton) {
      // Split layout: back button smaller, continue button larger
      const backWidth = availableWidth * 0.35;
      const continueWidth = availableWidth * 0.65 - gap;
      return { backWidth, continueWidth };
    } else {
      // Single button takes full width
      const fullWidth = availableWidth;
      return { backWidth: 0, continueWidth: fullWidth };
    }
  };

  const { backWidth, continueWidth } = getButtonWidths();

  const backButtonStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(showBackButton ? backWidth : 0, { duration: 250 }),
      opacity: withTiming(showBackButton ? 1 : 0, { duration: 200 }),
    };
  }, [showBackButton, backWidth]);

  const continueButtonStyle = useAnimatedStyle(() => {
    return {
      width: withTiming(continueWidth, { duration: 250 }),
      marginLeft: withTiming(showBackButton ? gap : 0, { duration: 250 }),
    };
  }, [showBackButton, continueWidth, gap]);

  return (
    <View style={styles.container}>
      {/* Skip button (if shown) */}
      {showSkipButton && skipAction && (
        <View style={styles.skipContainer}>
          <NavigationButton
            action={skipAction}
            style={styles.skipButton}
            textStyle={styles.skipText}
          />
        </View>
      )}

      {/* Main navigation buttons */}
      <View style={styles.navigationContainer}>
        {/* Back button */}
        {showBackButton && backAction && (
          <Animated.View style={[backButtonStyle]}>
            <NavigationButton
              action={backAction}
              style={styles.backButton}
              textStyle={styles.backText}
            />
          </Animated.View>
        )}

        {/* Continue/Finish button */}
        {showContinueButton && (
          <Animated.View style={[continueButtonStyle]}>
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
      </View>
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
    fontWeight: '500',
  },
  navigationContainer: {
    flexDirection: 'row',
    height: ButtonHeight,
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
    fontWeight: '700',
  },
}));