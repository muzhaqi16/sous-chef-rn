import React from 'react';
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

const TONE_TO_COLOR: Record<string, (t: Theme) => string> = {
  primary: t => t.colors.primary,
  secondary: t => t.colors.secondary,
  border: t => t.colors.border,
  textPrimary: t => t.colors.textPrimary,
  textSecondary: t => t.colors.textSecondary,
  textTertiary: t => t.colors.textTertiary,
  textInverse: t => t.colors.textInverse,
  textOnSurfaceVariant: t => t.colors.textOnSurfaceVariant,
  error: t => t.colors.error,
  warning: t => t.colors.warning,
  expired: t => t.colors.expiration.expiredText,
  success: t => t.colors.success,
  info: t => t.colors.info,
  danger: t => t.colors.danger,
  iconOnPrimary: t => t.colors.iconOnPrimary,
  iconDisabled: t => t.colors.iconDisabled,
  iconSecondary: t => t.colors.iconSecondary,
  iconTertiary: t => t.colors.iconTertiary,
  onPrimary: t => t.colors.onPrimary,
  background: t => t.colors.background,
  white: t => t.colors.white,
  black: t => t.colors.black,
  favorite: t => t.colors.favorite,
  rating: t => t.colors.rating,
  navigationActive: t => t.colors.navigationActive,
};

export type IconTone = keyof typeof TONE_TO_COLOR;

interface IconProps {
  name: string;
  size?: number;
  /** Static color (hex / rgba). Use `tone` for theme-derived colors. */
  color?: string;
  /** Theme-derived color that reactively updates when the user changes the
   * brand color or theme. Mutually exclusive with `color` — `tone` wins. */
  tone?: IconTone;
  library?: IconLibrary;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, color, tone }) => {
  // `color` is an explicit override and wins over `tone`. This supports the
  // pattern `<Icon color={maybeOverride} tone="textSecondary" />` where the
  // tone is the theme-reactive fallback when the override is undefined.
  if (color != null) {
    return (
      <Ionicons name={name as IoniconsIconName} size={size} color={color} />
    );
  }
  if (tone) {
    const resolveColor = TONE_TO_COLOR[tone];
    return (
      <ThemedIonicons
        name={name as IoniconsIconName}
        size={size}
        uniProps={t => ({ color: resolveColor(t as Theme) })}
      />
    );
  }
  // No explicit `color` or `tone`: the theme's primary text color, so icons
  // stay visible in dark mode. Never a hardcoded #000.
  return (
    <ThemedIonicons
      name={name as IoniconsIconName}
      size={size}
      uniProps={t => ({ color: (t as Theme).colors.textPrimary })}
    />
  );
};

// Imperative API — kept for the few callsites that build icon elements
// outside JSX. Not theme-reactive; pass a static `color` or migrate to <Icon>.
export const renderIcon = ({
  name,
  size = 24,
  color = '#000',
}: {
  name: string;
  size?: number;
  color?: string;
}): React.ReactElement => {
  return <Ionicons size={size} color={color} name={name as IoniconsIconName} />;
};
