import { UnistylesRuntime } from 'react-native-unistyles';
import {
  carriesReadableContent,
  derivePalette,
  foregroundShade,
  onColor,
  paintedTint,
} from './foundations/derivePalette';
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
import { brand } from './foundations/brand';
import { colors } from './foundations/colors';
import { lightTheme, darkTheme } from './themes';
import {
  PREFERENCE_DEFAULTS,
  ThemePreference,
} from '#store/slices/preferenceTypes';
import type { AppearanceSettings } from '#platform/ports';
import { logger } from '#/utils/environment';
import { DENSITY_META, FONT_SCALE_META } from './foundations/appearanceConfig';

/** Scales every role's size and leading, leaving weight and tracking alone. */
function scaleTypeRoles<T extends Record<string, TypeRole>>(
  roles: T,
  multiplier: number,
): T {
  const scaled: Record<string, TypeRole> = {};
  for (const [name, role] of Object.entries(roles)) {
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
  const scaled: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    scaled[key] = Math.round(value * multiplier);
  }
  return scaled as T;
}

/** The dark theme's `primaryLight`: the brand at this alpha over the page. */
const PRIMARY_LIGHT_ALPHA_HEX = '20';
const PRIMARY_LIGHT_ALPHA = parseInt(PRIMARY_LIGHT_ALPHA_HEX, 16) / 255;

function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

/**
 * Applies brand color, density, font scale and high contrast to both themes.
 * A plain function, so a store setter can call it directly for an instant runtime
 * update with no effect/render delay.
 */
export function applyAppearanceToRuntime(prefs: AppearanceSettings): void {
  const densityMul =
    DENSITY_META[prefs.densityPreference ?? PREFERENCE_DEFAULTS.density]
      .multiplier;
  const fontMul =
    FONT_SCALE_META[prefs.fontScalePreference ?? PREFERENCE_DEFAULTS.fontScale]
      .multiplier;
  // A saved colour no content reads on (Teal, before it was withdrawn) falls
  // back to the default brand.
  const picked = prefs.primaryColorOverride;
  const override =
    picked !== null &&
    carriesReadableContent(picked, colors.neutral[0], colors.neutral[900])
      ? picked
      : null;

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

    if (override) {
      const palette = derivePalette(override);
      const isDark = themeName === 'dark';
      const onFill = onColor(
        palette['500'],
        colors.neutral[0],
        colors.neutral[900],
      );
      const primaryText = foregroundShade(
        palette,
        [
          base.colors.background,
          base.colors.backgroundSecondary,
          base.colors.surface,
        ],
        isDark ? '500' : '700',
        isDark ? 'lighter' : 'darker',
      );
      next.colors = {
        ...next.colors,
        // [500] is the colour the user picked; the rest mirror the per-mode shade
        // mapping. Its foreground follows the colour's luminance, not the theme.
        primary: palette['500'],
        onPrimary: onFill,
        iconOnPrimary: onFill,
        chipSelectedText: onColor(
          isDark ? palette['400'] : palette['300'],
          colors.neutral[0],
          colors.neutral[900],
        ),
        primaryLight: isDark
          ? palette['400'] + PRIMARY_LIGHT_ALPHA_HEX
          : palette['100'],
        primaryDark: isDark ? palette['600'] : palette['700'],
        primaryText,
        onPrimaryLight: isDark
          ? foregroundShade(
              palette,
              [base.colors.background, base.colors.surface].map(ground =>
                paintedTint(palette['400'], PRIMARY_LIGHT_ALPHA, ground),
              ),
              '300',
              'lighter',
            )
          : foregroundShade(palette, [palette['100']], '800', 'darker'),
        iconPrimary: isDark ? palette['400'] : primaryText,
        chipSelectedBackground: isDark ? palette['400'] : palette['300'],
        filterTab: {
          ...next.colors.filterTab,
          activeBg: palette['500'],
          activeText: onFill,
          filteredBg: isDark ? withAlpha(palette['400'], '26') : palette['50'],
          filteredText: isDark
            ? palette['300']
            : foregroundShade(palette, [palette['50']], '600', 'darker'),
        },
      };
    }

    // High Contrast lifts the one pairing the default brand keeps below AA by
    // decision: the logo orange as a fill under white and as text on the page.
    if (prefs.highContrast && !override) {
      const isLight = themeName === 'light';
      next.colors = {
        ...next.colors,
        primary: brand[700],
        ...(isLight && {
          primaryText: brand[700],
          iconPrimary: brand[700],
          onPrimaryLight: brand[800],
        }),
        filterTab: {
          ...next.colors.filterTab,
          activeBg: brand[700],
          ...(isLight && { filteredText: brand[700] }),
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

/**
 * The one theme preference → `UnistylesRuntime` translation, shared by the
 * `setTheme` action and the post-rehydration sync, so the two cannot diverge.
 */
export function applyThemeToRuntime(theme: ThemePreference): void {
  try {
    if (theme === ThemePreference.SYSTEM) {
      UnistylesRuntime.setAdaptiveThemes(true);
    } else {
      UnistylesRuntime.setAdaptiveThemes(false);
      const target = theme === ThemePreference.DARK ? 'dark' : 'light';
      if (UnistylesRuntime.themeName !== target) {
        UnistylesRuntime.setTheme(target);
      }
    }
  } catch (e) {
    if (__DEV__) logger.warn('[applyThemeToRuntime] error:', e);
  }
}
