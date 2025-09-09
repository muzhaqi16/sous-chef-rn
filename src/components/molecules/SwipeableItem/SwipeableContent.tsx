import React from 'react';
import {TouchableOpacity} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {commonStyles} from '#/styles/commonStyles';
import Reanimated, {useAnimatedStyle, SharedValue} from 'react-native-reanimated';

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
        style={styles.touchable}>
        {children}
      </TouchableOpacity>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create(theme => ({
  itemContainer: {
    ...commonStyles.surface,
    elevation: 8, // Android shadow
    shadowColor: '#000000', // iOS shadow - box-shadow: 0px 4px 30px 0px #0000001A
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1, // #0000001A = 26/255 ≈ 0.1
    shadowRadius: 15, // 30px blur converted to radius
    flex: 1,
    overflow: 'hidden',
  },
  touchable: {
    flex: 1,
  },
}));
