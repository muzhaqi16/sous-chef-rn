export const sizes = {
  // Component sizes
  button: {
    sm: 32,
    md: 44,
    lg: 56,
  },
  avatar: {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
    '2xl': 80,
  },
  icon: {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 48,
    '2xl': 64,
  },
  listImage: {
    width: 60,
    height: 60,
  },
  itemCard: {
    compact: {
      image: 48, // Slightly larger for better visibility
      height: 64, // Compact row height (48 + 8px padding each side = 64)
    },
    standard: {
      image: 60, // Current listImage - for optional large variant
      height: 87, // Standard row height
    },
  },
  // Touch target sizes (minimum 44x44 for accessibility)
  touchTarget: {
    min: 44, // Minimum recommended touch target size
    sm: 40,
    md: 44,
    lg: 56,
  },
  // FAB (Floating Action Button)
  fab: {
    sm: 48,
    md: 56,
    lg: 64,
  },
  // Modal and container widths
  modal: {
    sm: 280,
    md: 400,
    lg: 600,
  },
  // Layout sizes
  container: {
    xs: 320,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
  },
  // Input heights
  input: {
    sm: 36,
    md: 44,
    lg: 52,
  },
};
