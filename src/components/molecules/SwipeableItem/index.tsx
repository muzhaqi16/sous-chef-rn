import React from 'react';
import {View} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  useAnimatedStyle,
  SharedValue,
  useSharedValue,
} from 'react-native-reanimated';
import {RightActions} from './RightActions';
import {LeftActions} from './LeftActions';
import {SwipeableContent} from './SwipeableContent';
import {useSwipeableAnimation} from './hooks/useSwipeableAnimation';
import {useSwipeableActions} from './hooks/useSwipeableActions';
import {styles} from './styles';
import {SwipeableItemProps} from './types';

export const SwipeableItem: React.FC<SwipeableItemProps> = ({
  children,
  onPress,
  onDelete,
  onEdit,
  enableSwipeToDelete = true,
  leftThreshold = 120,
  rightThreshold = 120,
  friction = 1,
}) => {
  const dragX = useSharedValue(0);

  const {itemOpacity, animateDelete} =
    useSwipeableAnimation();

  const {swipeableRef, handleActionPress, handleSwipeableOpen} =
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

  const renderRightActions = (
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
  };

  const renderLeftActions = (
    progress: SharedValue<number>,
    dragXValue: SharedValue<number>,
  ) => {
    return (
      <LeftActions
        dragX={dragXValue}
        progress={progress}
        onEdit={onEdit}
        onDelete={onDelete}
        onActionPress={handleActionPress}
      />
    );
  };

  return (
    <View style={styles.gestureContainer}>
      <Reanimated.View style={[styles.container, animatedStyle]}>
        <ReanimatedSwipeable
          ref={swipeableRef}
          friction={friction}
          leftThreshold={leftThreshold}
          rightThreshold={rightThreshold}
          renderLeftActions={renderLeftActions}
          renderRightActions={renderRightActions}
          onSwipeableOpen={handleSwipeableOpen}
          overshootLeft={false}
          overshootRight={false}>
          <SwipeableContent onPress={onPress} dragX={dragX}>
            {children}
          </SwipeableContent>
        </ReanimatedSwipeable>
      </Reanimated.View>
    </View>
  );
};
