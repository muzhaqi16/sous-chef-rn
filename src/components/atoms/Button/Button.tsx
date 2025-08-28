import React from 'react';
import {TouchableOpacity, Text, ActivityIndicator} from 'react-native';
import {UnistylesVariants, withUnistyles} from 'react-native-unistyles';
import buttonStyles from './Button.styles';

// Use withUnistyles for ActivityIndicator to properly map theme colors
const UniActivityIndicator = withUnistyles(ActivityIndicator);

// Use UnistylesVariants to infer types from your stylesheet
export type ButtonProps = UnistylesVariants<typeof buttonStyles> & {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  btnStyle?: object;
  txtStyle?: object;
} & React.ComponentProps<typeof TouchableOpacity>;

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = false,
  btnStyle = {},
  txtStyle = {},
  ...rest
}) => {
  buttonStyles.useVariants({
    variant,
    size,
    disabled,
    fullWidth,
  });

  return (
    <TouchableOpacity
      style={[buttonStyles.button, btnStyle]}
      onPress={onPress}
      disabled={disabled || loading}
      {...rest}>
      {loading ? (
        <UniActivityIndicator
          size="small"
          uniProps={theme => ({
            color: theme.colors.primary,
          })}
        />
      ) : (
        <Text style={[buttonStyles.text, txtStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};
