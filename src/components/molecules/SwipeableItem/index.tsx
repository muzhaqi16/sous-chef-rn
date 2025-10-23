import React, { useCallback } from 'react';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  useAnimatedStyle,
  SharedValue,
  useSharedValue,
} from 'react-native-reanimated';
import { RightActions } from './RightActions';
import { LeftActions } from './LeftActions';
import { SwipeableContent } from './SwipeableContent';
import { useSwipeableAnimation } from './hooks/useSwipeableAnimation';
import { useSwipeableActions } from './hooks/useSwipeableActions';
import { styles } from './styles';
import { SwipeableItemProps } from './types';

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onPress,
  onLongPress,
  onDelete,
  onEdit,
  onTogglePurchase,
  isPurchased,
  enableSwipeToDelete = true,
  leftThreshold = 120,
  rightThreshold = 120,
  friction = 1,
}) => {
  const dragX = useSharedValue(0);

  const { itemOpacity, animateDelete } = useSwipeableAnimation();

  const { swipeableRef, handleActionPress, handleSwipeableOpen } =
    useSwipeableActions({
      onEdit,
      onDelete,
      animateDelete,
      enableSwipeToDelete,
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: itemOpacity.value,
    };
  });

  const renderRightActions = useCallback((
    progress: SharedValue<number>,
    dragXValue: SharedValue<number>,
  ) => {
    return (
      <RightActions
        dragX={dragXValue}
        progress={progress}
        onEdit={onEdit}
        onDelete={onDelete}
        onActionPress={handleActionPress}
      />
    );
  }, [onEdit, onDelete, handleActionPress]);

  const renderLeftActions = useCallback((
    progress: SharedValue<number>,
    dragXValue: SharedValue<number>,
  ) => {
    return (
      <LeftActions
        dragX={dragXValue}
        progress={progress}
        onTogglePurchase={onTogglePurchase}
        isPurchased={isPurchased}
        swipeableRef={swipeableRef}
      />
    );
  }, [onTogglePurchase, isPurchased, swipeableRef]);

  return (
    <Reanimated.View style={[styles.gestureContainer, animatedStyle]}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={friction}
        leftThreshold={leftThreshold}
        rightThreshold={rightThreshold}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableOpen={handleSwipeableOpen}
        overshootFriction={8}
        containerStyle={{ overflow: 'visible' }}
      >
        <SwipeableContent onPress={onPress} onLongPress={onLongPress} dragX={dragX}>
          {children}
        </SwipeableContent>
      </ReanimatedSwipeable>
    </Reanimated.View>
  );
};
