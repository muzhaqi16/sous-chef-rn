import React from 'react';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {useAnimatedStyle, SharedValue} from 'react-native-reanimated';
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
  leftThreshold = 80,
  rightThreshold = 40,
  friction = 2,
}) => {
  const {itemOpacity, itemHeight, animateDelete} =
    useSwipeableAnimation(onDelete);

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
      height: itemHeight.value,
    };
  });

  const renderRightActions = (
    progress: SharedValue<number>,
    dragX: SharedValue<number>,
  ) => (
    <RightActions
      dragX={dragX}
      progress={progress}
      onEdit={onEdit}
      onDelete={onDelete}
      onActionPress={handleActionPress}
    />
  );

  const renderLeftActions = (
    progress: SharedValue<number>,
    dragX: SharedValue<number>,
  ) => (
    <LeftActions
      dragX={dragX}
      progress={progress}
      enabled={enableSwipeToDelete && !!onDelete}
    />
  );

  return (
    <GestureHandlerRootView style={styles.gestureContainer}>
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
          <SwipeableContent onPress={onPress}>{children}</SwipeableContent>
        </ReanimatedSwipeable>
      </Reanimated.View>
    </GestureHandlerRootView>
  );
};
