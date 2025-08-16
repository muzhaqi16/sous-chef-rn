import React from 'react';
import {TouchableOpacity} from 'react-native';
import {stylesheet} from './styles';
import {useStyles} from 'react-native-unistyles';

interface SwipeableContentProps {
  children: React.ReactNode;
  onPress?: () => void;
}

export const SwipeableContent: React.FC<SwipeableContentProps> = ({
  children,
  onPress,
}) => {
  const {styles} = useStyles(stylesheet);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={styles.itemContainer}>
      {children}
    </TouchableOpacity>
  );
};
