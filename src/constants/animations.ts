import { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import type { SlideAnimationConfig } from '#hooks/animations/types';
import { motion } from '#/theme/foundations/motion';

// Note: DRAG_ITEM_HEIGHT and other drag constants are in './drag.ts'
// Import directly: import { DRAG_ITEM_HEIGHT } from '#/constants/drag';

/** Alert modal animation. */
export const ALERT = {
  ENTER_SCALE_FROM: 0.85,
  EXIT_SCALE_TO: 0.9,
  DEPTH_SCALE: 0.95,
  DEPTH_TRANSLATE_Y: -8,
  DEPTH_OPACITY: 0.6,
  BACKDROP_OPACITY: 0.5,
  MAX_VISIBLE: 2,
};

/** Bottom-sheet / modal animation. */
export const SHEET = {
  SLIDE_DISTANCE: 300,
  BACKDROP_OPACITY: 0.5,
  BACKDROP_FADE_IN: 100,
  BACKDROP_FADE_OUT: 300,
};

/** Toast animation. */
export const TOAST = {
  /**
   * The default hold. Armed on the same tick the enter animation starts, so it
   * spans the fade-in; add `motion.timing.STANDARD` for total time on screen.
   */
  AUTO_DISMISS_SHORT: 1400,
  /** For a full sentence rather than a confirmation — reading time. */
  AUTO_DISMISS_LONG: 2600,
  SWIPE_THRESHOLD: 50,
  /** Dismissal travel from rest — clears the tallest two-line toast. */
  OFFSCREEN_Y: -150,
  /**
   * Entry travel from rest. Short on purpose — entering from OFFSCREEN_Y puts
   * the first frames under the Dynamic Island, reading as a clipped banner.
   */
  ENTER_FROM_Y: -24,
  QUEUE_DELAY: 300,
};

/** Floating tab bar animation. */
export const TAB_BAR = {
  // Distance (px) the bar slides below its resting position when fully hidden.
  HIDDEN_TRANSLATE_Y: 150,
};

/**
 * Scroll-slide tuning for `useCenterActiveItem`: duration grows with distance
 * but is clamped, so a near jump stays snappy and a far one eases in.
 */
export const SCROLL_SLIDE = {
  // Milliseconds of animation per px of distance, before clamping.
  MS_PER_PX: 1.5,
  // Lower / upper clamp on the computed duration, in ms.
  MIN_MS: 250,
  MAX_MS: 500,
};

/** Slide presets, spread into `useSlideAnimation`. */
export const SLIDE_PRESETS = {
  /** Full exit: off screen to the right. */
  fullExit: {
    slideDistance: 'screenWidth',
    duration: motion.timing.MODERATE,
    withOpacity: false,
  },
  /** Feedback only, no exit. */
  subtle: {
    slideDistance: 50,
    duration: motion.timing.STANDARD,
    withOpacity: false,
  },
  /** Exit with fade, for deletions. */
  exitWithFade: {
    slideDistance: 200,
    duration: motion.timing.MODERATE,
    withOpacity: true,
    opacityTarget: 0,
  },
} satisfies Record<string, SlideAnimationConfig>;

/** Show/hide transition for expandable forms and collapsible sections. */
export const getFormAnimationPreset = () => ({
  entering: FadeIn.duration(motion.timing.SLOW).easing(motion.easing.standard),
  exiting: FadeOut.duration(motion.timing.STANDARD).easing(
    motion.easing.standard,
  ),
  layout: LinearTransition.duration(motion.timing.MODERATE),
});

/**
 * List item exit, for a purchased/unpurchased toggle. `removalDelay` MUST match
 * the slide duration, so the animation finishes before the list reflows.
 */
export const listItemExitAnimation = {
  slide: {
    duration: motion.timing.SLOW,
    distance: 300,
  },
  fade: {
    delay: 100,
    duration: motion.timing.STANDARD,
  },
  scale: {
    delay: 50,
    duration: motion.timing.MODERATE,
    toValue: 0.95,
  },
  // When to trigger item removal and layout shift
  // Must match slide duration so animation completes before removal
  removalDelay: 300,
  layoutAnimation: {
    duration: motion.timing.STANDARD,
  },
  itemHeight: 95, // 87px content + 8px margins (spacing.xs = 4px each side)
};

/**
 * The faster exit `SortableItem` uses for a checkbox toggle, where the tap
 * expects immediate feedback — swipe and delete keep the slower one above.
 */
export const listItemFastExitAnimation = {
  slide: {
    duration: motion.timing.STANDARD,
    distance: 200,
  },
  fade: {
    delay: 0, // Start immediately for snappier feel
    duration: motion.timing.STANDARD,
  },
  scale: {
    delay: 0,
    duration: motion.timing.STANDARD,
    toValue: 0.97, // Subtler scale
  },
  removalDelay: 200,
  layoutAnimation: {
    duration: motion.timing.FAST,
  },
};

/** Entry for an item appearing in the destination tab after a toggle. */
export const listItemEntryAnimation = {
  fade: { duration: motion.timing.MODERATE },
  slide: { distance: 50, duration: motion.timing.SLOW },
};

/** Shift for items repositioning after another is removed. */
export const getListItemLayoutAnimation = () =>
  LinearTransition.duration(motion.timing.FAST).easing(motion.easing.standard);

/**
 * Skeleton-to-content entry. At `delayPerItem: 0` every item fades in together;
 * raising it restores a cascade. Applied on the initial render only, so
 * FlashList's recycling cannot re-animate rows mid-scroll.
 */
export const staggeredEntryAnimation = {
  delayPerItem: 0,
  maxItems: 6,
  duration: motion.timing.STANDARD,
  initialDelay: 30,
};

/**
 * Apply `FadeIn.delay(index * delayPerItem)` on initial mount ONLY — track with
 * a ref, or recycling re-animates rows during scroll.
 */
export const screenEntryAnimation = {
  delayPerItem: 50,
  maxItems: 5,
  duration: motion.timing.MODERATE,
  initialDelay: 100,
};
