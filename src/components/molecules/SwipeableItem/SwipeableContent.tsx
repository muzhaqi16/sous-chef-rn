import React from 'react';
import {TouchableOpacity} from 'react-native';
import {styles} from './styles';

interface SwipeableContentProps {
  children: React.ReactNode;
  onPress?: () => void;
}

export const SwipeableContent: React.FC<SwipeableContentProps> = ({
  children,
  onPress,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.itemContainer}>
      {children}
    </TouchableOpacity>
  );
};
