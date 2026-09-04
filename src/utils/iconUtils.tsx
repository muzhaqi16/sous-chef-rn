import React from 'react';
import { sizes } from '#/theme/foundations/sizes';
import { Ionicons } from '@react-native-vector-icons/ionicons';
import { withUnistyles } from 'react-native-unistyles';
import type { Theme } from '#/theme/themes';

type IoniconsIconName = React.ComponentProps<typeof Ionicons>['name'];

export type IconName = IoniconsIconName;

// Kept for backward compatibility — all icons now use Ionicons
export type IconLibrary = string;

// withUnistyles wraps the third-party Ionicons component so its `color` prop
// can react to theme changes. RN core components are auto-patched by the
// Unistyles babel plugin, but third-party libraries are not — this is the
// canonical opt-in. uniProps is re-evaluated on every theme change and only
// this Icon re-renders, not the parent screen.
const ThemedIonicons = withUnistyles(Ionicons);

export const TONE_TO_COLOR = {
  primary: (t: Theme) => t.colors.primary,
  secondary: (t: Theme) => t.colors.secondary,
  border: (t: Theme) => t.colors.border,
  textPrimary: (t: Theme) => t.colors.textPrimary,
  textSecondary: (t: Theme) => t.colors.textSecondary,
  textTertiary: (t: Theme) => t.colors.textTertiary,
  textInverse: (t: Theme) => t.colors.textInverse,
  textOnSurfaceVariant: (t: Theme) => t.colors.textOnSurfaceVariant,
  error: (t: Theme) => t.colors.error,
  warning: (t: Theme) => t.colors.warning,
  expired: (t: Theme) => t.colors.expiration.expiredText,
  success: (t: Theme) => t.colors.success,
  info: (t: Theme) => t.colors.info,
  danger: (t: Theme) => t.colors.danger,
  iconPrimary: (t: Theme) => t.colors.iconPrimary,
  iconOnPrimary: (t: Theme) => t.colors.iconOnPrimary,
  iconDisabled: (t: Theme) => t.colors.iconDisabled,
  iconSecondary: (t: Theme) => t.colors.iconSecondary,
  iconTertiary: (t: Theme) => t.colors.iconTertiary,
  onPrimary: (t: Theme) => t.colors.onPrimary,
  onError: (t: Theme) => t.colors.onError,
  onScrim: (t: Theme) => t.colors.onScrim,
  background: (t: Theme) => t.colors.background,
  favorite: (t: Theme) => t.colors.favorite,
  rating: (t: Theme) => t.colors.rating,
  navigationActive: (t: Theme) => t.colors.navigationActive,
  // Nested paths need an entry here; a caller cannot express one as a key.
  alertBannerWarning: (t: Theme) => t.colors.alertBanner.warning.text,
};

export type IconTone = keyof typeof TONE_TO_COLOR;

/** A named step of `theme.sizes.icon`, resolved here so a call site need not. */
export type IconSizeName = keyof typeof sizes.icon;

interface IconProps {
  name: string;
  /** A named step, or a raw number where no step fits. */
  size?: number | IconSizeName;
  /** Static color (hex / rgba). Use `tone` for theme-derived colors. */
  color?: string;
  /** Theme-derived color that reactively updates when the user changes the
   * brand color or theme. Mutually exclusive with `color` — `tone` wins. */
  tone?: IconTone;
  library?: IconLibrary;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 'md',
  color,
  tone,
}) => {
  // A named step resolves from the THEME, not the foundation module: resolving
  // it here would freeze it exactly as a literal does, which is the thing the
  // name exists to avoid. A raw number is the caller's own decision and passes
  // through. `uniProps` wins over the prop, so the prop carries the fallback.
  const px = typeof size === 'number' ? size : sizes.icon[size];
  const sizeProps = (t: Theme) =>
    typeof size === 'number' ? {} : { size: t.sizes.icon[size] };
  // `color` is an explicit override and wins over `tone`. This supports the
  // pattern `<Icon color={maybeOverride} tone="textSecondary" />` where the
  // tone is the theme-reactive fallback when the override is undefined.
  if (color != null) {
    return (
      <ThemedIonicons
        name={name as IoniconsIconName}
        size={px}
        color={color}
        uniProps={t => sizeProps(t as Theme)}
      />
    );
  }
  if (tone) {
    const resolveColor = TONE_TO_COLOR[tone];
    return (
      <ThemedIonicons
        name={name as IoniconsIconName}
        size={px}
        uniProps={t => ({
          color: resolveColor(t as Theme),
          ...sizeProps(t as Theme),
        })}
      />
    );
  }
  // No explicit `color` or `tone`: the theme's primary text color, so icons
  // stay visible in dark mode. Never a hardcoded #000.
  return (
    <ThemedIonicons
      name={name as IoniconsIconName}
      size={px}
      uniProps={t => ({
        color: (t as Theme).colors.textPrimary,
        ...sizeProps(t as Theme),
      })}
    />
  );
};
