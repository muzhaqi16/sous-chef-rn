import React, { useState, useRef, useLayoutEffect, ComponentRef } from 'react';
import { View, Text, Modal, Pressable } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { type SharedValue } from 'react-native-reanimated';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { SPRING, TIMING } from '#constants/animations';
import { HapticService } from '#/services/haptic/HapticService';
import { LeftActions } from '#/components/molecules/SwipeableItem/LeftActions';
import { RightActions } from '#/components/molecules/SwipeableItem/RightActions';
import { styles as swipeStyles } from '#/components/molecules/SwipeableItem/styles';
import { MockItemCard } from './MockItemCard';
import { SwipeHandIndicator } from './SwipeHandIndicator';

export interface InteractiveSwipeHintProps {
  mode: 'pantry' | 'shopping';
  onDismiss: () => void;
}

interface StepConfig {
  type: 'swipe' | 'tap';
  direction: 'left' | 'right' | 'any';
  instruction: string;
}

const PANTRY_STEPS: StepConfig[] = [
  {
    type: 'swipe',
    direction: 'right',
    instruction: 'Swipe right to see item actions',
  },
  {
    type: 'swipe',
    direction: 'left',
    instruction: 'Now swipe left for edit & delete',
  },
];

const SHOPPING_STEPS: StepConfig[] = [
  { type: 'swipe', direction: 'left', instruction: 'Swipe left to edit' },
  {
    type: 'swipe',
    direction: 'right',
    instruction: 'Now swipe right to delete',
  },
  {
    type: 'tap',
    direction: 'any',
    instruction: 'Tap the checkbox to mark purchased',
  },
];

// No-op callback — makes action renderers show buttons without doing anything
const noop = () => {};

/**
 * Interactive swipe tutorial overlay.
 * Uses the raw Swipeable component from RNGH with real LeftActions/RightActions
 * so swipe behavior is identical to actual list items.
 *
 * Shopping mode has 3 steps: swipe left, swipe right, tap checkbox.
 * Pantry mode has 2 steps: swipe right, swipe left.
 */
export const InteractiveSwipeHint: React.FC<InteractiveSwipeHintProps> = ({
  mode,
  onDismiss,
}) => {
  const { theme } = useUnistyles();
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const swipeableRef = useRef<ComponentRef<typeof Swipeable>>(null);

  const steps = mode === 'pantry' ? PANTRY_STEPS : SHOPPING_STEPS;
  const totalSteps = steps.length;
  const swipeMode: 'shopping' | undefined =
    mode === 'shopping' ? 'shopping' : undefined;

  // Hand indicator visibility
  const handVisible = useSharedValue(1);
  const checkScale = useSharedValue(0);

  // Step completion — advances or shows checkmark
  const handleStepComplete = (stepIndex: number) => {
    if (stepIndex < totalSteps - 1) {
      setCurrentStep(stepIndex + 1);
    } else {
      setCompleted(true);
      setTimeout(onDismiss, 700);
    }
  };

  // Swipeable opened — user completed a swipe step
  const handleSwipeOpen = () => {
    HapticService.success();
    handVisible.set(withTiming(0, { duration: TIMING.FAST }));
    // Let user see the open state, then advance
    // key={currentStep} on Swipeable forces remount → resets to closed
    setTimeout(() => handleStepComplete(currentStep), 1000);
  };

  // Checkbox tapped — user completed the tap step
  const handleCheckboxTap = () => {
    HapticService.success();
    handVisible.set(withTiming(0, { duration: TIMING.FAST }));
    setTimeout(() => handleStepComplete(currentStep), 600);
  };

  // Show checkmark when completed
  useLayoutEffect(() => {
    if (completed) {
      checkScale.set(withSpring(1, SPRING.SNAPPY));
    }
  }, [completed, checkScale]);

  // Reset hand visibility when step changes
  useLayoutEffect(() => {
    handVisible.set(withTiming(1, { duration: TIMING.STANDARD }));
  }, [currentStep, handVisible]);

  // Action renderers — same pattern as SwipeableItem but without useSwipeableActions
  const renderLeftActions = (progress: SharedValue<number>) => {
    if (mode === 'shopping') {
      return (
        <LeftActions
          onEdit={noop}
          swipeableRef={swipeableRef}
          progress={progress}
          swipeMode="shopping"
        />
      );
    }
    return (
      <LeftActions
        onConsume={noop}
        onWaste={noop}
        onRestock={noop}
        swipeableRef={swipeableRef}
        progress={progress}
      />
    );
  };

  const renderRightActions = (progress: SharedValue<number>) => (
    <RightActions
      onEdit={mode === 'pantry' ? noop : undefined}
      onDelete={noop}
      progress={progress}
      swipeMode={swipeMode}
    />
  );

  // Checkmark animation
  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }));

  if (completed) {
    return (
      <Modal
        visible
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
      >
        <GestureHandlerRootView style={styles.gestureRoot}>
          <View style={styles.overlay}>
            <Animated.View style={[styles.checkContainer, checkAnimatedStyle]}>
              <Icon
                name="checkmark-circle"
                size={64}
                color={theme.colors.success}
              />
              <Text style={styles.completedText}>You got it!</Text>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>
    );
  }

  const step = steps[currentStep];
  const isSwipeStep = step?.type === 'swipe';
  const isTapStep = step?.type === 'tap';

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.overlay}>
          {/* Skip button */}
          <Pressable
            onPress={onDismiss}
            style={styles.skipButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip tutorial"
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>

          {/* Instruction text */}
          <Text style={styles.instruction}>{step?.instruction}</Text>

          {/* Card area — Swipeable for swipe steps, plain card for tap steps */}
          <View style={styles.cardArea}>
            {isSwipeStep ? (
              <Swipeable
                key={currentStep}
                ref={swipeableRef}
                friction={1.5}
                leftThreshold={60}
                rightThreshold={60}
                renderLeftActions={renderLeftActions}
                renderRightActions={renderRightActions}
                onSwipeableWillOpen={handleSwipeOpen}
                overshootFriction={8}
                overshootRight={false}
                overshootLeft={false}
                containerStyle={swipeStyles.swipeableContainer}
                childrenContainerStyle={swipeStyles.childrenContainer}
              >
                <MockItemCard mode={mode} />
              </Swipeable>
            ) : (
              <MockItemCard
                mode={mode}
                onCheckboxPress={isTapStep ? handleCheckboxTap : undefined}
              />
            )}
          </View>

          {/* Swipe direction indicator — only shown on swipe steps */}
          {isSwipeStep && step != null ? (
            <SwipeHandIndicator
              direction={step.direction === 'left' ? 'left' : 'right'}
              visible={handVisible}
            />
          ) : null}

          {/* Step indicator dots */}
          {totalSteps > 1 ? (
            <View style={styles.dotsRow}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i <= currentStep
                          ? theme.colors.primary
                          : theme.colors.textTertiary,
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create(theme => ({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlays.heavy,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  skipButton: {
    position: 'absolute',
    top: theme.spacing.xl * 2,
    right: theme.spacing.lg,
    zIndex: 10,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  skipText: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textTertiary,
  },
  instruction: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  cardArea: {
    width: '100%',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radii.full,
  },
  checkContainer: {
    alignItems: 'center',
  },
  completedText: {
    fontSize: theme.fonts.size.lg,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.white,
    marginTop: theme.spacing.md,
  },
}));
