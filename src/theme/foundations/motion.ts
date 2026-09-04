import { Easing } from 'react-native-reanimated';

/** Named timing presets, in ms. */
export const timing = {
  // Sub-perceptible bounce for press feedback (squeeze in / out).
  MICRO: 75,
  INSTANT: 100,
  FAST: 150,
  STANDARD: 200,
  MODERATE: 250,
  SLOW: 300,
};

/** Named spring presets, in place of inline `{ damping, stiffness, mass }`. */
export const spring = {
  DEFAULT: { damping: 15, stiffness: 150, mass: 0.4 },
  SNAPPY: { damping: 10, stiffness: 400 },
  PRESS: { damping: 15, stiffness: 300 },
  GENTLE: { damping: 20, stiffness: 180 },
  HEAVY: { damping: 25, stiffness: 350, mass: 0.8 },
  EXPAND: { damping: 20, stiffness: 200 },
  TOAST_ENTER: { damping: 20, stiffness: 180 },
  TOAST_DISMISS: { damping: 25, stiffness: 200 },
};

/** The curves. `standard` is the CSS ease-in-out equivalent. */
export const easing = {
  standard: Easing.bezier(0.25, 0.1, 0.25, 1),
  /** Symmetric ease for a value that returns to where it started. */
  emphasized: Easing.inOut(Easing.ease),
  /** Fast out, slow in — for something arriving at rest. */
  decelerate: Easing.out(Easing.cubic),
  gentle: Easing.out(Easing.ease),
  plain: Easing.ease,
};

/**
 * Reduce-motion substitutes. Every duration collapses to zero and every spring
 * is over-damped, so an animation driven by these lands on its end state in a
 * frame instead of being removed at the call site.
 */
export const reducedTiming = Object.fromEntries(
  Object.keys(timing).map(key => [key, 0]),
) as typeof timing;

export const reducedSpring = Object.fromEntries(
  Object.keys(spring).map(key => [key, { damping: 100, stiffness: 1000 }]),
) as typeof spring;

export const motion = { timing, spring, easing };
