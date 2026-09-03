import React, { useRef } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { OfflineStatusPill } from '#components/atoms/OfflineStatusPill';
import { HeaderActionIcon } from '#components/atoms/HeaderActionIcon';
import type { HeaderAction } from '#components/atoms/HeaderActionIcon';

// ============================================
// Types
// ============================================

// The per-action contract (HeaderAction) and its icon/spinner renderer live
// in #components/atoms/HeaderActionIcon, shared with CollapsingHeroDetail's
// chips — import them from there.

/**
 * Header preset variants for common screen patterns
 */
export type HeaderVariant = 'default' | 'detail' | 'form' | 'modal';

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
  const { t } = useTranslation();
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
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <HeaderActionIcon action={action} />
        {action.badge !== undefined && action.badge > 0 && (
          <View style={[commonStyles.badge, styles.badge]}>
            {/* `styles.badge` overrides the fill to `error`, so the digit
                takes `onError`, not the shared `onPrimary`. */}
            <Text style={[commonStyles.badgeText, styles.badgeText]}>
              {action.badge}
            </Text>
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
            accessibilityRole="button"
            accessibilityLabel={t('labels.close')}
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
            accessibilityRole="button"
            accessibilityLabel={t('labels.goBack')}
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
      {/* The offline pill leads the action group, so every screen using this
          header carries the signal rather than just the tab headers. Renders
          null when online, so screens with no actions are unaffected. */}
      <View style={styles.actions}>
        <OfflineStatusPill size={22} />
        {rightActions.map(renderAction)}
      </View>
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
        true: { borderBottomWidth: theme.borderWidth.none },
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
  badgeText: {
    color: theme.colors.onError,
  },
  badge: {
    position: 'absolute',
    top: -theme.spacing.xs,
    right: -theme.spacing.xs,
    backgroundColor: theme.colors.error,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    minWidth: theme.spacing.mdPlus,
    height: theme.spacing.mdPlus,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
