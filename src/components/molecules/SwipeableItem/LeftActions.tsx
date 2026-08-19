import React from 'react';
import Animated from 'react-native-reanimated';
import { HapticService } from '#/services/haptic/HapticService';
import { SwipeActionButton } from './SwipeActionButton';
import { styles } from './styles';
import { SwipeActionsProps } from './types';

// Calculate container width based on number of buttons
// Each circular button is ~45px + 4px margin each side = ~53px per button
const getContainerWidth = (buttonCount: number): number => {
  if (buttonCount === 1) return 80;
  if (buttonCount === 2) return 120;
  return 180; // 3 buttons
};

const LeftActionsComponent: React.FC<SwipeActionsProps> = ({
  onTogglePurchase,
  onConsume,
  onWaste,
  onRestock,
  isPurchased,
  swipeableRef,
  progress,
  swipeMode,
  onEdit,
  onActionPress,
  testIDPrefix,
}) => {
  // Shopping mode: Show Edit button on left swipe
  if (swipeMode === 'shopping' && onEdit) {
    const handleEditPress = () => {
      HapticService.light();
      swipeableRef?.current?.close();
      onActionPress?.('edit');
    };

    return (
      <Animated.View
        style={[styles.leftActionsContainer, { width: getContainerWidth(1) }]}
        pointerEvents="box-none"
      >
        <SwipeActionButton
          onPress={handleEditPress}
          icon="create-outline"
          circular={true}
          // Matches `RightActions`, which has always built `${testIDPrefix}-edit`
          // / `-delete`. In shopping mode edit moves to the LEFT swipe, and this
          // side was never given the prefix — so the delete action was reachable
          // from a test and the edit action, doing the same job on the other
          // side, was not.
          testID={testIDPrefix ? `${testIDPrefix}-edit` : undefined}
          progress={progress}
          index={0}
        />
      </Animated.View>
    );
  }
  // Show consume, waste, and restock buttons for pantry items
  if (onConsume && onWaste && onRestock) {
    const handleConsumePress = () => {
      swipeableRef?.current?.close();
      onConsume();
    };

    const handleWastePress = () => {
      swipeableRef?.current?.close();
      onWaste();
    };

    const handleRestockPress = () => {
      swipeableRef?.current?.close();
      onRestock();
    };

    return (
      <Animated.View
        style={[styles.leftActionsContainer, { width: getContainerWidth(3) }]}
        pointerEvents="box-none"
      >
        <SwipeActionButton
          onPress={handleConsumePress}
          icon="restaurant-outline"
          circular={true}
          progress={progress}
          index={0}
        />
        <SwipeActionButton
          onPress={handleWastePress}
          icon="warning-outline"
          circular={true}
          progress={progress}
          index={1}
        />
        <SwipeActionButton
          onPress={handleRestockPress}
          icon="add-circle-outline"
          circular={true}
          progress={progress}
          index={2}
        />
      </Animated.View>
    );
  }

  // Show both consume and waste buttons if both are provided
  if (onConsume && onWaste) {
    const handleConsumePress = () => {
      swipeableRef?.current?.close();
      onConsume();
    };

    const handleWastePress = () => {
      swipeableRef?.current?.close();
      onWaste();
    };

    return (
      <Animated.View
        style={[styles.leftActionsContainer, { width: getContainerWidth(2) }]}
        pointerEvents="box-none"
      >
        <SwipeActionButton
          onPress={handleConsumePress}
          icon="restaurant-outline"
          circular={true}
          progress={progress}
          index={0}
        />
        <SwipeActionButton
          onPress={handleWastePress}
          icon="warning-outline"
          circular={true}
          progress={progress}
          index={1}
        />
      </Animated.View>
    );
  }

  // Show consume button only if onConsume is provided
  if (onConsume) {
    const handleConsumePress = () => {
      // Close the swipeable
      swipeableRef?.current?.close();
      // Call the consume function
      onConsume();
    };

    return (
      <Animated.View
        style={[styles.leftActionsContainer, { width: getContainerWidth(1) }]}
        pointerEvents="box-none"
      >
        <SwipeActionButton
          onPress={handleConsumePress}
          icon="restaurant-outline"
          circular={true}
          progress={progress}
          index={0}
        />
      </Animated.View>
    );
  }

  // Show waste button only if onWaste is provided
  if (onWaste) {
    const handleWastePress = () => {
      swipeableRef?.current?.close();
      onWaste();
    };

    return (
      <Animated.View
        style={[styles.leftActionsContainer, { width: getContainerWidth(1) }]}
        pointerEvents="box-none"
      >
        <SwipeActionButton
          onPress={handleWastePress}
          icon="warning-outline"
          circular={true}
          progress={progress}
          index={0}
        />
      </Animated.View>
    );
  }

  // Show purchase button for shopping list items
  if (!onTogglePurchase) {
    return null;
  }

  // Dynamic icon based on actual purchase status from props
  const iconName = isPurchased ? 'close-circle' : 'checkmark-circle';

  const handlePress = () => {
    // Provide haptic feedback for purchase toggle
    HapticService.light();

    // Close the swipeable
    swipeableRef?.current?.close();
    // Call the toggle function (mutation handles optimistic update in Apollo cache)
    onTogglePurchase();
  };

  return (
    <Animated.View
      style={[styles.leftActionsContainer, { width: getContainerWidth(1) }]}
      pointerEvents="box-none"
    >
      <SwipeActionButton
        onPress={handlePress}
        icon={iconName}
        circular={true}
        progress={progress}
        index={0}
      />
    </Animated.View>
  );
};

export const LeftActions = LeftActionsComponent;
