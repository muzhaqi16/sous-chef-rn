import {
  colors,
  spacing,
  typography,
  fonts,
  radii,
  shadows,
  sizes,
} from './foundations';

const commonTheme = {
  spacing,
  typography,
  fonts,
  radii,
  shadows,
  sizes,
} as const;

export const lightTheme = {
  ...commonTheme,
  colors: {
    // Primary
    primary: colors.primary[400],
    primaryLight: colors.primary[100],
    primaryDark: colors.primary[700],
    onPrimary: colors.neutral[0],

    // Background
    background: colors.neutral[50],
    backgroundSecondary: colors.secondary[100],
    surface: colors.neutral[0],
    surfaceVariant: colors.neutral[100],

    // Text
    textPrimary: colors.neutral[900],
    textSecondary: colors.neutral[600],
    textTertiary: colors.neutral[500],
    textInverse: colors.neutral[0],
    textOnSurfaceVariant: colors.neutral[700],

    // Input specific
    inputBackground: colors.neutral[0],
    inputText: colors.neutral[900],
    inputPlaceholder: colors.neutral[500],

    // Borders
    border: colors.neutral[300],
    borderLight: colors.neutral[200],
    divider: colors.neutral[200],

    // Semantic
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,

    // Components specific
    white: colors.neutral[0],
    black: colors.neutral[1000],
    transparent: colors.transparent,
    chipBackground: colors.neutral[200],
    chipText: colors.neutral[700],
    chipSelectedBackground: colors.primary[500],
    chipSelectedText: colors.neutral[0],
    iconPrimary: colors.primary[500],

    // Overlay
    overlay: colors.overlay,
    gap: (v: number) => v * 8,
  },
} as const;

export const darkTheme = {
  ...commonTheme,
  colors: {
    // Primary
    primary: colors.primary[400],
    primaryLight: colors.primary[200],
    primaryDark: colors.primary[600],
    onPrimary: colors.neutral[900],

    // Background
    background: colors.neutral[900],
    backgroundSecondary: colors.secondary[800],
    surface: colors.neutral[800],
    surfaceVariant: colors.neutral[700],

    // Text
    textPrimary: colors.neutral[50],
    textSecondary: colors.neutral[300],
    textTertiary: colors.neutral[400],
    textInverse: colors.neutral[900],
    textOnSurfaceVariant: colors.neutral[200],

    // Input specific
    inputBackground: colors.neutral[800],
    inputText: colors.neutral[50],
    inputPlaceholder: colors.neutral[400],

    // Borders
    border: colors.neutral[600],
    borderLight: colors.neutral[700],
    divider: colors.neutral[700],

    // Semantic
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,

    // Components specific
    white: colors.neutral[0],
    black: colors.neutral[1000],
    transparent: colors.transparent,
    chipBackground: colors.neutral[700],
    chipText: colors.neutral[200],
    chipSelectedBackground: colors.primary[400],
    chipSelectedText: colors.neutral[900],
    iconPrimary: colors.primary[400],

    // Overlay
    overlay: colors.overlay,
    gap: (v: number) => v * 8,
  },
} as const;

// Type exports
export type Theme = typeof lightTheme;
export type ThemeColors = Theme['colors'];
