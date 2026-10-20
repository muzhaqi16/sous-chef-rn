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
