import React from 'react';
import Animated from 'react-native-reanimated';
import { useUnistyles } from 'react-native-unistyles';
import { HapticService } from '#/services/haptic/HapticService';
import { AnimatedActionButton } from './AnimatedActionButton';
import { styles } from './styles';
import { SwipeActionsProps } from './types';

// Calculate container width based on number of buttons
// Each circular button is ~45px + 4px margin each side = ~53px per button
const getContainerWidth = (buttonCount: number): number => {
  if (buttonCount === 1) return 80;
  if (buttonCount === 2) return 120;
  return 180; // 3 buttons
};

export const LeftActions: React.FC<SwipeActionsProps> = React.memo(
  ({
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
  }) => {
    const { theme } = useUnistyles();

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
          <AnimatedActionButton
            onPress={handleEditPress}
            icon="edit"
            backgroundColor={theme.colors.info}
            circular={true}
            library="MaterialIcons"
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
          <AnimatedActionButton
            onPress={handleConsumePress}
            icon="restaurant"
            backgroundColor="#9C27B0" // Purple for consume
            circular={true}
            library="MaterialIcons"
            progress={progress}
            index={0}
          />
          <AnimatedActionButton
            onPress={handleWastePress}
            icon="warning"
            backgroundColor="#FF9800" // Orange for waste
            circular={true}
            library="MaterialIcons"
            progress={progress}
            index={1}
          />
          <AnimatedActionButton
            onPress={handleRestockPress}
            icon="add-circle-outline"
            backgroundColor="#4CAF50" // Green for restock
            circular={true}
            library="MaterialIcons"
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
          <AnimatedActionButton
            onPress={handleConsumePress}
            icon="restaurant"
            backgroundColor="#9C27B0" // Purple for consume
            circular={true}
            library="MaterialIcons"
            progress={progress}
            index={0}
          />
          <AnimatedActionButton
            onPress={handleWastePress}
            icon="warning"
            backgroundColor="#FF9800" // Orange for waste
            circular={true}
            library="MaterialIcons"
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
          <AnimatedActionButton
            onPress={handleConsumePress}
            icon="restaurant"
            backgroundColor="#9C27B0" // Purple for consume
            circular={true}
            library="MaterialIcons"
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
          <AnimatedActionButton
            onPress={handleWastePress}
            icon="warning"
            backgroundColor="#FF9800" // Orange for waste
            circular={true}
            library="MaterialIcons"
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

    // Dynamic styling based on actual purchase status from props
    const iconName = isPurchased ? 'close-circle' : 'checkmark-circle';
    const bgColor = isPurchased ? '#FF9800' : '#4CAF50'; // Orange for unpurchase, Green for purchase

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
        <AnimatedActionButton
          onPress={handlePress}
          icon={iconName}
          backgroundColor={bgColor}
          circular={true}
          library="Ionicons"
          progress={progress}
          index={0}
        />
      </Animated.View>
    );
  },
);
