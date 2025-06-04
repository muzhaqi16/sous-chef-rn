import React from 'react';
import {TouchableOpacity, StyleProp, ViewStyle} from 'react-native';
import Icon from '@react-native-vector-icons/ionicons';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

type IconButtonProps = {
  iconName: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
};

const IconButton: React.FC<IconButtonProps> = ({
  iconName,
  onPress,
  size = 24,
  color,
  style,
}) => {
  const {styles, theme} = useStyles(stylesheet);
  return (
    <TouchableOpacity style={[styles.button, style]} onPress={onPress}>
      <Icon
        name={iconName}
        size={size}
        color={color || theme.colors.typography}
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
