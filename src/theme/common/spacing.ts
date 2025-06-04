export const sizes = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
export type Sizes = typeof sizes;

export const margins = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export type Margins = typeof margins;

export const paddings = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export type Paddings = typeof paddings;

// This allows us to use shorthands like `theme.spacing.md` or `theme.spacing.margin.md`
export const spacingValues = {
  ...margins,
  ...sizes,
  ...paddings,
};
export type SpacingValues = typeof spacingValues;

export const spacings = {
  margin: margins,
  padding: paddings,
  sizes: sizes,
  ...spacingValues,
};

export type Spacings = typeof spacings;
