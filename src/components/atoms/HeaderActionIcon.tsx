import React from 'react';
import { ActivityIndicator } from 'react-native';
import { withUnistyles } from 'react-native-unistyles';
import { ThemedIcon } from '#components/atoms/themedComponents';
import type { IconName, IconLibrary, IconTone } from '#utils/iconUtils';

const ThemedActivityIndicator = withUnistyles(ActivityIndicator);

/**
 * Semantic color variants for header actions
 * Maps to theme colors for consistent styling
 */
export type ActionVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'warning';

/**
 * One action rendered in a screen-level action bar. The contract is shared by
 * every bar renderer — `Header` (flat icons with badge / spotlight support)
 * and `CollapsingHeroDetail` (circular chips) — and `HeaderActionIcon` below
 * is the single icon/spinner renderer both consume, so color precedence and
 * loading/disabled treatment cannot drift between bars.
 */
export interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  /** Semantic color variant (maps to theme colors) */
  variant?: ActionVariant;
  /** Direct color override (takes precedence over tone and variant) */
  color?: string;
  /** Theme tone for the icon (takes precedence over variant) */
  tone?: IconTone;
  /** Disable the action */
  disabled?: boolean;
  /** Show loading spinner instead of icon */
  loading?: boolean;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Badge count to display (Header bars) */
  badge?: number;
  /** Icon size (default: renderer-specific) */
  size?: number;
  /** Icon library */
  library?: IconLibrary;
  /** Test ID for automation */
  testID?: string;
  /** Layout measurement callback for positioning spotlight tutorials */
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
 * The icon-or-spinner of a HeaderAction, with the shared appearance rules:
 * disabled renders tertiary; explicit `color` beats `tone` beats `variant`;
 * the loading spinner takes the same resolved color. Theme colors resolve
 * through withUnistyles so they stay live across theme changes without
 * re-rendering the parent bar.
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
