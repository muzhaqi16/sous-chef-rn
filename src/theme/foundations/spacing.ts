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
  '4xl': 96,
};

// Helper function for consistent spacing
export const space = (...values: (keyof typeof spacing)[]) => {
  return values.map(v => spacing[v]);
};

/**
 * Semantic layout steps, named for the job rather than the size. The row steps
 * are the list row's whole geometry: four shells compose one, so the numbers
 * live here rather than four times over.
 */
export const layout = {
  pageGutter: 16,
  sectionGap: 24,
  /** A row's own edge to its content. */
  rowInset: 8,
  /** Between a row's slots — thumbnail, text, trailing. */
  rowSlotGap: 8,
  /** Between a row's title and its subtitle. */
  rowTextGap: 4,
  /** Between one row and the next. */
  rowGap: 8,
  /** Screen edge to a row's edge — matches the search bar above the list. */
  rowGutter: 12,
};
