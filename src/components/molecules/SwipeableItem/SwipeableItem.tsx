import React from 'react';
import { View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { type SharedValue } from 'react-native-reanimated';
import { RightActions } from './RightActions';
import { LeftActions } from './LeftActions';
import { SwipeableContent } from './SwipeableContent';
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
  onSwipeableWillOpen,
  onSwipeableClose,
  testIDPrefix,
  swipeMode }) => {
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
    handleSwipeableClose } = useSwipeableActions({
    onEdit,
    onDelete,
    enableSwipeToDelete,
    onSwipeableWillOpen,
    onSwipeableClose });

  const renderRightActions = (progress: SharedValue<number>) => {
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
    };

  const renderLeftActions = (progress: SharedValue<number>) => {
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
    };

  // Build accessibility actions from available callbacks so VoiceOver/TalkBack
  // users can discover swipe actions without swiping
  const accessibilityActions = (() => {
    const actions: AccessibilityActionInfo[] = [];
    if (onEdit) actions.push({ name: 'edit', label: 'Edit' });
    if (onDelete) actions.push({ name: 'delete', label: 'Delete' });
    if (onTogglePurchase) actions.push({ name: 'togglePurchase', label: isPurchased ? 'Mark as unpurchased' : 'Mark as purchased' });
    if (onConsume) actions.push({ name: 'consume', label: 'Consume' });
    if (onWaste) actions.push({ name: 'waste', label: 'Record waste' });
    if (onRestock) actions.push({ name: 'restock', label: 'Restock' });
    return actions;
  })();

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'edit': onEdit?.(); break;
      case 'delete': onDelete?.(); break;
      case 'togglePurchase': onTogglePurchase?.(); break;
      case 'consume': onConsume?.(); break;
      case 'waste': onWaste?.(); break;
      case 'restock': onRestock?.(); break;
    }
  };

  return (
    <View
      style={styles.gestureContainer}
      accessibilityActions={accessibilityActions}
      onAccessibilityAction={handleAccessibilityAction}
    >
      <Swipeable
        ref={swipeableRef}
        friction={friction}
        leftThreshold={computedLeftThreshold}
        rightThreshold={computedRightThreshold}
        dragOffsetFromLeftEdge={15}
        dragOffsetFromRightEdge={15}
        renderLeftActions={renderLeftActions}
        renderRightActions={renderRightActions}
        onSwipeableWillOpen={handleSwipeableWillOpen}
        onSwipeableClose={handleSwipeableClose}
        overshootFriction={8}
        containerStyle={styles.swipeableContainer}
        childrenContainerStyle={styles.childrenContainer}
      >
        <SwipeableContent onPress={onPress} onLongPress={onLongPress}>
          {children}
        </SwipeableContent>
      </Swipeable>
    </View>
  );
};

export const SwipeableItem = SwipeableItemComponent;
