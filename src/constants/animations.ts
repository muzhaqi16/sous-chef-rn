import { FadeIn, FadeOut, LinearTransition, Easing } from 'react-native-reanimated';
import type { SlideAnimationConfig } from '#hooks/animations/types';

// Note: DRAG_ITEM_HEIGHT and other drag constants are in './drag.ts'
// Import directly: import { DRAG_ITEM_HEIGHT } from '#/constants/drag';

/**
 * Standard cubic bezier easing function for smooth animations
 * Equivalent to CSS ease-in-out with custom curve
 */
export const standardEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * Reusable slide animation presets for common patterns.
 *
 * @example
 * ```tsx
 * import { SLIDE_PRESETS } from '#/constants/animations';
 *
 * // Full exit (shopping list checkbox toggle)
 * <AnimatedListItem slideConfig={SLIDE_PRESETS.fullExit} />
 *
 * // Subtle feedback slide
 * <AnimatedListItem slideConfig={SLIDE_PRESETS.subtle} />
 *
 * // Exit with fade (for deletions)
 * <AnimatedListItem slideConfig={SLIDE_PRESETS.exitWithFade} />
 * ```
 */
export const SLIDE_PRESETS = {
  /**
   * Full exit slide (shopping list purchase toggle)
   * Slides completely off screen to the right
   */
  fullExit: {
    slideDistance: 'screenWidth',
    duration: 250,
    withOpacity: false,
  },
  /**
   * Subtle feedback slide
   * Small slide for visual feedback without full exit
   */
  subtle: {
    slideDistance: 50,
    duration: 200,
    withOpacity: false,
  },
  /**
   * Exit with fade (for deletions)
   * Combines slide with opacity fade for smoother deletion effect
   */
  exitWithFade: {
    slideDistance: 200,
    duration: 250,
    withOpacity: true,
    opacityTarget: 0,
  },
} as const satisfies Record<string, SlideAnimationConfig>;

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
  itemHeight: 95, // 87px content + 8px margins (spacing.xs = 4px each side)
} as const;

/**
 * PERFORMANCE: Faster exit animation for checkbox toggles
 *
 * When a user taps a checkbox, they expect immediate feedback.
 * This faster animation (200ms vs 300ms) provides snappier UX while
 * still maintaining visual continuity.
 *
 * Timeline (200ms total):
 * - 0-200ms: Slide (200px right) - 33% faster
 * - 0-200ms: Fade out - starts immediately
 * - 0-200ms: Scale to 0.97 - subtle scale for less jarring effect
 *
 * Used by SortableItem when checkbox is toggled (vs swipe/delete actions)
 */
export const listItemFastExitAnimation = {
  slide: {
    duration: 200,
    distance: 200,
  },
  fade: {
    delay: 0, // Start immediately for snappier feel
    duration: 200,
  },
  scale: {
    delay: 0,
    duration: 200,
    toValue: 0.97, // Subtler scale
  },
  removalDelay: 200,
  layoutAnimation: {
    duration: 150,
  },
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

/**
 * Staggered list entry animation preset
 * Used for skeleton-to-content transitions (cascade/waterfall effect)
 *
 * After skeleton loading completes, items fade in sequentially.
 * Stagger is disabled after initial render to prevent animation
 * during scroll (FlashList recycles views).
 */
export const staggeredEntryAnimation = {
  delayPerItem: 0, // All items fade in together (simultaneous)
  maxItems: 6, // Cap stagger for long lists (reduced from 8)
  duration: 200, // Individual item fade duration (reduced from 250ms)
  initialDelay: 30, // Delay before first item for smoother skeleton→content transition
} as const;
