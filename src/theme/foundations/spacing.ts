/**
 * One vocabulary, every step NAMED — a name is what `applyAppearance` scales for
 * the density setting. `spacing.xs + 2` adds a raw 2 to an already-scaled 4, so
 * it stops tracking density: add the missing step here, never at the call site.
 */
export const spacing = {
  xs: 4,
  xsPlus: 6,
  sm: 8,
  smPlus: 10,
  base: 12,
  basePlus: 14,
  md: 16,
  mdPlus: 20,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
};

// Helper function for consistent spacing
export const space = (...values: (keyof typeof spacing)[]) => {
  return values.map(v => spacing[v]);
};
