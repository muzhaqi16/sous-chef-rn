import React from 'react';
import { RowCard } from '#components/atoms/RowCard';
import { RowFrame, type SwipeRowPress } from '#components/molecules/RowFrame';
import { SwipeableItem } from '#components/organisms/SwipeableItem/SwipeableItem';
import type { BaseItemCardProps } from './types';

// Slot-based swipeable row; `ItemCard` is the one with the standard
// title/subtitle/badge layout and automatic slide-off-screen exit. Row actions
// are DESCRIPTORS (`leftActions` / `rightActions`), never named verbs.
export const BaseItemCard: React.FC<BaseItemCardProps> = ({
  accessibilityLabel,
  leftElement,
  children,
  rightElement,
  trailingActions,
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
  const hasSwipeActions = !!leftActions?.length || !!rightActions?.length;

  // A swipeable row's button carries the id, with its label and actions; the
  // same id on the content inside it makes every lookup by id ambiguous.
  const frame = (swipe?: SwipeRowPress) => (
    <RowFrame
      trailing={trailingActions}
      swipe={swipe}
      press={
        !swipe && onPress
          ? { onPress, accessibilityLabel, haptic: true, ripple: true }
          : undefined
      }
      accessibilityLabel={accessibilityLabel}
      surfaceStyle={containerStyle}
      testID={hasSwipeActions ? undefined : testID}
    >
      {leftElement}
      {children}
      {rightElement}
    </RowFrame>
  );

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
          {frame}
        </SwipeableItem>
      </RowCard>
    );
  }

  return <RowCard>{frame()}</RowCard>;
};
