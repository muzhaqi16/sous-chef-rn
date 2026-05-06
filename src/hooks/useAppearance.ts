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

// Append a 2-digit hex alpha to a #RRGGBB color produced by chroma-js.
function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/**
 * Subscribes the calling component to appearance preference changes
 * (brand color, density, font scale, high contrast). Returns a stable string
 * that changes whenever any pref changes — the consumer re-renders on change,
 * which re-evaluates inline `theme.colors.X` reads in JSX props that Unistyles'
 * native style updates can't reach (Icon `color`, action button `color`, etc.).
 *
 * Use in shared screen-lifecycle hooks (e.g. useTabScreenLifecycle) so every
 * tab/stack screen built on top of them updates immediately on brand-color
 * change without waiting for re-mount.
 */
export function useAppearanceSubscription(): string {
  const primaryColorOverride = useAppStore(s => s.primaryColorOverride);
  const densityPreference = useAppStore(s => s.densityPreference);
  const fontScalePreference = useAppStore(s => s.fontScalePreference);
  const highContrast = useAppStore(s => s.highContrast);
  return `${primaryColorOverride ?? ''}|${densityPreference ?? ''}|${
    fontScalePreference ?? ''
  }|${highContrast ? 1 : 0}`;
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
          const isDark = themeName === 'dark';
          updated.colors = {
            ...updated.colors,
            primary: palette['400'],
            primaryLight: isDark ? palette['400'] + '20' : palette['100'],
            primaryDark: isDark ? palette['600'] : palette['700'],
            iconPrimary: isDark ? palette['400'] : palette['500'],
            chipSelectedBackground: isDark ? palette['400'] : palette['300'],
            filterTab: {
              ...updated.colors.filterTab,
              activeBg: palette['500'],
              filteredBg: isDark
                ? withAlpha(palette['400'], '26')
                : palette['50'],
              filteredText: isDark ? palette['300'] : palette['600'],
            },
            sectionHeader: {
              ...updated.colors.sectionHeader,
              actionText: isDark ? palette['400'] : palette['500'],
            },
            avatar: {
              ...updated.colors.avatar,
              gradientStart: palette['500'],
              gradientEnd: palette['400'],
              shadow: withAlpha(palette['500'], '4D'),
            },
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
