import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

interface SwipeableContentProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export const SwipeableContent: React.FC<SwipeableContentProps> = ({
  children,
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityHint,
}) => {
  return (
    <View style={styles.itemContainer}>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={150}
        activeOpacity={1}
        style={styles.touchable}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={
          accessibilityHint || 'Swipe left or right for more actions'
        }
      >
        {children}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create(() => ({
  itemContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  touchable: {
    // flex: 1 removed to prevent blocking swipe action buttons
  },
}));
