import React, { useCallback } from 'react';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';
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
  onRestock,
  isPurchased,
  enableSwipeToDelete = true,
  leftThreshold = 120,
  rightThreshold = 120,
  friction = 1.5,
  failOffsetY = [-20, 20],
  onSwipeableWillOpen,
  onSwipeableClose,
  testIDPrefix,
  swipeMode,
}) => {
  const { itemOpacity, animateDelete } = useSwipeableAnimation();

  // Calculate thresholds based on number of actions
  // Fewer actions = smaller threshold for more natural swipe feel
  const leftActionCount = [
    onTogglePurchase,
    onConsume,
    onWaste,
    onRestock,
  ].filter(Boolean).length;
  const rightActionCount = [onEdit, onDelete].filter(Boolean).length;
  const computedLeftThreshold = leftActionCount <= 1 ? 60 : leftThreshold;
  const computedRightThreshold = rightActionCount <= 1 ? 60 : rightThreshold;

  const {
    swipeableRef,
    handleActionPress,
    handleSwipeableWillOpen,
    handleSwipeableClose,
  } = useSwipeableActions({
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

  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => {
      return (
        <RightActions
          onEdit={onEdit}
          onDelete={onDelete}
          onActionPress={handleActionPress}
          testIDPrefix={testIDPrefix}
          progress={progress}
          swipeMode={swipeMode}
        />
      );
    },
    [onEdit, onDelete, handleActionPress, testIDPrefix, swipeMode],
  );

  const renderLeftActions = useCallback(
    (progress: SharedValue<number>) => {
      return (
        <LeftActions
          onTogglePurchase={onTogglePurchase}
          onConsume={onConsume}
          onWaste={onWaste}
          onRestock={onRestock}
          isPurchased={isPurchased}
          swipeableRef={swipeableRef}
          progress={progress}
          swipeMode={swipeMode}
          onEdit={onEdit}
          onActionPress={handleActionPress}
        />
      );
    },
    [
      onTogglePurchase,
      onConsume,
      onWaste,
      onRestock,
      isPurchased,
      swipeableRef,
      swipeMode,
      onEdit,
      handleActionPress,
    ],
  );

  return (
    <Reanimated.View style={[styles.gestureContainer, animatedStyle]}>
      <ReanimatedSwipeable
        ref={swipeableRef}
        friction={friction}
        leftThreshold={computedLeftThreshold}
        rightThreshold={computedRightThreshold}
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

export const SwipeableItem = React.memo(SwipeableItemComponent);
