export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// Helper function for consistent spacing
export const space = (...values: (keyof typeof spacing)[]) => {
  return values.map(v => spacing[v]);
};
