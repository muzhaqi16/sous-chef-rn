import React, { useState, useEffect } from 'react';
import Reanimated from 'react-native-reanimated';
import { ActionButton } from './ActionButton';
import { styles } from './styles';
import { SwipeActionsProps } from './types';
import { SharedValue } from 'react-native-reanimated';

interface LeftActionsProps extends SwipeActionsProps {
  dragX: SharedValue<number>;
  progress: SharedValue<number>;
}

export const LeftActions: React.FC<LeftActionsProps> = React.memo(({
  onTogglePurchase,
  onConsume,
  onWaste,
  isPurchased,
  swipeableRef,
}) => {
  // Use local state to track purchase status for UI updates
  const [localIsPurchased, setLocalIsPurchased] = useState(isPurchased);

  // Update local state when prop changes
  useEffect(() => {
    setLocalIsPurchased(isPurchased);
  }, [isPurchased]);

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
      <Reanimated.View
        style={styles.leftActionsContainer}
        pointerEvents="box-none"
      >
        <ActionButton
          onPress={handleConsumePress}
          icon="restaurant"
          backgroundColor="#9C27B0" // Purple for consume
          circular={true}
          library="MaterialIcons"
        />
        <ActionButton
          onPress={handleWastePress}
          icon="warning"
          backgroundColor="#FF9800" // Orange for waste
          circular={true}
          library="MaterialIcons"
        />
      </Reanimated.View>
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
      <Reanimated.View
        style={styles.leftActionsContainer}
        pointerEvents="box-none"
      >
        <ActionButton
          onPress={handleConsumePress}
          icon="restaurant"
          backgroundColor="#9C27B0" // Purple for consume
          circular={true}
          library="MaterialIcons"
        />
      </Reanimated.View>
    );
  }

  // Show waste button only if onWaste is provided
  if (onWaste) {
    const handleWastePress = () => {
      swipeableRef?.current?.close();
      onWaste();
    };

    return (
      <Reanimated.View
        style={styles.leftActionsContainer}
        pointerEvents="box-none"
      >
        <ActionButton
          onPress={handleWastePress}
          icon="warning"
          backgroundColor="#FF9800" // Orange for waste
          circular={true}
          library="MaterialIcons"
        />
      </Reanimated.View>
    );
  }

  if (!onTogglePurchase) {
    return null;
  }

  // Dynamic styling based on LOCAL purchase status
  const iconName = localIsPurchased ? 'close-circle' : 'checkmark-circle';
  const bgColor = localIsPurchased ? '#FF9800' : '#4CAF50'; // Orange for unpurchase, Green for purchase

  const handlePress = () => {
    // Optimistically update UI immediately
    setLocalIsPurchased(!localIsPurchased);
    // Close the swipeable
    swipeableRef?.current?.close();
    // Then call the actual toggle function
    onTogglePurchase();
  };

  return (
    <Reanimated.View
      style={styles.leftActionsContainer}
      pointerEvents="box-none"
    >
      <ActionButton
        onPress={handlePress}
        icon={iconName}
        backgroundColor={bgColor}
        circular={true}
        library="Ionicons"
      />
    </Reanimated.View>
  );
});
