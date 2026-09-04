export const typography = {
  fontFamily: {
    regular: 'System',
    medium: 'System-Medium',
    semibold: 'System-Semibold',
    bold: 'System-Bold',
    mono: 'Courier',
  },
  fontSize: {
    '3xs': 10,
    '2xs': 11,
    xs: 12,
    xsPlus: 13,
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
    tight: 20, // For sm/base text
    normal: 24, // For md/lg text
    relaxed: 28, // For xl text
    loose: 32, // For 2xl text
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
  },
};

/**
 * Canonical typography API: `theme.fonts.size.*` / `theme.fonts.weight.*`.
 * lineHeight and letterSpacing live on `theme.typography.*` instead.
 */
/** Explicit type keeps literal font-weight values without `as const`. */
interface FontWeights {
  regular: '400';
  medium: '500';
  semibold: '600';
  bold: '700';
}

const fontWeights: FontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const fonts = {
  size: typography.fontSize,
  weight: fontWeights,
  lineHeight: typography.lineHeight,
  letterSpacing: typography.letterSpacing,
};
