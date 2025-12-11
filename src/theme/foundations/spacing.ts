export const spacing = {
  xs: 4,
  sm: 8,
  '2.5': 10, // Commonly used in inputs, buttons
  '3': 12, // Commonly used in form fields
  md: 16,
  '5': 20, // Commonly used in modals, cards
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// Helper function for consistent spacing
export const space = (...values: (keyof typeof spacing)[]) => {
  return values.map(v => spacing[v]);
};
