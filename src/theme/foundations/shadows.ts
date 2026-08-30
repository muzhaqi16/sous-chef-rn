// Soft, diffuse elevation ramp: blur grows and offset lifts with elevation, while
// opacity stays low so surfaces float rather than sit on a hard line.
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
   * Floating-card elevation for any resting surface card. Spread 0 so the blur
   * fades cleanly to transparent, which means every container it renders inside
   * must keep `overflow: visible`.
   */
  card: {
    boxShadow: [
      {
        offsetX: 0,
        offsetY: 1,
        blurRadius: 2,
        spreadDistance: 0,
        color: 'rgba(0, 0, 0, 0.04)',
      },
      // Ambient layer: wide and soft with negative spread. Two layers read as
      // real depth rather than a flat drop shadow.
      {
        offsetX: 0,
        offsetY: 6,
        blurRadius: 20,
        spreadDistance: -2,
        color: 'rgba(0, 0, 0, 0.08)',
      },
    ],
  },
};
