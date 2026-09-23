/**
 * One vocabulary, every step NAMED — a name is what `applyAppearance` scales for
 * the density setting. `spacing.xs + 2` adds a raw 2 to an already-scaled 4, so
 * it stops tracking density: add the missing step here, never at the call site.
 */
export const spacing = {
  // Optical steps: a caption nudged onto a baseline, a hairline chip inset.
  '3xs': 1,
  '2xs': 2,
  '2xsPlus': 3,
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

/**
 * Semantic layout steps, named for the job rather than the size. The row steps
 * are the list row's whole geometry: four shells compose one, so the numbers
 * live here rather than four times over.
 */
export const layout = {
  /** Screen edge to any screen-level content — chrome, controls and rows alike. */
  pageGutter: 16,
  /** Below a screen's last content, on top of the bottom safe-area inset. */
  pageBottom: 24,
  sectionGap: 24,
  /** A row's own edge to its content. */
  rowInset: 8,
  /** Between a row's slots — thumbnail, text, trailing. */
  rowSlotGap: 8,
  /** Between a row's title and its subtitle. */
  rowTextGap: 4,
  /** Between one row and the next. */
  rowGap: 8,
};
