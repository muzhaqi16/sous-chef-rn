import React from 'react';
import {View, Text} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';
import Icon from '@react-native-vector-icons/material-icons';
import {stylesheet} from './styles';
import {useUnistyles} from 'react-native-unistyles';

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

  const translateX = useAnimatedStyle(() => {
    return {
      transform: [{translateX: dragX.value - 80}],
    };
  });

  const opacity = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
    };
  });

  return (
    <Reanimated.View style={[styles.leftActionContainer, translateX, opacity]}>
      <View style={styles.deleteIconContainer}>
        <Icon name="delete" size={24} color="white" />
        <Text style={styles.deleteText}>Delete</Text>
      </View>
    </Reanimated.View>
  );
};
