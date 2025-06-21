import React, {ReactNode} from 'react';
import {
  View,
  Text,
  TextInput as RNTextInput,
  TextInputProps,
  StyleProp,
  ViewStyle,
} from 'react-native';
import {createStyleSheet, useStyles} from 'react-native-unistyles';

export interface BaseInputProps extends TextInputProps {
  label: string;
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
  const {styles, theme} = useStyles(stylesheet);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <RNTextInput
          style={[styles.input, style]}
          placeholderTextColor={theme.colors.inputPlaceholder}
          {...textInputProps}
        />
        {rightIcon != null && (
          <View style={styles.iconWrapper}>{rightIcon}</View>
        )}
      </View>
      {errorMessage != null && (
        <Text style={styles.errorText}>{errorMessage}</Text>
      )}
    </View>
  );
};

const stylesheet = createStyleSheet(theme => ({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    height: 44,
    paddingHorizontal: 12,
  },
  input: {
    backgroundColor: theme.colors.inputBackground,
    flex: 1,
    fontSize: 15,
    color: theme.colors.inputText,
    padding: 0,
  },
  iconWrapper: {
    marginLeft: 8,
  },
  errorText: {
    marginTop: 4,
    color: theme.colors.error,
    fontSize: 13,
  },
}));
