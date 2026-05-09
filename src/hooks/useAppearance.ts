import { useEffect } from 'react';
import { UnistylesRuntime } from 'react-native-unistyles';
import { useAppStore, useIsHydrated } from '#store/useAppStore';
import { derivePalette } from '#/theme/derivePalette';
import { spacing as baseSpacing } from '#/theme/foundations/spacing';
import { typography as baseTypography } from '#/theme/foundations/typography';
import { lightTheme, darkTheme } from '#/theme/themes';
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

// Append a 2-digit hex alpha to a #RRGGBB color produced by chroma-js.
function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/**
 * Applies user appearance preferences (brand color, density, font scale,
 * high contrast) to both light and dark themes via UnistylesRuntime.updateTheme.
 *
 * Mount once in App.tsx under the Unistyles provider. Reacts to MMKV-persisted
 * preference changes — no remount needed.
 */
export function useAppearance() {
  const isHydrated = useIsHydrated();
  const primaryColorOverride = useAppStore(s => s.primaryColorOverride);
  const densityPreference = useAppStore(s => s.densityPreference);
  const fontScalePreference = useAppStore(s => s.fontScalePreference);
  const highContrast = useAppStore(s => s.highContrast);

  useEffect(() => {
    if (!isHydrated) return;

    const densityMul = DENSITY_MULTIPLIER[densityPreference ?? 'comfortable'];
    const fontMul = FONT_SCALE_MULTIPLIER[fontScalePreference ?? 'system'];

    const updateTheme = (themeName: 'light' | 'dark') => {
      UnistylesRuntime.updateTheme(themeName, () => {
        // Always rebuild from the original base theme so reverting an override
        // (brand color back to default, density to comfortable, etc.) actually
        // resets — `updateTheme` mutates, so the previous run's overlays would
        // otherwise stick around until app reload.
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

        // Brand color override
        if (primaryColorOverride) {
          const palette = derivePalette(primaryColorOverride);
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
              filteredBg: isDark
                ? withAlpha(palette['400'], '26')
                : palette['50'],
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

        // High contrast — boost text contrast + border visibility
        if (highContrast) {
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
      });
    };

    updateTheme('light');
    updateTheme('dark');
  }, [
    primaryColorOverride,
    densityPreference,
    fontScalePreference,
    highContrast,
    isHydrated,
  ]);
}
