import { UnistylesRuntime } from 'react-native-unistyles';
import { derivePalette } from './derivePalette';
import { spacing as baseSpacing } from './foundations/spacing';
import { typography as baseTypography } from './foundations/typography';
import { lightTheme, darkTheme } from './themes';
import type {
  DensityPreference,
  FontScalePreference,
} from '#store/slices/preferencesSlice';

const DENSITY_MULTIPLIER: Record<DensityPreference, number> = {
  compact: 0.85,
  comfortable: 1.0,
  spacious: 1.15,
};

const FONT_SCALE_MULTIPLIER: Record<FontScalePreference, number> = {
  system: 1.0,
  sm: 0.9,
  md: 1.0,
  lg: 1.15,
  xl: 1.3,
};

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
    DENSITY_MULTIPLIER[prefs.densityPreference ?? 'comfortable'];
  const fontMul = FONT_SCALE_MULTIPLIER[prefs.fontScalePreference ?? 'system'];

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
        primary: palette['400'],
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
          border: '#666666',
          borderLight: '#999999',
        };
      } else {
        next.colors = {
          ...next.colors,
          textPrimary: '#FFFFFF',
          textSecondary: '#E0E0E0',
          textTertiary: '#CCCCCC',
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
