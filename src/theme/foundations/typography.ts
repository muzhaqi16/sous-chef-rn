export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System-Medium',
    semibold: 'System-Semibold',
    bold: 'System-Bold',
    mono: 'Courier',
  },
  fontSize: {
    '2xs': 11,
    xs: 12,
    sm: 14,
    base: 16,
    md: 16, // Alias for your existing code
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 40,
  },
  lineHeight: {
    tight: 20,    // For sm/base text
    normal: 24,   // For md/lg text
    relaxed: 28,  // For xl text
    loose: 32,    // For 2xl text
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
} as const;

/**
 * Canonical typography API - preferred access path: `theme.fonts.*`
 *
 * Usage:
 *   theme.fonts.size.md      // fontSize
 *   theme.fonts.weight.semibold  // fontWeight
 *
 * For lineHeight and letterSpacing, use `theme.typography.*`:
 *   theme.typography.lineHeight.normal
 *   theme.typography.letterSpacing.tight
 */
export const fonts = {
  size: typography.fontSize,
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: typography.lineHeight,
  letterSpacing: typography.letterSpacing,
};
