export const shadows = {
  none: {},
  sm: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 2,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.05)',
      },
    ],
  },
  md: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 2,
        blurRadius: 4,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.1)',
      },
    ],
  },
  lg: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 8,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.15)',
      },
    ],
  },
  xl: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 8,
        blurRadius: 12,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.2)',
      },
    ],
  },
  /**
   * Floating-card elevation. Soft, wide, low-opacity — the geometry the
   * primary cards (HomeCard, ItemCard, list thumbnails) were each inlining
   * with inconsistent color encoding. Use this for any resting surface card.
   */
  card: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 4,
        blurRadius: 15,
        spreadDistance: 1,
        color: 'rgba(0, 0, 0, 0.1)',
      },
    ],
  },
};
