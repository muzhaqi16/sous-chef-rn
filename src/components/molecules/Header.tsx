import React, { useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, IconName, IconLibrary } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';

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

export interface HeaderAction {
  icon: IconName;
  onPress: () => void;
  /** Semantic color variant (maps to theme colors) */
  variant?: ActionVariant;
  /** Direct color override (takes precedence over variant) */
  color?: string;
  /** Disable the action */
  disabled?: boolean;
  /** Show loading spinner instead of icon */
  loading?: boolean;
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
  const { theme } = useUnistyles();

  // Variant color mapping
  const getVariantColor = (
    actionVariant: ActionVariant = 'default',
  ): string => {
    const colorMap: Record<ActionVariant, string> = {
      default: theme.colors.textPrimary,
      primary: theme.colors.primary,
      secondary: theme.colors.textSecondary,
      success: theme.colors.success,
      error: theme.colors.error,
      warning: theme.colors.warning,
    };
    return colorMap[actionVariant];
  };

  // Apply variant presets
  const shouldCenterTitle =
    centerTitle ?? (variant === 'form' || variant === 'modal');
  const showTitle = title !== undefined && title !== '';
  const showBackButton = onBack && !onClose;
  const showCloseButton = onClose !== undefined;

  // Render a single action button
  const renderAction = (action: HeaderAction, index: number) => {
    const iconColor = action.color || getVariantColor(action.variant);

    const pressable = (
      <Pressable
        key={action.onMeasure ? undefined : index}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        onPress={action.onPress}
        disabled={action.disabled || action.loading}
        testID={action.testID}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {action.loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Icon
            name={action.icon}
            size={action.size || 24}
            color={action.disabled ? undefined : iconColor}
            tone={action.disabled ? 'textTertiary' : undefined}
            library={action.library}
          />
        )}
        {action.badge !== undefined && action.badge > 0 && (
          <View style={[commonStyles.badge, styles.badge]}>
            <Text style={commonStyles.badgeText}>{action.badge}</Text>
          </View>
        )}
      </Pressable>
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
    <View
      style={[
        commonStyles.header,
        transparent && styles.transparent,
        borderless && styles.borderless,
      ]}
    >
      {/* Left side */}
      <View style={styles.actions}>
        {!!showCloseButton && (
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="header-close-button"
          >
            <Icon name="close" size={24} tone="textPrimary" />
          </Pressable>
        )}
        {!!showBackButton && (
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            onPress={onBack}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            testID="header-back-button"
          >
            <Icon name="arrow-back" size={24} tone="textPrimary" />
          </Pressable>
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

  transparent: {
    backgroundColor: 'transparent',
  },

  borderless: {
    borderBottomWidth: 0,
  },

  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
