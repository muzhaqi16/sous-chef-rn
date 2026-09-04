import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { StepDot } from './StepDot';
import type { OnboardingStepsProps } from './types';
import { motion } from '#/theme/foundations/motion';

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

  // Width the bar reaches at the last step — also the track's fixed width, so
  // the fill can be laid out once at full size and revealed by translation.
  const fullWidth =
    steps.length * stepSize +
    (steps.length - 1) * stepSpacing +
    externalSpacing;

  const progressBarStyle = useAnimatedStyle(() => {
    // Width the bar should reach for the active step. The fill is always
    // `fullWidth` wide and slid left by the remainder, so the animation stays
    // on transform instead of relaying out the track on every frame.
    const activeWidth =
      (activeIndex.get() + 1) * stepSize +
      activeIndex.get() * stepSpacing +
      externalSpacing;

    return {
      transform: [
        {
          translateX: withSpring(
            activeWidth - fullWidth,
            motion.spring.DEFAULT,
          ),
        },
      ],
    };
  });

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
      {/* The track clips the fill, so the fill's trailing cap stays round
          while its leading edge is hidden behind the track's own radius. */}
      <View style={[styles.progressBar, { height, width: fullWidth }]}>
        <Animated.View style={[styles.progressFill, progressBarStyle]} />
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
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
    overflow: 'hidden',
    left: 0,
  },
  progressFill: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radii.full,
    borderCurve: 'continuous',
  },
}));
