import { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import type { SlideAnimationConfig } from '#hooks/animations/types';
import { motion } from '#/theme/foundations/motion';

/** Alert modal animation. */
export const ALERT = {
  ENTER_SCALE_FROM: 0.96,
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
