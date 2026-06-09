import React, { useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { ThemedIcon } from '#components/atoms/themedComponents';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet, withUnistyles } from 'react-native-unistyles';
import { Icon, IconName, IconLibrary, type IconTone } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';

const ThemedActivityIndicator = withUnistyles(ActivityIndicator);

// ============================================
// Types
// ============================================

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
 * Header preset variants for common screen patterns
 */
export type HeaderVariant = 'default' | 'detail' | 'form' | 'modal';

type HeaderTheme = {
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
  t: HeaderTheme,
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

export interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  /** Semantic color variant (maps to theme colors) */
  variant?: ActionVariant;
  /** Direct color override (takes precedence over variant) */
  color?: string;
  /** Theme tone for the icon — used by chip-style renderers like
   *  `CollapsingHeroDetail` (takes precedence over `variant`). */
  tone?: IconTone;
  /** Disable the action */
  disabled?: boolean;
  /** Show loading spinner instead of icon */
  loading?: boolean;
  /** Accessibility label for screen readers (chip-style renderers). */
  accessibilityLabel?: string;
  /** Badge count to display */
  badge?: number;
  /** Icon size (default: 24) */
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

interface HeaderProps {
  /** Screen title (optional for detail variant) */
  title?: string;
  /** Center the title */
  centerTitle?: boolean;
  /** Back button handler (shows ← arrow) */
  onBack?: () => void;
  /** Close button handler (shows ✕, takes precedence over onBack) */
  onClose?: () => void;
  /** Left side actions */
  leftActions?: HeaderAction[];
  /** Right side actions */
  rightActions?: HeaderAction[];
  /** Preset variant for common patterns */
  variant?: HeaderVariant;
  /** Transparent background */
  transparent?: boolean;
  /** Hide bottom border */
  borderless?: boolean;
}

// ============================================
// Measurement wrapper for spotlight tutorials
// ============================================

const MeasuredHeaderAction: React.FC<{
  onMeasure: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  children: React.ReactNode;
}> = ({ onMeasure, children }) => {
  const ref = useRef<View>(null);
  return (
    <View
      ref={ref}
      collapsable={false}
      onLayout={() => {
        requestAnimationFrame(() => {
          ref.current?.measure((_x, _y, w, h, pageX, pageY) => {
            if (w > 0 && h > 0) {
              onMeasure({ x: pageX, y: pageY, width: w, height: h });
            }
          });
        });
      }}
    >
      {children}
    </View>
  );
};

// ============================================
// Component
// ============================================

export const Header: React.FC<HeaderProps> = ({
  title,
  leftActions = [],
  rightActions = [],
  centerTitle,
  onBack,
  onClose,
  variant = 'default',
  transparent = false,
  borderless = false,
}) => {
  styles.useVariants({ transparent, borderless });

  // Apply variant presets
  const shouldCenterTitle =
    centerTitle ?? (variant === 'form' || variant === 'modal');
  const showTitle = title !== undefined && title !== '';
  const showBackButton = onBack && !onClose;
  const showCloseButton = onClose !== undefined;

  // Render a single action button
  const renderAction = (action: HeaderAction, index: number) => {
    const pressable = (
      <AppPressable
        key={action.onMeasure ? undefined : index}
        style={styles.action}
        onPress={action.onPress}
        disabled={action.disabled || action.loading}
        testID={action.testID}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {action.loading ? (
          <ThemedActivityIndicator
            size="small"
            uniProps={t => ({
              color: action.color ?? resolveVariantColor(action.variant, t),
            })}
          />
        ) : (
          <ThemedIcon
            name={action.icon}
            size={action.size || 24}
            library={action.library}
            tone={action.disabled ? 'textTertiary' : undefined}
            uniProps={t => ({
              color: action.disabled
                ? undefined
                : action.color ?? resolveVariantColor(action.variant, t),
            })}
          />
        )}
        {action.badge !== undefined && action.badge > 0 && (
          <View style={[commonStyles.badge, styles.badge]}>
            <Text style={commonStyles.badgeText}>{action.badge}</Text>
          </View>
        )}
      </AppPressable>
    );

    if (action.onMeasure) {
      return (
        <MeasuredHeaderAction key={index} onMeasure={action.onMeasure}>
          {pressable}
        </MeasuredHeaderAction>
      );
    }

    return pressable;
  };

  return (
    <View style={[commonStyles.header, styles.headerOverrides]}>
      {/* Left side */}
      <View style={styles.actions}>
        {!!showCloseButton && (
          <AppPressable
            style={styles.action}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="header-close-button"
          >
            <Icon name="close" size={24} tone="textPrimary" />
          </AppPressable>
        )}
        {!!showBackButton && (
          <AppPressable
            style={styles.action}
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="header-back-button"
          >
            <Icon name="arrow-back" size={24} tone="textPrimary" />
          </AppPressable>
        )}
        {leftActions.map(renderAction)}
      </View>
      {/* Title */}
      {showTitle ? (
        <Text
          size="lg"
          weight="semibold"
          align={shouldCenterTitle ? 'center' : undefined}
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : (
        <View style={styles.titleSpacer} />
      )}
      {/* Right side */}
      <View style={styles.actions}>{rightActions.map(renderAction)}</View>
    </View>
  );
};

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create(theme => ({
  headerOverrides: {
    variants: {
      transparent: {
        true: { backgroundColor: 'transparent' },
      },
      borderless: {
        true: { borderBottomWidth: 0 },
      },
    },
  },
  title: {
    flex: 1,
    marginHorizontal: theme.spacing.sm,
  },
  titleSpacer: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  action: {
    padding: theme.spacing.xs,
    position: 'relative',
    minWidth: theme.sizes.touchTarget.md,
    minHeight: theme.sizes.touchTarget.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    backgroundColor: theme.colors.error,
    borderRadius: theme.radii.lg,
    minWidth: theme.spacing['5'],
    height: theme.spacing['5'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
