import { colors, darkExpiration, darkFilterTab } from './foundations/colors';
import { brand } from './foundations/brand';
import { onColor } from './derivePalette';
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
    // Primary — sourced from the brand palette (`appConfig.branding.primaryColor`,
    // jaffa by default). The AppearanceScreen "Default" swatch reads the same
    // config value, so the two stay in sync from a single source.
    primary: brand[500],
    primaryLight: brand[100],
    primaryDark: brand[700],
    onPrimary: onColor(brand[500], colors.neutral[0], colors.neutral[900]),
    onError: onColor(colors.error, colors.neutral[0], colors.neutral[900]),
    onSuccess: onColor(colors.success, colors.neutral[0], colors.neutral[900]),
    onWarning: onColor(colors.warning, colors.neutral[0], colors.neutral[900]),
    onInfo: onColor(colors.info, colors.neutral[0], colors.neutral[900]),

    // Secondary
    secondary: colors.charade[400],
    secondaryLight: colors.charade[100],
    secondaryDark: colors.charade[950],
    onSecondary: colors.neutral[900],

    // Background — warm off-white app surface with white cards layered above it,
    // so cards read as elevated from the background tone itself, not shadow
    // alone. Sits a half-step below neutral[50] (#F6F4F0) so white cards
    // separate clearly without the bg reading as gray.
    background: '#F6F4F0',
    backgroundSecondary: colors.neutral[100],
    surface: colors.neutral[0],
    surfaceVariant: colors.neutral[100],

    // Text — three distinct, all WCAG-AA tones on the warm-white background.
    textPrimary: colors.neutral[900], // ~14:1
    textSecondary: colors.neutral[700], // ~7.5:1
    textTertiary: colors.neutral[600], // ~5.4:1 — distinct from secondary
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
    chipSelectedBackground: brand[300],
    chipSelectedText: onColor(
      brand[300],
      colors.neutral[0],
      colors.neutral[900],
    ),

    // Icon colors - semantic tokens for consistent icon styling
    iconPrimary: brand[500],
    iconSecondary: colors.neutral[600],
    iconTertiary: colors.neutral[500],
    iconDisabled: colors.neutral[400],
    iconOnPrimary: onColor(brand[500], colors.neutral[0], colors.neutral[900]),
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

    // Navigation bar active accent — charade-based. The bar background
    // (`secondaryDark`) stays dark in both themes; the active accent shifts
    // with the theme so theme switches are visible.
    navigationActive: colors.charade[600],
    // FloatingTabBar `+` button background — charade[500] is a muted accent
    // that harmonizes with the other charade-based nav elements without
    // overpowering them like the primary brand color did.
    navigationCta: colors.charade[500],
  },
};

export const darkTheme = {
  ...commonTheme,
  colors: {
    ...colors,
    // Primary — brand[500] for consistency with light mode.
    // primaryLight uses brand[400] @ 20% for a slightly brighter accent surface
    // since the deeper hue can swallow itself on dark backgrounds.
    primary: brand[500],
    primaryLight: brand[400] + '20',
    primaryDark: brand[600],
    onPrimary: onColor(brand[500], colors.neutral[0], colors.neutral[900]),
    onError: onColor(colors.error, colors.neutral[0], colors.neutral[900]),
    onSuccess: onColor(colors.success, colors.neutral[0], colors.neutral[900]),
    onWarning: onColor(colors.warning, colors.neutral[0], colors.neutral[900]),
    onInfo: onColor(colors.info, colors.neutral[0], colors.neutral[900]),

    // Secondary
    secondary: colors.charade[400],
    secondaryLight: colors.charade[200],
    secondaryDark: colors.charade[950],
    onSecondary: colors.neutral[0],

    // Background — warm charcoal app surface; surface/surfaceVariant step up
    // in lightness so layered cards read as elevated in dark mode too.
    background: colors.neutral[900],
    backgroundSecondary: colors.neutral[800],
    surface: colors.neutral[800],
    surfaceVariant: colors.neutral[700],

    // Text — three distinct tones on the warm-charcoal background.
    textPrimary: colors.neutral[50],
    textSecondary: colors.neutral[300],
    textTertiary: colors.neutral[400], // distinct, still high-contrast on dark
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
    chipSelectedBackground: brand[400],
    chipSelectedText: onColor(
      brand[400],
      colors.neutral[0],
      colors.neutral[900],
    ),

    // Icon colors - semantic tokens for consistent icon styling
    iconPrimary: brand[400],
    iconSecondary: colors.neutral[300],
    iconTertiary: colors.neutral[400],
    iconDisabled: colors.neutral[500],
    iconOnPrimary: onColor(brand[500], colors.neutral[0], colors.neutral[900]),
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

    // Pantry redesign colors — dark-mode override values (same key shape as light).
    // Solid backgrounds prevent swipeable container background bleed-through.
    expiration: darkExpiration,
    filterTab: darkFilterTab,
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

    // Navigation bar active accent — lighter charade step for dark mode so
    // the switch is visible against the (also-dark) bar background.
    navigationActive: colors.charade[300],
    // FloatingTabBar `+` button background — same charade[500] in both
    // themes so the CTA reads consistently against the dark bar bg.
    navigationCta: colors.charade[500],
  },
};

// Type exports
export type Theme = typeof lightTheme;
export type AnyTheme = typeof lightTheme | typeof darkTheme;
export type ThemeColors = Theme['colors'];
