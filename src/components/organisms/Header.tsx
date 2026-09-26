import React, { useRef, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from '#/i18n';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { OfflineStatusPill } from '#components/molecules/OfflineStatusPill';
import { HeaderActionIcon } from '#components/molecules/HeaderActionIcon';
import type { HeaderAction } from '#components/molecules/HeaderActionIcon';
import { kitTestIDs } from '#components/testIDs';
import { hitSlop } from '#/theme/foundations/sizes';

// ============================================
// Types
// ============================================

// The per-action contract (HeaderAction) and its icon/spinner renderer live
// in #components/atoms/HeaderActionIcon, shared with CollapsingHeroDetail's
// chips — import them from there.

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
  /**
   * Arbitrary right-side content, for a header whose action is not an icon —
   * a Save affordance, a text button. Renders after `rightActions`.
   */
  rightElement?: React.ReactNode;
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
  rightElement,
  centerTitle,
  onBack,
  onClose,
  borderless = false,
}) => {
  const { t } = useTranslation();
  styles.useVariants({ borderless });

  const showTitle = title !== undefined && title !== '';
  const showBackButton = onBack && !onClose;
  const showCloseButton = onClose !== undefined;

  // `align: center` only centres within the title's box, which sits between
  // the two action groups; padding the narrower side centres it on the bar.
  const [sideWidths, setSideWidths] = useState({ left: 0, right: 0 });
  const trackSide =
    (side: 'left' | 'right') =>
    ({ nativeEvent }: LayoutChangeEvent) => {
      const { width } = nativeEvent.layout;
      setSideWidths(prev =>
        prev[side] === width ? prev : { ...prev, [side]: width },
      );
    };
  const leftImbalance = centerTitle
    ? Math.max(0, sideWidths.right - sideWidths.left)
    : 0;
  const rightImbalance = centerTitle
    ? Math.max(0, sideWidths.left - sideWidths.right)
    : 0;

  // Render a single action button
  const renderAction = (action: HeaderAction, index: number) => {
    const pressable = (
      <AppPressable
        key={action.onMeasure ? undefined : index}
        style={styles.action}
        onPress={action.onPress}
        disabled={!!action.disabled || !!action.loading}
        testID={action.testID}
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel}
        hitSlop={hitSlop.lg}
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
    <View
      style={[
        commonStyles.header,
        commonStyles.barInset,
        styles.headerOverrides,
      ]}
    >
      {/* Left side */}
      <View style={styles.actions} onLayout={trackSide('left')}>
        {!!showCloseButton && (
          <AppPressable
            style={styles.action}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('labels.close')}
            hitSlop={hitSlop.lg}
            testID={kitTestIDs.headerCloseButton}
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
            hitSlop={hitSlop.lg}
            testID={kitTestIDs.headerBackButton}
          >
            <Icon name="arrow-back" size={24} tone="textPrimary" />
          </AppPressable>
        )}
        {leftActions.map(renderAction)}
      </View>
      {/* Title */}
      {showTitle ? (
        <Text
          role="heading"
          align={centerTitle ? 'center' : undefined}
          style={styles.title(leftImbalance, rightImbalance)}
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
      <View style={styles.actions} onLayout={trackSide('right')}>
        <OfflineStatusPill size={22} />
        {rightActions.map(renderAction)}
        {rightElement}
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
      borderless: {
        true: { borderBottomWidth: theme.borderWidth.none },
      },
    },
  },
  title: (leftImbalance: number, rightImbalance: number) => ({
    flex: 1,
    marginLeft: theme.spacing.sm + leftImbalance,
    marginRight: theme.spacing.sm + rightImbalance,
  }),
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
}));
