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
  opacity: {
    pressed: 0.7,
    disabled: 0.5,
    cardPressed: 0.95,
  },
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
    textTertiary: colors.neutral[600], // WCAG AA: ~4.6:1 contrast on white
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
    consumeAction: colors.actions.consume.light,
    wasteAction: colors.actions.waste.light,
    restockAction: colors.actions.restock.light,
    purchaseAction: colors.actions.purchase.light,
    unpurchaseAction: colors.actions.unpurchase.light,

    // Semantic action colors
    favorite: colors.actions.favorite.light,
    rating: colors.actions.rating.light,
  },
};

export const darkTheme = {
  ...commonTheme,
  colors: {
    ...colors,
    // Primary
    primary: colors.jaffa[400],
    primaryLight: colors.jaffa[400] + '20',
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
    textTertiary: colors.neutral[300], // Better contrast on dark surfaces
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

    // Status colors — dark-adapted for visibility on dark surfaces
    status: {
      pending: '#FFB74D',
      accepted: '#81C784',
      declined: '#EF5350',
      expired: '#9E9E9E',
      active: '#64B5F6',
      inactive: '#757575',
    },

    // Role colors — brighter for dark backgrounds
    roles: {
      owner: '#FF8A65',
      admin: '#81C784',
      member: '#64B5F6',
      guest: '#BDBDBD',
    },

    // Validation colors — solid dark backgrounds (no light-mode pastels)
    validation: {
      error: '#EF5350',
      errorText: '#EF9A9A',
      errorBg: '#3D2A2A',
      errorBorder: '#5C3A3A',
      success: '#81C784',
      successBg: '#2A3D2A',
      warning: '#FFB74D',
      warningBg: '#3D3225',
      info: '#64B5F6',
      infoBg: '#2A303D',
    },

    // Pantry redesign colors - dark mode specific expiration colors
    // Using solid colors from foundations to prevent swipeable container background bleed-through
    expiration: {
      expiredBg: colors.expiration.darkExpiredBg,
      expiredBorder: colors.expiration.darkExpiredBorder,
      expiredText: colors.expiration.darkExpiredText,
      expiredIconBg: colors.expiration.darkExpiredIconBg,
      warningText: colors.expiration.darkWarningText,
      warningBg: colors.expiration.darkWarningBg,
      warningBorder: colors.expiration.darkWarningBorder,
    },
    filterTab: {
      activeBg: colors.filterTab.activeBg,
      activeText: colors.filterTab.activeText,
      inactiveBg: colors.filterTab.darkInactiveBg,
      inactiveText: colors.filterTab.darkInactiveText,
      filteredBg: colors.filterTab.darkFilteredBg,
      filteredText: colors.filterTab.darkFilteredText,
      countBg: colors.filterTab.darkCountBg,
      countText: colors.filterTab.darkCountText,
      activeCountBg: colors.filterTab.activeCountBg,
    },
    avatar: colors.avatar,
    sectionHeader: colors.sectionHeader,
    // Alert banner — solid dark backgrounds instead of light-mode pastels
    alertBanner: {
      error: {
        bg: '#3D2A2A',
        border: '#5C3A3A',
        text: '#EF9A9A',
        iconBg: '#4A3030',
      },
      warning: {
        bg: '#3D3225',
        border: '#5C4A35',
        text: '#FDBA74',
        iconBg: '#4A3D2A',
      },
      info: {
        bg: '#2A303D',
        border: '#3A4A5C',
        text: '#90CAF9',
        iconBg: '#303D4A',
      },
      success: {
        bg: '#2A3D2A',
        border: '#3A5C3A',
        text: '#A5D6A7',
        iconBg: '#304A30',
      },
    },

    // Overlay
    overlay: colors.overlay,

    // Action colors for swipe actions (slightly adjusted for dark mode visibility)
    consumeAction: colors.actions.consume.dark,
    wasteAction: colors.actions.waste.dark,
    restockAction: colors.actions.restock.dark,
    purchaseAction: colors.actions.purchase.dark,
    unpurchaseAction: colors.actions.unpurchase.dark,

    // Semantic action colors
    favorite: colors.actions.favorite.dark,
    rating: colors.actions.rating.dark,
  },
};

// Type exports
export type Theme = typeof lightTheme;
export type AnyTheme = typeof lightTheme | typeof darkTheme;
export type ThemeColors = Theme['colors'];
