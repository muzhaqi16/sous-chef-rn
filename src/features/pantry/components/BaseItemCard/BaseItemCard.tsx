import React from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { RowCard } from '#components/atoms/RowCard';
import { SwipeableItem } from '#components/organisms/SwipeableItem/SwipeableItem';
import { HapticService } from '#services/haptic/HapticService';
import { RIPPLE } from '#constants/ripple';
import { commonStyles } from '#/styles/commonStyles';
import type { BaseItemCardProps } from './types';

// Slot-based swipeable row; `ItemCard` is the one with the standard
// title/subtitle/badge layout and automatic slide-off-screen exit. Row actions
// are DESCRIPTORS (`leftActions` / `rightActions`), never named verbs.
export const BaseItemCard: React.FC<BaseItemCardProps> = ({
  accessibilityLabel,
  leftElement,
  children,
  rightElement,
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
    <View
      style={[commonStyles.rowSurface, commonStyles.rowContent, containerStyle]}
      testID={testID}
    >
      {slotChildren}
    </View>
  );

  const hasSwipeActions = !!leftActions?.length || !!rightActions?.length;

  if (hasSwipeActions) {
    return (
      <RowCard>
        <SwipeableItem
          itemId={itemId}
          accessibilityLabel={accessibilityLabel}
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
      </RowCard>
    );
  }

  if (onPress) {
    const handlePress = () => {
      HapticService.selection();
      onPress();
    };
    return (
      <RowCard>
        <AppPressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          android_ripple={RIPPLE.SUBTLE}
          style={[]}
        >
          {cardContent}
        </AppPressable>
      </RowCard>
    );
  }

  return <RowCard>{cardContent}</RowCard>;
};
