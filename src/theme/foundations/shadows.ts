type ShadowLayer = {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
};

/**
 * Elevation geometry: blur grows and the offset lifts with the step, while the
 * opacity stays low so surfaces float rather than sit on a hard line. The
 * opacities come from the theme, since what reads as depth differs by ground.
 */
const ramp = (alpha: Record<string, number>, ink: string) => ({
  none: {},
  sm: layer(0, 1, 3, 0, ink, alpha.sm),
  md: layer(0, 2, 8, 0, ink, alpha.md),
  lg: layer(0, 6, 16, 0, ink, alpha.lg),
  xl: layer(0, 12, 28, 0, ink, alpha.xl),
  /** Upward cast, for a surface anchored to the bottom edge. */
  trayTop: layer(0, -2, 8, 0, ink, alpha.md),
  /**
   * Floating-card elevation for any resting surface card. Spread 0 on the
   * contact layer so the blur fades cleanly to transparent, which means every
   * container it renders inside must keep `overflow: visible`.
   */
  card: {
    boxShadow: [
      one(0, 1, 2, 0, ink, alpha.sm),
      // Ambient layer: wide and soft with negative spread. Two layers read as
      // real depth rather than a flat drop shadow.
      one(0, 6, 20, -2, ink, alpha.card),
    ],
  },
});

function one(
  offsetX: number,
  offsetY: number,
  blurRadius: number,
  spreadDistance: number,
  ink: string,
  opacity: number,
): ShadowLayer {
  return {
    offsetX,
    offsetY,
    blurRadius,
    spreadDistance,
    color: `rgba(${ink}, ${opacity})`,
  };
}

function layer(...args: Parameters<typeof one>) {
  return { boxShadow: [one(...args)] };
}

const BLACK = '0, 0, 0';

export const shadows = ramp(
  { sm: 0.04, md: 0.06, lg: 0.1, xl: 0.14, card: 0.08 },
  BLACK,
);

/**
 * On a charcoal ground a 4%-black shadow is invisible, so the dark ramp keeps
 * the geometry and deepens the ink — elevation there is carried by the cast
 * shadow AND by the surface steps, which already lighten with depth.
 */
export const darkShadows = ramp(
  { sm: 0.3, md: 0.36, lg: 0.44, xl: 0.5, card: 0.4 },
  BLACK,
);
