import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { SwipeableItem } from '#components/organisms/SwipeableItem/SwipeableItem';
import { HapticService } from '#services/haptic/HapticService';
import { RIPPLE } from '#constants/ripple';
import type { BaseItemCardProps, CardVariant } from './types';

// Slot-based swipeable row; `ItemCard` is the one with the standard
// title/subtitle/badge layout and automatic slide-off-screen exit. Row actions
// are DESCRIPTORS (`leftActions` / `rightActions`), never named verbs.

// `CardSurface` is extracted so `BaseItemCard` itself keeps compiling: Unistyles'
// variant transform bails the React Compiler out of whichever function holds the
// `useVariants` call, and this is the row behind every list in the app.
const CardSurface: React.FC<{
  variant: CardVariant;
  containerStyle?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}> = ({ variant, containerStyle, testID, children }) => {
  styles.useVariants({ variant });
  return (
    <View style={[styles.container, containerStyle]} testID={testID}>
      {children}
    </View>
  );
};

export const BaseItemCard: React.FC<BaseItemCardProps> = ({
  leftElement,
  children,
  rightElement,
  variant = 'normal',
  containerStyle,
  onPress,
  leftActions,
  rightActions,
  onSwipeableWillOpen,
  onSwipeableClose,
  leftThreshold = 80,
  rightThreshold = 80,
  itemId,
  testID,
}) => {
  const slotChildren: React.ReactNode[] = [];
  if (leftElement)
    slotChildren.push(
      <React.Fragment key="left">{leftElement}</React.Fragment>,
    );
  if (children)
    slotChildren.push(
      <React.Fragment key="content">{children}</React.Fragment>,
    );
  if (rightElement)
    slotChildren.push(
      <React.Fragment key="right">{rightElement}</React.Fragment>,
    );

  const cardContent = (
    <CardSurface
      variant={variant}
      containerStyle={containerStyle}
      testID={testID}
    >
      {slotChildren}
    </CardSurface>
  );

  const hasSwipeActions = !!leftActions?.length || !!rightActions?.length;

  if (hasSwipeActions) {
    return (
      <View style={styles.swipeableWrapper}>
        <SwipeableItem
          itemId={itemId}
          testIDPrefix={testID}
          onPress={onPress}
          leftActions={leftActions}
          rightActions={rightActions}
          onSwipeableWillOpen={onSwipeableWillOpen}
          onSwipeableClose={onSwipeableClose}
          leftThreshold={leftThreshold}
          rightThreshold={rightThreshold}
        >
          {cardContent}
        </SwipeableItem>
      </View>
    );
  }

  if (onPress) {
    const handlePress = () => {
      HapticService.selection();
      onPress();
    };
    return (
      <View style={styles.swipeableWrapper}>
        <AppPressable
          onPress={handlePress}
          android_ripple={RIPPLE.SUBTLE}
          style={[]}
        >
          {cardContent}
        </AppPressable>
      </View>
    );
  }

  return <View style={styles.swipeableWrapper}>{cardContent}</View>;
};

const styles = StyleSheet.create(theme => ({
  swipeableWrapper: {
    marginBottom: theme.spacing.smPlus,
    // Match the search bar inset so rows line up with it and the floating
    // tab bar instead of sitting narrower.
    marginHorizontal: theme.spacing.base,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.sizes.itemCard.compact.height,
    padding: theme.spacing.base,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
    // Status variants keep a colored border; the default row relies on the
    // shadow alone, with a transparent border to preserve sizing.
    ...theme.shadows.card,
    backgroundColor: theme.colors.surface,
    borderColor: 'transparent',
    variants: {
      variant: {
        normal: {
          backgroundColor: theme.colors.surface,
          borderColor: 'transparent',
        },
        warning: {
          backgroundColor: theme.colors.expiration.warningBg,
          borderColor: theme.colors.expiration.warningBorder,
        },
        expired: {
          backgroundColor: theme.colors.expiration.expiredBg,
          borderColor: theme.colors.expiration.expiredBorder,
        },
        success: {
          backgroundColor: theme.colors.alertBanner.success.bg,
          borderColor: theme.colors.alertBanner.success.border,
        },
        dimmed: {
          backgroundColor: theme.colors.surfaceVariant,
          borderColor: theme.colors.borderLight,
          opacity: 0.8,
        },
      },
    },
  },
}));
