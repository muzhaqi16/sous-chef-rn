export const spacing = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 40,
  // if you need more
} as const;

export type SpacingKey = keyof typeof spacing;
export type Spacing = typeof spacing;
