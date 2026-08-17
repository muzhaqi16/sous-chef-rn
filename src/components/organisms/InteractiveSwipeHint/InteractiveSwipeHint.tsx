import React, {
  useEffect,
  useState,
  useRef,
  useLayoutEffect,
  ComponentRef,
} from 'react';
import { View, Modal } from 'react-native';
import { useTranslation } from '#/i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Pressable } from '#components/atoms/themedComponents';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { type SharedValue } from 'react-native-reanimated';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { SPRING, TIMING } from '#constants/animations';
import { HapticService } from '#/services/haptic/HapticService';
import { LeftActions } from '#/components/molecules/SwipeableItem/LeftActions';
import { RightActions } from '#/components/molecules/SwipeableItem/RightActions';
import { styles as swipeStyles } from '#/components/molecules/SwipeableItem/styles';
import { MockItemCard } from './MockItemCard';
import { SwipeHandIndicator } from './SwipeHandIndicator';
import { Text } from '#components/atoms/Text';

export interface InteractiveSwipeHintProps {
  mode: 'pantry' | 'shopping';
  onDismiss: () => void;
}

interface StepConfig {
  type: 'swipe' | 'tap';
  direction: 'left' | 'right' | 'any';
  /**
   * A key path, not a resolved string. These tables are built at import time,
   * so a resolved string would freeze whichever language loaded first and never
   * follow a language change; the consumer calls `t` at render instead.
   */
  instructionKey: string;
}

const PANTRY_STEPS: StepConfig[] = [
  {
    type: 'swipe',
    direction: 'right',
    instructionKey: 'swipeHint.pantrySeeActions',
  },
  {
    type: 'swipe',
    direction: 'left',
    instructionKey: 'swipeHint.pantryEditDelete',
  },
];

const SHOPPING_STEPS: StepConfig[] = [
  {
    type: 'swipe',
    direction: 'left',
    instructionKey: 'swipeHint.shoppingEdit',
  },
  {
    type: 'swipe',
    direction: 'right',
    instructionKey: 'swipeHint.shoppingDelete',
  },
  {
    type: 'tap',
    direction: 'any',
    instructionKey: 'swipeHint.shoppingMarkPurchased',
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
const StepDot: React.FC<{ active: boolean }> = ({ active }) => {
  styles.useVariants({ active });
  return <View style={styles.dot} />;
};

export const InteractiveSwipeHint: React.FC<InteractiveSwipeHintProps> = ({
  mode,
  onDismiss,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { t } = useTranslation();
  const [completed, setCompleted] = useState(false);
  const swipeableRef = useRef<ComponentRef<typeof Swipeable>>(null);

  // Track all in-flight setTimeout handles so they can be cleared on unmount.
  // The hint schedules timers to advance steps and dismiss; if the user
  // navigates away mid-step, those timers must not fire on a stale instance.
  const pendingTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const scheduleTimer = (cb: () => void, delayMs: number): void => {
    const id = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter(
        handle => handle !== id,
      );
      cb();
    }, delayMs);
    pendingTimersRef.current.push(id);
  };
  useEffect(() => {
    return () => {
      for (const id of pendingTimersRef.current) {
        clearTimeout(id);
      }
      pendingTimersRef.current = [];
    };
  }, []);

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
      scheduleTimer(onDismiss, 700);
    }
  };

  // Swipeable opened — user completed a swipe step
  const handleSwipeOpen = () => {
    HapticService.success();
    handVisible.set(withTiming(0, { duration: TIMING.FAST }));
    // Let user see the open state, then advance
    // key={currentStep} on Swipeable forces remount → resets to closed
    scheduleTimer(() => handleStepComplete(currentStep), 1000);
  };

  // Checkbox tapped — user completed the tap step
  const handleCheckboxTap = () => {
    HapticService.success();
    handVisible.set(withTiming(0, { duration: TIMING.FAST }));
    scheduleTimer(() => handleStepComplete(currentStep), 600);
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
    transform: [{ scale: checkScale.get() }],
    opacity: checkScale.get(),
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
              <Icon name="checkmark-circle" size={64} tone="success" />
              <Text size="lg" weight="semibold" style={styles.completedText}>
                {t('tutorial.youGotIt')}
              </Text>
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
            accessibilityLabel={t('tutorial.skipTutorial')}
          >
            <Text size="md" weight="medium" tone="tertiary">
              {t('labels.skip')}
            </Text>
          </Pressable>

          {/* Instruction text */}
          <Text
            size="lg"
            weight="semibold"
            align="center"
            style={styles.instruction}
          >
            {step?.instructionKey ? t(step.instructionKey) : null}
          </Text>

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
                <StepDot key={i} active={i <= currentStep} />
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
  instruction: {
    color: theme.colors.white,
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
    variants: {
      active: {
        true: { backgroundColor: theme.colors.primary },
        false: { backgroundColor: theme.colors.textTertiary },
      },
    },
  },
  checkContainer: {
    alignItems: 'center',
  },
  completedText: {
    color: theme.colors.white,
    marginTop: theme.spacing.md,
  },
}));
