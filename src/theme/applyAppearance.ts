import { UnistylesRuntime } from 'react-native-unistyles';
import { derivePalette, onColor } from './derivePalette';
import {
  layout as baseLayout,
  spacing as baseSpacing,
} from './foundations/spacing';
import { typography as baseTypography } from './foundations/typography';
import {
  MAX_FONT_SCALE,
  type as baseType,
  type TypeRole,
} from './foundations/type';
import { colors } from './foundations/colors';
import { lightTheme, darkTheme } from './themes';
import { PREFERENCE_DEFAULTS } from '#store/slices/preferenceTypes';
import type {
  FontScalePreference,
  DensityPreference,
} from '#store/slices/preferenceTypes';
import { DENSITY_META, FONT_SCALE_META } from './appearanceConfig';

/** Scales every role's size and leading, leaving weight and tracking alone. */
function scaleTypeRoles<T extends Record<string, TypeRole>>(
  roles: T,
  multiplier: number,
): T {
  const scaled = {} as Record<string, TypeRole>;
  for (const name in roles) {
    const role = roles[name];
    scaled[name] = {
      ...role,
      fontSize: Math.round(role.fontSize * multiplier),
      lineHeight: Math.round(role.lineHeight * multiplier),
    };
  }
  return scaled as T;
}

function scaleObject<T extends Record<string, number>>(
  obj: T,
  multiplier: number,
): T {
  const scaled = {} as Record<string, number>;
  for (const key in obj) {
    scaled[key] = Math.round(obj[key] * multiplier);
  }
  return scaled as T;
}

function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

export interface AppearancePreferences {
  primaryColorOverride: string | null;
  densityPreference: DensityPreference | null;
  fontScalePreference: FontScalePreference | null;
  highContrast: boolean;
}

/**
 * Applies brand color, density, font scale and high contrast to both themes.
 * A plain function, so a store setter can call it directly for an instant runtime
 * update with no effect/render delay.
 */
export function applyAppearanceToRuntime(prefs: AppearancePreferences): void {
  const densityMul =
    DENSITY_META[prefs.densityPreference ?? PREFERENCE_DEFAULTS.density]
      .multiplier;
  const fontMul =
    FONT_SCALE_META[prefs.fontScalePreference ?? PREFERENCE_DEFAULTS.fontScale]
      .multiplier;

  const buildNext = (themeName: 'light' | 'dark') => {
    const base = themeName === 'light' ? lightTheme : darkTheme;
    const next = {
      ...base,
      colors: { ...base.colors },
      spacing: scaleObject(baseSpacing, densityMul),
      layout: scaleObject(baseLayout, densityMul),
      typography: {
        ...base.typography,
        fontSize: scaleObject(baseTypography.fontSize, fontMul),
      },
      fonts: {
        ...base.fonts,
        size: scaleObject(baseTypography.fontSize, fontMul),
      },
      type: scaleTypeRoles(baseType, fontMul),
      // The OS text size multiplies on TOP of the app's own preference, so the
      // ceiling that keeps the product bounded is the remainder — applied once,
      // in the `Text` atom, rather than per element.
      maxFontScaleMultiplier: MAX_FONT_SCALE / fontMul,
    };

    if (prefs.primaryColorOverride) {
      const palette = derivePalette(prefs.primaryColorOverride);
      const isDark = themeName === 'dark';
      next.colors = {
        ...next.colors,
        // [500] is the palette anchor and matches the base theme's `primary` in
        // both modes; the rest mirror its per-mode shade mapping.
        primary: palette['500'],
        // The readable foreground follows the new brand's luminance, not the
        // theme: four of the seven pickable colours want dark text, three light.
        onPrimary: onColor(
          palette['500'],
          colors.neutral[0],
          colors.neutral[900],
        ),
        iconOnPrimary: onColor(
          palette['500'],
          colors.neutral[0],
          colors.neutral[900],
        ),
        chipSelectedText: onColor(
          isDark ? palette['400'] : palette['300'],
          colors.neutral[0],
          colors.neutral[900],
        ),
        primaryLight: isDark ? palette['400'] + '20' : palette['100'],
        primaryDark: isDark ? palette['600'] : palette['700'],
        iconPrimary: isDark ? palette['400'] : palette['500'],
        chipSelectedBackground: isDark ? palette['400'] : palette['300'],
        filterTab: {
          ...next.colors.filterTab,
          activeBg: palette['500'],
          filteredBg: isDark ? withAlpha(palette['400'], '26') : palette['50'],
          filteredText: isDark ? palette['300'] : palette['600'],
        },
        sectionHeader: {
          ...next.colors.sectionHeader,
          actionText: isDark ? palette['400'] : palette['500'],
        },
        avatar: {
          ...next.colors.avatar,
          gradientStart: palette['500'],
          gradientEnd: palette['400'],
          shadow: withAlpha(palette['500'], '4D'),
        },
      };
    }

    if (prefs.highContrast) {
      if (themeName === 'light') {
        next.colors = {
          ...next.colors,
          textPrimary: '#000000',
          textSecondary: '#1A1A1A',
          textTertiary: '#333333',
          // The default placeholder sits at ~3.6:1, exactly what high contrast
          // exists to lift — but kept lighter than textTertiary so it still reads
          // as a hint rather than entered text.
          inputPlaceholder: '#4D4D4D',
          border: '#666666',
          borderLight: '#999999',
          // A divider is a border by another name; without this it stays at the
          // default contrast while every other edge lifts.
          divider: '#999999',
        };
      } else {
        next.colors = {
          ...next.colors,
          textPrimary: '#FFFFFF',
          textSecondary: '#E0E0E0',
          textTertiary: '#CCCCCC',
          inputPlaceholder: '#B3B3B3',
          border: '#999999',
          borderLight: '#666666',
          divider: '#666666',
        };
      }
    }

    return next;
  };

  UnistylesRuntime.updateTheme('light', () => buildNext('light'));
  UnistylesRuntime.updateTheme('dark', () => buildNext('dark'));
}
