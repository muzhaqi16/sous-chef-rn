import {
  FadeIn,
  FadeOut,
  LinearTransition,
  Easing,
} from 'react-native-reanimated';
import type { SlideAnimationConfig } from '#hooks/animations/types';

// Note: DRAG_ITEM_HEIGHT and other drag constants are in './drag.ts'
// Import directly: import { DRAG_ITEM_HEIGHT } from '#/constants/drag';

/**
 * Standard cubic bezier easing function for smooth animations
 * Equivalent to CSS ease-in-out with custom curve
 */
export const standardEasing = Easing.bezier(0.25, 0.1, 0.25, 1);

/**
 * Named spring animation presets.
 * Replaces hardcoded {damping, stiffness, mass} objects across the codebase.
 */
export const SPRING = {
  DEFAULT: { damping: 15, stiffness: 150, mass: 0.4 },
  SNAPPY: { damping: 10, stiffness: 400 },
  PRESS: { damping: 15, stiffness: 300 },
  GENTLE: { damping: 20, stiffness: 180 },
  HEAVY: { damping: 25, stiffness: 350, mass: 0.8 },
  EXPAND: { damping: 20, stiffness: 200 },
  TOAST_ENTER: { damping: 20, stiffness: 180 },
  TOAST_DISMISS: { damping: 25, stiffness: 200 },
};

/**
 * Alert modal animation constants.
 */
export const ALERT = {
  ENTER_SCALE_FROM: 0.85,
  EXIT_SCALE_TO: 0.9,
  DEPTH_SCALE: 0.95,
  DEPTH_TRANSLATE_Y: -8,
  DEPTH_OPACITY: 0.6,
  BACKDROP_OPACITY: 0.5,
  MAX_VISIBLE: 2,
};

/**
 * Bottom-sheet / modal animation constants.
 */
export const SHEET = {
  SLIDE_DISTANCE: 300,
  BACKDROP_OPACITY: 0.5,
  BACKDROP_FADE_IN: 100,
  BACKDROP_FADE_OUT: 300,
};

/**
 * Toast animation constants.
 */
export const TOAST = {
  /**
   * Default hold, and what nearly every toast gets — the short confirmations
   * ("Item added", "Review submitted") that make up most of them.
   *
   * The hold is armed on the same tick the enter animation starts, so it spans
   * the `TIMING.FAST` fade-in; add `TIMING.STANDARD` for the fade-out to get
   * total time on screen (~1.6s here).
   */
  AUTO_DISMISS_SHORT: 1400,
  /**
   * For toasts carrying a full sentence rather than a confirmation — currently
   * only the connectivity announcements (`OfflineStatusPill`,
   * `OfflineTransitionToaster`), which need reading time.
   */
  AUTO_DISMISS_LONG: 2600,
  SWIPE_THRESHOLD: 50,
  /**
   * Dismissal travel, relative to the resting position (laid out at
   * `spacing.md` below the container's origin — see `Toast.tsx`). Far enough to
   * carry the tallest two-line toast off the top of the screen.
   */
  OFFSCREEN_Y: -150,
  /**
   * Entry travel, also relative to the resting position. Deliberately short:
   * entering from OFFSCREEN_Y spent the first frames of every appearance under
   * the status bar / Dynamic Island, which reads as a clipped banner.
   */
  ENTER_FROM_Y: -24,
  QUEUE_DELAY: 300,
};

/**
 * Floating tab bar animation constants.
 */
export const TAB_BAR = {
  // Distance (px) the bar slides below its resting position when fully hidden.
  HIDDEN_TRANSLATE_Y: 150,
};

/**
 * Distance-scaled scroll-slide tuning for the Reanimated-driven centering in
 * `useCenterActiveItem`: the glide duration grows with distance but is clamped,
 * so a near jump is snappy and a far one eases in.
 */
export const SCROLL_SLIDE = {
  // Milliseconds of animation per px of distance, before clamping.
  MS_PER_PX: 1.5,
  // Lower / upper clamp on the computed duration, in ms.
  MIN_MS: 250,
  MAX_MS: 500,
};

/**
 * Named timing duration presets (in ms).
 */
export const TIMING = {
  // Sub-perceptible bounce for press feedback (squeeze in / out).
  MICRO: 75,
  INSTANT: 100,
  FAST: 150,
  STANDARD: 200,
  MODERATE: 250,
  SLOW: 300,
};

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
} satisfies Record<string, SlideAnimationConfig>;

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
export const getFormAnimationPreset = () => ({
  entering: FadeIn.duration(300).easing(standardEasing),
  exiting: FadeOut.duration(200).easing(standardEasing),
  layout: LinearTransition.duration(250),
});

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
};

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
};

/**
 * Animation preset for list item entry transitions
 * Used when items appear in destination tab after toggle
 */
export const listItemEntryAnimation = {
  fade: { duration: 250 },
  slide: { distance: 50, duration: 300 },
};

/**
 * Layout animation for list items
 * Used when items shift position (e.g., when another item is removed)
 * Fast duration for snappy feel after exit animation
 */
export const getListItemLayoutAnimation = () =>
  LinearTransition.duration(150).easing(standardEasing);

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
};

/**
 * Screen content entry animation preset.
 * Apply `FadeIn.delay(index * delayPerItem)` to visible list items
 * on initial mount only (track with ref to prevent re-animation on scroll).
 */
export const screenEntryAnimation = {
  delayPerItem: 50,
  maxItems: 5,
  duration: 250,
  initialDelay: 100,
};
