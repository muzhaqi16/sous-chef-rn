import { colors } from './foundations/colors';
import { spacing } from './foundations/spacing';
import { typography, fonts } from './foundations/typography';
import { radii } from './foundations/radii';
import { shadows } from './foundations/shadows';
import { sizes } from './foundations/sizes';
import { zIndex } from './foundations/zIndex';

const commonTheme = {
  spacing,
  typography,
  fonts,
  radii,
  shadows,
  sizes,
  zIndex,
};

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

    // Icon colors - semantic tokens for consistent icon styling
    iconPrimary: colors.jaffa[500],
    iconSecondary: colors.neutral[600],
    iconTertiary: colors.neutral[500],
    iconDisabled: colors.neutral[400],
    iconOnPrimary: colors.neutral[0],
    iconOnSurface: colors.neutral[900],

    // Status colors - for invites, tasks, etc.
    status: colors.status,

    // Role colors - for user roles
    roles: colors.roles,

    // Validation colors - for forms
    validation: colors.validation,

    // Pantry redesign colors
    expiration: colors.expiration,
    filterTab: colors.filterTab,
    avatar: colors.avatar,
    sectionHeader: colors.sectionHeader,
    alertBanner: colors.alertBanner,

    // Overlay
    overlay: colors.overlay,

    // Action colors for swipe actions
    consumeAction: '#9C27B0',
    wasteAction: '#FF9800',
    restockAction: '#4CAF50',
    purchaseAction: '#4CAF50',
    unpurchaseAction: '#FF9800',

    // Semantic action colors
    favorite: '#E91E63',
    rating: '#FFB800',

    gap: (v: number) => v * 8,
  },
};

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

    // Icon colors - semantic tokens for consistent icon styling
    iconPrimary: colors.jaffa[400],
    iconSecondary: colors.neutral[300],
    iconTertiary: colors.neutral[400],
    iconDisabled: colors.neutral[500],
    iconOnPrimary: colors.neutral[900],
    iconOnSurface: colors.neutral[50],

    // Status colors - for invites, tasks, etc.
    status: colors.status,

    // Role colors - for user roles
    roles: colors.roles,

    // Validation colors - for forms
    validation: colors.validation,

    // Pantry redesign colors - dark mode specific expiration colors
    // Using solid colors to prevent swipeable container background bleed-through
    expiration: {
      expiredBg: '#3D2A2A',                       // Solid dark red (not transparent)
      expiredBorder: '#5C3A3A',                   // Solid red border
      expiredText: '#FCA5A5',                     // Lighter red for readability
      expiredIconBg: '#4A3030',                   // Solid red for icon bg
      warningText: '#FDBA74',                     // Lighter orange for readability
      warningBg: '#3D3225',                       // Solid dark orange (not transparent)
      warningBorder: '#5C4A35',                   // Solid orange border
    },
    filterTab: {
      activeBg: '#F97316',              // Keep orange for active
      activeText: '#FFFFFF',            // Keep white for active
      inactiveBg: '#3F4553',            // Dark gray background for inactive
      inactiveText: '#D1D5DB',          // Light gray text for contrast
      filteredBg: 'rgba(249, 115, 22, 0.15)', // Subtle orange tint
      filteredText: '#FB923C',          // Lighter orange for dark mode
      countBg: '#4B5563',               // Darker badge background
      countText: '#D1D5DB',             // Light text for badge
      activeCountBg: 'rgba(255,255,255,0.25)', // Keep semi-transparent white
    },
    avatar: colors.avatar,
    sectionHeader: colors.sectionHeader,
    alertBanner: colors.alertBanner,

    // Overlay
    overlay: colors.overlay,

    // Action colors for swipe actions (slightly adjusted for dark mode visibility)
    consumeAction: '#BA68C8',
    wasteAction: '#FFB74D',
    restockAction: '#81C784',
    purchaseAction: '#81C784',
    unpurchaseAction: '#FFB74D',

    // Semantic action colors
    favorite: '#F48FB1',
    rating: '#FFD54F',

    gap: (v: number) => v * 8,
  },
};

// Type exports
export type Theme = typeof lightTheme;
export type ThemeColors = Theme['colors'];
