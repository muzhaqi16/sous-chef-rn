import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from '#/i18n';
import { StyleSheet } from 'react-native-unistyles';
import { commonStyles } from '#/styles/commonStyles';
import { Text } from '#components/atoms/Text';
import { Pressable } from '#components/atoms/themedComponents';
import { OfflineStatusPill } from '#components/molecules/OfflineStatusPill';
import { BarActions, type BarAction } from '#components/molecules/BarActions';
import { kitTestIDs } from '#components/testIDs';

interface HeaderProps {
  /** Screen title (optional for detail variant) */
  title?: string;
  /** Center the title */
  centerTitle?: boolean;
  /** Back button handler (shows ← arrow) */
  onBack?: () => void;
  /** Close button handler (shows ✕, takes precedence over onBack) */
  onClose?: () => void;
  /** The title opens something, such as a picker. */
  onTitlePress?: () => void;
  /** Beside a pressable title, saying what it opens (a chevron). */
  titleAccessory?: React.ReactNode;
  /** Trailing actions, icon or text; `BarActions` owns their geometry. */
  rightActions?: BarAction[];
  /** Hide bottom border */
  borderless?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  rightActions,
  centerTitle,
  onTitlePress,
  titleAccessory,
  onBack,
  onClose,
  borderless = false,
}) => {
  const { t } = useTranslation();
  styles.useVariants({ borderless });

  const showTitle = title !== undefined && title !== '';
  const leading: BarAction[] = onClose
    ? [
        {
          icon: 'close',
          accessibilityLabel: t('labels.close'),
          onPress: onClose,
          testID: kitTestIDs.headerCloseButton,
        },
      ]
    : onBack
    ? [
        {
          icon: 'arrow-back',
          accessibilityLabel: t('labels.goBack'),
          onPress: onBack,
          testID: kitTestIDs.headerBackButton,
        },
      ]
    : [];

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

  return (
    <View
      style={[
        commonStyles.header,
        commonStyles.barInset,
        styles.headerOverrides,
      ]}
    >
      <BarActions actions={leading} onLayout={trackSide('left')} />
      {/* Title */}
      {showTitle && onTitlePress ? (
        <Pressable
          onPress={onTitlePress}
          accessibilityRole="button"
          style={[
            styles.title(leftImbalance, rightImbalance),
            styles.titleButton(!!centerTitle),
          ]}
          testID={kitTestIDs.headerTitleButton}
        >
          <Text role="heading" numberOfLines={1} style={styles.titleText}>
            {title}
          </Text>
          {titleAccessory}
        </Pressable>
      ) : showTitle ? (
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
      <BarActions
        leading={<OfflineStatusPill size={22} />}
        actions={rightActions}
        onLayout={trackSide('right')}
      />
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
  titleButton: (centered: boolean) => ({
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: centered ? 'center' : 'flex-start',
    gap: theme.spacing.xs,
  }),
  // Shrinks before the accessory, so a long title ellipsizes beside it.
  titleText: {
    flexShrink: 1,
  },
  titleSpacer: {
    flex: 1,
  },
}));
