/**
 * Deliberately NOT scaled by density (see `applyAppearance`): a border is a
 * rule, not a gap, and widening every outline with the density setting reads as
 * a heavier UI rather than a roomier one.
 */
export const borderWidth = {
  none: 0,
  hairline: 1,
  thin: 1.5,
  medium: 2,
  thick: 3,
  heavy: 4,
};
