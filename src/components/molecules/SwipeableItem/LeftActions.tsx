import React from 'react';
import {View, Text} from 'react-native';
import Animated, {useAnimatedStyle, SharedValue} from 'react-native-reanimated';
import Icon from '@react-native-vector-icons/material-icons';
import {styles} from './styles';

interface LeftActionsProps {
  dragX: SharedValue<number>;
  progress: SharedValue<number>;
  enabled: boolean;
}

export const LeftActions: React.FC<LeftActionsProps> = ({
  dragX,
  progress,
  enabled,
}) => {
  if (!enabled) return null;

  const animatedStyles = useAnimatedStyle(() => ({
    transform: [{translateX: dragX.value - 80}],
    opacity: progress.value,
  }));

  return (
    <Animated.View style={[styles.leftActionContainer, animatedStyles]}>
      <View style={styles.deleteIconContainer}>
        <Icon name="delete" size={24} color="white" />
        <Text style={styles.deleteText}>Delete</Text>
      </View>
    </Animated.View>
  );
};
