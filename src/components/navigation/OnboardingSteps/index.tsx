import React, { memo } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { StepDot } from './StepDot';
import type { OnboardingStepsProps } from './types';

export const OnboardingSteps: React.FC<OnboardingStepsProps> = memo(({
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
      width: withSpring(activeWidth, {
        damping: 15,
        stiffness: 150,
      }),
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
      <Animated.View
        style={[
          styles.progressBar,
          {
            height,
          },
          progressBarStyle,
        ]}
      />

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
});

OnboardingSteps.displayName = 'OnboardingSteps';

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
    borderRadius: 100,
    borderCurve: 'continuous',
    left: 0,
  },
}));