import React from 'react';
import {TouchableOpacity, StyleProp, ViewStyle} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import Feather from '@react-native-vector-icons/feather';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

type IconButtonProps = {
  name: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

export const IconButton: React.FC<IconButtonProps> = ({
  name,
  onPress,
  size = 24,
  color,
  style,
}) => {
  const {styles, theme} = useStyles(stylesheet);
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      <Feather
        name={name}
        size={size}
        color={color || theme.colors.iconPrimary}
      />
    </TouchableOpacity>
  );
};

const stylesheet = createStyleSheet(theme => ({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
}));
export default IconButton;
