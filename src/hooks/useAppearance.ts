import { useEffect } from 'react';
import { UnistylesRuntime } from 'react-native-unistyles';
import { useAppStore, useIsHydrated } from '#store/useAppStore';
import { derivePalette } from '#/theme/derivePalette';
import { spacing as baseSpacing } from '#/theme/foundations/spacing';
import { typography as baseTypography } from '#/theme/foundations/typography';
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
    const needsSpacingUpdate = densityMul !== 1.0;
    const needsFontUpdate = fontMul !== 1.0;

    const updateTheme = (themeName: 'light' | 'dark') => {
      UnistylesRuntime.updateTheme(themeName, currentTheme => {
        const updated = { ...currentTheme };

        // Brand color override
        if (primaryColorOverride) {
          const palette = derivePalette(primaryColorOverride);
          updated.colors = {
            ...updated.colors,
            primary: palette['400'],
            primaryLight:
              themeName === 'dark' ? palette['400'] + '20' : palette['100'],
            primaryDark: themeName === 'dark' ? palette['600'] : palette['700'],
            iconPrimary: themeName === 'dark' ? palette['400'] : palette['500'],
            chipSelectedBackground:
              themeName === 'dark' ? palette['400'] : palette['300'],
          };
        }

        // Density
        if (needsSpacingUpdate) {
          updated.spacing = scaleObject(baseSpacing, densityMul);
        }

        // Font scale
        if (needsFontUpdate) {
          updated.typography = {
            ...updated.typography,
            fontSize: scaleObject(baseTypography.fontSize, fontMul),
          };
          updated.fonts = {
            ...updated.fonts,
            size: scaleObject(baseTypography.fontSize, fontMul),
          };
        }

        // High contrast — boost text contrast + border visibility
        if (highContrast) {
          if (themeName === 'light') {
            updated.colors = {
              ...updated.colors,
              textPrimary: '#000000',
              textSecondary: '#1A1A1A',
              textTertiary: '#333333',
              border: '#666666',
              borderLight: '#999999',
            };
          } else {
            updated.colors = {
              ...updated.colors,
              textPrimary: '#FFFFFF',
              textSecondary: '#E0E0E0',
              textTertiary: '#CCCCCC',
              border: '#999999',
              borderLight: '#666666',
            };
          }
        }

        return updated;
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
