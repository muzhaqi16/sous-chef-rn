import React from 'react';

import {
  ThemedActivityIndicator,
  ThemedIcon,
} from '#components/atoms/themedComponents';
import type { IconName, IconLibrary, IconTone } from '#utils/iconUtils';

export type ActionVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning';

/**
 * One action in a screen-level action bar, shared by every bar renderer
 * (`Header`, `CollapsingHeroDetail`) so color precedence and loading/disabled
 * treatment cannot drift between them.
 */
export interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  variant?: ActionVariant;
  /** Beats `tone` and `variant`. */
  color?: string;
  /** Beats `variant`. */
  tone?: IconTone;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  /** Header bars only. */
  badge?: number;
  size?: number;
  library?: IconLibrary;
  testID?: string;
  /** Layout measurement for positioning spotlight tutorials. */
  onMeasure?: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
}

type ActionColorTheme = {
  colors: {
    textPrimary: string;
    textSecondary: string;
    primary: string;
    success: string;
    error: string;
    warning: string;
  };
};

function resolveVariantColor(
  variant: ActionVariant = 'default',
  t: ActionColorTheme,
): string {
  switch (variant) {
    case 'primary':
      return t.colors.primary;
    case 'secondary':
      return t.colors.textSecondary;
    case 'success':
      return t.colors.success;
    case 'error':
      return t.colors.error;
    case 'warning':
      return t.colors.warning;
    case 'default':
    default:
      return t.colors.textPrimary;
  }
}

interface HeaderActionIconProps {
  action: HeaderAction;
  /** Icon size when the action doesn't specify one. */
  defaultSize?: number;
}

/**
 * Shared appearance rules: disabled renders tertiary, `color` beats `tone` beats
 * `variant`, the spinner takes the same resolved color. Colors resolve through
 * withUnistyles so a theme change doesn't re-render the parent bar.
 */
export const HeaderActionIcon: React.FC<HeaderActionIconProps> = ({
  action,
  defaultSize = 24,
}) => {
  if (action.loading) {
    return (
      <ThemedActivityIndicator
        size="small"
        uniProps={t => ({
          color: action.color ?? resolveVariantColor(action.variant, t),
        })}
      />
    );
  }

  const tone = action.disabled
    ? 'textTertiary'
    : action.color
    ? undefined
    : action.tone;

  return (
    <ThemedIcon
      name={action.icon}
      size={action.size ?? defaultSize}
      library={action.library}
      tone={tone}
      uniProps={t => ({
        color:
          action.disabled || tone
            ? undefined
            : action.color ?? resolveVariantColor(action.variant, t),
      })}
    />
  );
};
