import React, { useCallback } from 'react';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { RightActions } from './RightActions';
import { LeftActions } from './LeftActions';
import { SwipeableContent } from './SwipeableContent';
import { useSwipeableAnimation } from './hooks/useSwipeableAnimation';
import { useSwipeableActions } from './hooks/useSwipeableActions';
import { styles } from './styles';
import { SwipeableItemProps } from './types';

const SwipeableItemComponent: React.FC<SwipeableItemProps> = ({
  children,
  onPress,
  onLongPress,
  onDelete,
  onEdit,
  onTogglePurchase,
  onConsume,
  onWaste,
  isPurchased,
  enableSwipeToDelete = true,
  leftThreshold = 120,
  rightThreshold = 120,
  friction = 1,
  failOffsetY = [-20, 20],
  onSwipeableWillOpen,
  onSwipeableClose,
  testIDPrefix,
}) => {
  const { itemOpacity, animateDelete } = useSwipeableAnimation();

  const { swipeableRef, handleActionPress, handleSwipeableWillOpen, handleSwipeableClose } =
    useSwipeableActions({
      onEdit,
      onDelete,
      animateDelete,
      enableSwipeToDelete,
      onSwipeableWillOpen,
      onSwipeableClose,
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: itemOpacity.value,
    };
  });

  const renderRightActions = useCallback(() => {
    return (
      <RightActions
        onEdit={onEdit}
        onDelete={onDelete}
        onActionPress={handleActionPress}
        testIDPrefix={testIDPrefix}
      />
    );
  }, [onEdit, onDelete, handleActionPress, testIDPrefix]);

  const renderLeftActions = useCallback(() => {
    return (
      <LeftActions
        onTogglePurchase={onTogglePurchase}
        onConsume={onConsume}
        onWaste={onWaste}
        isPurchased={isPurchased}
        swipeableRef={swipeableRef}
      />
    );
  }, [onTogglePurchase, onConsume, onWaste, isPurchased, swipeableRef]);

  return (
    <Reanimated.View style={[styles.gestureContainer, animatedStyle]}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={friction}
        leftThreshold={leftThreshold}
        rightThreshold={rightThreshold}
        dragOffsetFromLeftEdge={15}
        dragOffsetFromRightEdge={15}
        failOffsetY={failOffsetY}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={handleSwipeableWillOpen}
        onSwipeableClose={handleSwipeableClose}
        overshootFriction={8}
        containerStyle={{ overflow: 'visible' }}
      >
        <SwipeableContent onPress={onPress} onLongPress={onLongPress}>
          {children}
        </SwipeableContent>
      </ReanimatedSwipeable>
    </Reanimated.View>
  );
};

// PERFORMANCE: Memoize to prevent unnecessary re-renders
export const SwipeableItem = React.memo(SwipeableItemComponent);
