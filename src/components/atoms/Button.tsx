import React from 'react';
import {TouchableOpacity, Text} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export type ButtonProps = {
  title: string;
  onPress: () => void;
  btnStyle?: object;
  txtStyle?: object;
} & React.ComponentProps<typeof TouchableOpacity>;

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  btnStyle = {},
  txtStyle = {},
  ...rest
}) => {
  const {styles} = useStyles(stylesheet);
  return (
    <TouchableOpacity
      style={[styles.btnStyle, btnStyle]}
      onPress={onPress}
      {...rest}>
      <Text style={[styles.txtStyle, txtStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const stylesheet = createStyleSheet(theme => ({
  btnStyle: {
    backgroundColor: theme.colors.primary,
    padding: 12,
    alignItems: 'center',
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
  },
  txtStyle: {
    color: theme.colors.textPrimary || '#fff',
    fontSize: theme.fonts.size.md,
    fontWeight: '600',
  },
}));

export default Button;
