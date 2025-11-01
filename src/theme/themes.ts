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
    ...colors,
    // Primary
    primary: colors.jaffa[400],
    primaryLight: colors.jaffa[100],
    primaryDark: colors.jaffa[700],
    onPrimary: colors.neutral[0],

    // Secondary
    secondary: colors.charade[400],
    secondaryLight: colors.charade[100],
    secondaryDark: colors.charade[950],
    onSecondary: colors.neutral[900],

    // Background
    background: colors.neutral[0],
    backgroundSecondary: colors.charade[100],
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
    successLight: colors.validation.successBg,
    warning: colors.warning,
    warningLight: colors.validation.warningBg,
    error: colors.error,
    errorLight: colors.validation.errorBg,
    info: colors.info,
    infoLight: colors.validation.infoBg,
    danger: colors.error,

    // Components specific
    white: colors.neutral[0],
    black: colors.neutral[1000],
    transparent: colors.transparent,
    chipBackground: colors.neutral[200],
    chipText: colors.neutral[700],
    chipSelectedBackground: colors.jaffa[300],
    chipSelectedText: colors.neutral[0],
    iconPrimary: colors.jaffa[500],

    // Status colors - for invites, tasks, etc.
    status: colors.status,

    // Role colors - for user roles
    roles: colors.roles,

    // Validation colors - for forms
    validation: colors.validation,

    // Overlay
    overlay: colors.overlay,
    gap: (v: number) => v * 8,
  },
} as const;

export const darkTheme = {
  ...commonTheme,
  colors: {
    ...colors,
    // Primary
    primary: colors.jaffa[400],
    primaryLight: colors.jaffa[200],
    primaryDark: colors.jaffa[600],
    onPrimary: colors.neutral[900],

    // Secondary
    secondary: colors.charade[400],
    secondaryLight: colors.charade[200],
    secondaryDark: colors.charade[950],
    onSecondary: colors.neutral[0],

    // Background
    background: colors.neutral[900],
    backgroundSecondary: colors.charade[800],
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
    successLight: colors.success + '20', // 20% opacity on dark bg
    warning: colors.warning,
    warningLight: colors.warning + '20',
    error: colors.error,
    errorLight: colors.error + '20',
    info: colors.info,
    infoLight: colors.info + '20',
    danger: colors.error,

    // Components specific
    white: colors.neutral[0],
    black: colors.neutral[1000],
    transparent: colors.transparent,
    chipBackground: colors.neutral[700],
    chipText: colors.neutral[200],
    chipSelectedBackground: colors.jaffa[400],
    chipSelectedText: colors.neutral[900],
    iconPrimary: colors.jaffa[400],

    // Status colors - for invites, tasks, etc.
    status: colors.status,

    // Role colors - for user roles
    roles: colors.roles,

    // Validation colors - for forms
    validation: colors.validation,

    // Overlay
    overlay: colors.overlay,
    gap: (v: number) => v * 8,
  },
} as const;

// Type exports
export type Theme = typeof lightTheme;
export type ThemeColors = Theme['colors'];
