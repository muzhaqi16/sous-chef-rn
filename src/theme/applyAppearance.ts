import { UnistylesRuntime } from 'react-native-unistyles';
import { derivePalette } from './derivePalette';
import { spacing as baseSpacing } from './foundations/spacing';
import { typography as baseTypography } from './foundations/typography';
import { lightTheme, darkTheme } from './themes';
import { PREFERENCE_DEFAULTS } from '#store/slices/preferenceTypes';
import type {
  FontScalePreference,
  DensityPreference,
} from '#store/slices/preferenceTypes';
import { DENSITY_META, FONT_SCALE_META } from './appearanceConfig';

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
 * Applies user appearance preferences (brand color, density, font scale,
 * high contrast) to both light and dark themes via UnistylesRuntime.updateTheme.
 *
 * Plain function (no React hooks) so it can be called both from the
 * useAppearance effect AND directly from store setters — the setter path
 * gives an instant runtime update with no useEffect/render delay.
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
      typography: {
        ...base.typography,
        fontSize: scaleObject(baseTypography.fontSize, fontMul),
      },
      fonts: {
        ...base.fonts,
        size: scaleObject(baseTypography.fontSize, fontMul),
      },
    };

    if (prefs.primaryColorOverride) {
      const palette = derivePalette(prefs.primaryColorOverride);
      const isDark = themeName === 'dark';
      next.colors = {
        ...next.colors,
        // [500] is the palette anchor (≈ the color the user picked) and matches
        // the base theme's `primary` in both light and dark modes — the rest of
        // these overrides mirror the base theme's per-mode shade mapping.
        primary: palette['500'],
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
          // Boosted alongside the text tones — the default placeholder sits at
          // ~3.6:1, which is exactly what high contrast exists to lift. Kept
          // lighter than textTertiary so a placeholder still reads as a hint
          // rather than as entered text.
          inputPlaceholder: '#4D4D4D',
          border: '#666666',
          borderLight: '#999999',
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
        };
      }
    }

    return next;
  };

  UnistylesRuntime.updateTheme('light', () => buildNext('light'));
  UnistylesRuntime.updateTheme('dark', () => buildNext('dark'));
}
