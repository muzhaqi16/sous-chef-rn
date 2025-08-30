import React, {ReactNode} from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {useUnistyles} from 'react-native-unistyles';
import {commonStyles} from '#/styles/commonStyles';
import styles from './BaseInput.styles';

export interface BaseInputProps extends TextInputProps {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  errorMessage?: string;
  rightIcon?: ReactNode;
}

export const BaseInput: React.FC<BaseInputProps> = ({
  label,
  containerStyle,
  errorMessage,
  rightIcon,
  style,
  ...textInputProps
}) => {
  const {theme} = useUnistyles();

  return (
    <View style={containerStyle}>
      {label != null && (
        <Text style={[commonStyles.label, styles.label]}>{label}</Text>
      )}
      <View
        style={[
          commonStyles.row,
          commonStyles.input,
          styles.inputRow,
          errorMessage && commonStyles.inputError,
        ]}>
        <TextInput
          style={[commonStyles.flex1, styles.input, style]}
          placeholderTextColor={theme.colors.inputPlaceholder}
          {...textInputProps}
        />
        {rightIcon != null && (
          <View style={styles.iconWrapper}>{rightIcon}</View>
        )}
      </View>
      {errorMessage != null && (
        <Text style={[commonStyles.errorText, styles.errorText]}>
          {errorMessage}
        </Text>
      )}
    </View>
  );
};
