import React from 'react';
import { Vibration, Platform } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { ActionButton } from './ActionButton';
import { styles } from './styles';
import { SwipeActionsProps } from './types';

export const LeftActions: React.FC<SwipeActionsProps> = React.memo(({
  onTogglePurchase,
  onConsume,
  onWaste,
  isPurchased,
  swipeableRef,
}) => {

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

  // Show purchase button for shopping list items
  if (!onTogglePurchase) {
    return null;
  }

  // Dynamic styling based on actual purchase status from props
  const iconName = isPurchased ? 'close-circle' : 'checkmark-circle';
  const bgColor = isPurchased ? '#FF9800' : '#4CAF50'; // Orange for unpurchase, Green for purchase

  const handlePress = () => {
    // Provide haptic feedback for purchase toggle
    if (Platform.OS === 'ios') {
      Vibration.vibrate([0, 40]); // Short vibration
    } else {
      Vibration.vibrate(40);
    }

    // Close the swipeable
    swipeableRef?.current?.close();
    // Call the toggle function (mutation handles optimistic update in Apollo cache)
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
