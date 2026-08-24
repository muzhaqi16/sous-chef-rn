import React from 'react';
import { useTranslation } from '#/i18n';
import {
  View,
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type ViewStyle,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { type SharedValue } from 'react-native-reanimated';
import { RightActions } from './RightActions';
import { LeftActions } from './LeftActions';
import { SwipeableContent } from './SwipeableContent';
import { useSwipeableActions } from './hooks/useSwipeableActions';
import { styles } from './styles';
import { SwipeableItemProps } from './types';

// Matches marginLeft/marginRight: -12 in actionsContainer/leftActionsContainer styles.
// Placeholders must include the same margin so the Swipeable measures the same layout
// width as the actual action components — preventing the card from opening past the
// action background during the placeholder→actual component transition.
const CARD_EDGE_EXTENSION = 12;

const LEFT_PLACEHOLDER_STYLES: Record<number, ViewStyle> = {
  80: { width: 80, marginRight: -CARD_EDGE_EXTENSION },
  120: { width: 120, marginRight: -CARD_EDGE_EXTENSION },
  180: { width: 180, marginRight: -CARD_EDGE_EXTENSION },
};
const getLeftPlaceholderStyle = (count: number) =>
  LEFT_PLACEHOLDER_STYLES[count <= 1 ? 80 : count === 2 ? 120 : 180];

const RIGHT_PLACEHOLDER_STYLES: Record<number, ViewStyle> = {
  80: { width: 80, marginLeft: -CARD_EDGE_EXTENSION },
  120: { width: 120, marginLeft: -CARD_EDGE_EXTENSION },
  180: { width: 180, marginLeft: -CARD_EDGE_EXTENSION },
};
const getRightPlaceholderStyle = (count: number) =>
  RIGHT_PLACEHOLDER_STYLES[count <= 1 ? 80 : count === 2 ? 120 : 180];

const SwipeableItemComponent: React.FC<SwipeableItemProps> = ({
  children,
  itemId,
  onPress,
  onLongPress,
  onDelete,
  onEdit,
  onTogglePurchase,
  onConsume,
  onWaste,
  onRestock,
  isPurchased,

  leftThreshold = 120,
  rightThreshold = 120,
  friction = 1.5,
  onSwipeableWillOpen,
  onSwipeableClose,
  testIDPrefix,
  swipeMode,
  enabled = true,
}) => {
  const { t } = useTranslation();
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
    hasSwipeStarted,
    handleSwipeOpenStartDrag,
  } = useSwipeableActions({
    itemId,
    onEdit,
    onDelete,

    onSwipeableWillOpen,
    onSwipeableClose,
  });

  // In shopping mode, LeftActions renders only edit (1 btn) and RightActions
  // renders only delete (1 btn), regardless of how many callbacks are provided.
  const leftButtonCount =
    swipeMode === 'shopping' ? (onEdit ? 1 : 0) : leftActionCount;
  const rightButtonCount =
    swipeMode === 'shopping' ? (onDelete ? 1 : 0) : rightActionCount;

  const renderRightActions = (progress: SharedValue<number>) => {
    if (!hasSwipeStarted && rightButtonCount > 0) {
      return <View style={getRightPlaceholderStyle(rightButtonCount)} />;
    }
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
    if (!hasSwipeStarted && leftButtonCount > 0) {
      return <View style={getLeftPlaceholderStyle(leftButtonCount)} />;
    }
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
        testIDPrefix={testIDPrefix}
        onActionPress={handleActionPress}
      />
    );
  };

  // Build accessibility actions from available callbacks so VoiceOver/TalkBack
  // users can discover swipe actions without swiping
  const accessibilityActions = (() => {
    const actions: AccessibilityActionInfo[] = [];
    if (onEdit) actions.push({ name: 'edit', label: t('labels.edit') });
    if (onDelete) actions.push({ name: 'delete', label: t('labels.delete') });
    if (onTogglePurchase)
      actions.push({
        name: 'togglePurchase',
        label: isPurchased
          ? t('swipeActions.markUnpurchased')
          : t('labels.markAsPurchased'),
      });
    if (onConsume)
      actions.push({ name: 'consume', label: t('swipeActions.consume') });
    if (onWaste)
      actions.push({ name: 'waste', label: t('swipeActions.recordWaste') });
    if (onRestock)
      actions.push({ name: 'restock', label: t('swipeActions.restock') });
    return actions;
  })();

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'edit':
        onEdit?.();
        break;
      case 'delete':
        onDelete?.();
        break;
      case 'togglePurchase':
        onTogglePurchase?.();
        break;
      case 'consume':
        onConsume?.();
        break;
      case 'waste':
        onWaste?.();
        break;
      case 'restock':
        onRestock?.();
        break;
    }
  };

  // No wrapper view: the accessibility actions live on SwipeableContent's own
  // container, and `swipeableContainer` already carries the `overflow: 'visible'`
  // the wrapper existed for. One fewer view per row on every list using this
  // molecule — the frame cost on device is Yoga layout and RenderThread draw
  // over the mounted view tree, so per-row view count is what matters.
  return (
    <Swipeable
      ref={swipeableRef}
      enabled={enabled}
      friction={friction}
      leftThreshold={computedLeftThreshold}
      rightThreshold={computedRightThreshold}
      renderLeftActions={leftButtonCount > 0 ? renderLeftActions : undefined}
      renderRightActions={rightButtonCount > 0 ? renderRightActions : undefined}
      onSwipeableWillOpen={handleSwipeableWillOpen}
      onSwipeableClose={handleSwipeableClose}
      onSwipeableOpenStartDrag={handleSwipeOpenStartDrag}
      overshootFriction={8}
      overshootRight={false}
      overshootLeft={false}
      containerStyle={styles.swipeableContainer}
      childrenContainerStyle={styles.childrenContainer}
    >
      <SwipeableContent
        testID={testIDPrefix}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={handleAccessibilityAction}
      >
        {children}
      </SwipeableContent>
    </Swipeable>
  );
};

export const SwipeableItem = SwipeableItemComponent;
