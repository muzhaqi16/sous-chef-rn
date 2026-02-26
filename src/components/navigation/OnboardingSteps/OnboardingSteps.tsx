import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { SPRING } from '#/constants/animations';
import { StepDot } from './StepDot';
import type { OnboardingStepsProps } from './types';

export const OnboardingSteps: React.FC<OnboardingStepsProps> = ({
  steps,
  activeIndex,
  stepSize = 12,
  onStepPress,
  allowStepNavigation = false,
}) => {
  const stepSpacing = 20;
  const externalSpacing = stepSpacing;
  const height = stepSize + 20;

  const progressBarStyle = useAnimatedStyle(() => {
    // Calculate the width of the progress bar based on the active index
    // The formula ensures the bar extends to the current active step
    const activeWidth =
      (activeIndex.value + 1) * stepSize +
      activeIndex.value * stepSpacing +
      externalSpacing;

    return {
      width: withSpring(activeWidth, SPRING.DEFAULT),
    };
  }, [stepSize, stepSpacing, externalSpacing]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingHorizontal: externalSpacing / 2,
          gap: stepSpacing,
        },
      ]}
    >
      {/* Animated progress bar background */}
      {/* UNISTYLES FIX: Wrapper pattern - static Unistyles on outer View */}
      <View style={[styles.progressBar, { height }]}>
        <Animated.View style={[{ width: '100%', height: '100%' }, progressBarStyle]} />
      </View>

      {/* Step dots */}
      {steps.map((step, index) => (
        <StepDot
          key={step.id}
          index={index}
          activeIndex={activeIndex}
          stepSize={stepSize}
          step={step}
          onPress={onStepPress}
          allowNavigation={allowStepNavigation}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    backgroundColor: theme.colors.primaryLight || '#DBEAFE',
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    left: 0,
  },
}));