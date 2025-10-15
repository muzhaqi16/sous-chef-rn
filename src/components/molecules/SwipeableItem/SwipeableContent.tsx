import React from 'react';
import { TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import Reanimated, {
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';

interface SwipeableContentProps {
  children: React.ReactNode;
  onPress?: () => void;
  dragX?: SharedValue<number>;
}

export const SwipeableContent: React.FC<SwipeableContentProps> = ({
  children,
  onPress,
  dragX,
}) => {
  const animatedStyle = useAnimatedStyle(() => {
    if (!dragX) return {};

    const isSwipingLeft = dragX.value > 0; // Positive = left swipe (revealing right actions)
    const isSwipingRight = dragX.value < 0; // Negative = right swipe (revealing left actions)

    return {
      marginRight: isSwipingLeft ? 12 : 0, // 12pt gap from right actions when swiping left
      marginLeft: isSwipingRight ? 12 : 0, // 12pt gap from left actions when swiping right
      borderRadius: Math.abs(dragX.value) > 10 ? 12 : 0,
    };
  }, []);

  return (
    <Reanimated.View style={[styles.itemContainer, animatedStyle]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {children}
      </TouchableOpacity>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create(() => ({
  itemContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  touchable: {
    flex: 1,
  },
}));
