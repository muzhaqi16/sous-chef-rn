import React from 'react';
import {TouchableOpacity, Text, ActivityIndicator} from 'react-native';
import {UnistylesVariants, withUnistyles} from 'react-native-unistyles';
import {commonStyles} from '#/styles/commonStyles';
import buttonStyles from './Button.styles';

const UniActivityIndicator = withUnistyles(ActivityIndicator);

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
    variant: variant === 'ghost' ? 'ghost' : undefined,
    size,
    disabled,
    fullWidth,
  });

  return (
    <TouchableOpacity
      style={[
        commonStyles.button,
        variant === 'primary' && commonStyles.buttonPrimary,
        variant === 'secondary' && commonStyles.buttonSecondary,
        buttonStyles.button,
        disabled && commonStyles.buttonDisabled,
        btnStyle,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      {...rest}>
      {loading ? (
        <UniActivityIndicator
          size="small"
          uniProps={theme => ({
            color:
              variant === 'primary' ? theme.colors.white : theme.colors.primary,
          })}
        />
      ) : (
        <Text
          style={[
            commonStyles.buttonText,
            variant === 'primary' && commonStyles.buttonTextPrimary,
            variant === 'secondary' && commonStyles.buttonTextSecondary,
            buttonStyles.text,
            txtStyle,
          ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};
