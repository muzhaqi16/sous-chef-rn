import { FadeIn, FadeOut, LinearTransition, Easing } from 'react-native-reanimated';

/**
 * Standard cubic bezier easing function for smooth animations
 * Equivalent to CSS ease-in-out with custom curve
 */
export const standardEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * Animation preset for form show/hide transitions
 * Used for expandable forms, modals, and collapsible sections
 *
 * Features:
 * - Fade in: 300ms with standard easing
 * - Fade out: 200ms with standard easing
 * - Layout transition: 250ms for smooth reflows
 *
 * @example
 * ```tsx
 * <Animated.View
 *   {...formAnimationPreset}
 *   style={[commonStyles.shadow, styles.formContainer]}
 * >
 *   <YourForm />
 * </Animated.View>
 * ```
 */
export const formAnimationPreset = {
  entering: FadeIn.duration(300).easing(standardEasing.factory()),
  exiting: FadeOut.duration(200).easing(standardEasing.factory()),
  layout: LinearTransition.duration(250),
};

/**
 * Animation preset for list item exit transitions
 * Used when items are toggled between purchased/unpurchased states
 *
 * Timeline (300ms total):
 * - 0-300ms: Slide (300px right)
 * - 50-300ms: Scale to 0.95
 * - 100-300ms: Fade out
 * - 300ms: Mutation fires, list reflows
 *
 * The removalDelay matches slide duration so animation completes
 * before the item is removed and list reflows.
 */
export const listItemExitAnimation = {
  slide: {
    duration: 300,
    distance: 300,
  },
  fade: {
    delay: 100,
    duration: 200,
  },
  scale: {
    delay: 50,
    duration: 250,
    toValue: 0.95,
  },
  // When to trigger item removal and layout shift
  // Must match slide duration so animation completes before removal
  removalDelay: 300,
  layoutAnimation: {
    duration: 200,
  },
  itemHeight: 103, // 87px content + 16px margins
} as const;

/**
 * Animation preset for list item entry transitions
 * Used when items appear in destination tab after toggle
 */
export const listItemEntryAnimation = {
  fade: { duration: 250 },
  slide: { distance: 50, duration: 300 },
} as const;

/**
 * Layout animation for list items
 * Used when items shift position (e.g., when another item is removed)
 * Fast duration for snappy feel after exit animation
 */
export const listItemLayoutAnimation = LinearTransition.duration(150).easing(
  standardEasing.factory(),
);
