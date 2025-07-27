import React from 'react';
import {Text, View, StyleProp, ViewStyle} from 'react-native';
import {useStyles, createStyleSheet} from 'react-native-unistyles';
import IconButton from '../atoms/IconButton';
import Ionicons from '@react-native-vector-icons/ionicons';

type ActionButtonProps = {
  onPress: () => void;
  name?: string; // Optional name prop for the icon
  style?: StyleProp<ViewStyle>; // Optional style prop for additional styling
  color?: string; // Optional color prop for the icon
};
export const ActionButton: React.FC<ActionButtonProps> = ({
  onPress,
  name,
  style,
  color,
}) => {
  const {styles, theme} = useStyles(stylesheet);

  return (
    <View style={[styles.button, style]}>
      <IconButton
        name={name || 'add'}
        size={24}
        color={color || theme.colors.primary}
        onPress={onPress}
        library={Ionicons}
      />
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    borderRadius: 16,
    width: 44,
    height: 44,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
}));
export default ActionButton;
