import { motion } from '#/theme/motion';

export const HOLE_PADDING = 8;
export const TOOLTIP_MARGIN = 12;
/** The card is this wide at most, and narrower on a small screen. */
export const TOOLTIP_MAX_WIDTH = 320;
export const ARROW_SIZE = 10;
export const SWIPE_THRESHOLD = 50;
export const HOLE_TIMING_CONFIG = {
  duration: motion.timing.SLOW,
  easing: motion.easing.standard,
};
/** One showing of a gesture; a loop's period, longer than the motion scale. */
export const DEMO_PERIOD_MS = 1600;
/** A gesture is shown this many times, then stops. */
export const DEMO_REPEATS = 3;
