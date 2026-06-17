// Soft, diffuse elevation ramp: each step is a single shadow with a wide blur
// and low opacity (vs. tight, dark drop shadows, which read dated). Blur grows
// and offset lifts as elevation increases; opacity stays low so surfaces feel
// like they float on warm light rather than sit on a hard line.
export const shadows = {
  none: {},
  sm: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 3,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.04)',
      },
    ],
  },
  md: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 8,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.06)',
      },
    ],
  },
  lg: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 6,
        blurRadius: 16,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.1)',
      },
    ],
  },
  xl: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 12,
        blurRadius: 28,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.14)',
      },
    ],
  },
  /**
   * Floating-card elevation. Soft, wide, low-opacity — the geometry the
   * primary cards (HomeCard, ItemCard, list thumbnails) were each inlining
   * with inconsistent color encoding. Use this for any resting surface card.
   * Spread 0 so the blur fades cleanly to transparent (no hard edge); the
   * containers it renders inside must not clip (overflow: visible).
   */
  card: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 3,
        blurRadius: 16,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.08)',
      },
    ],
  },
};
