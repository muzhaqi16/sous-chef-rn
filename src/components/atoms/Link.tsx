import React from 'react';
import type { TextProps as RNTextProps, TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from './Text';

type LinkVariant = 'primary' | 'subtle';

interface LinkProps
  extends Omit<RNTextProps, 'style' | 'onPress' | 'disabled' | 'role'> {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
  variant?: LinkVariant;
  style?: TextStyle | TextStyle[];
}

export const Link: React.FC<LinkProps> = ({
  children,
  onPress,
  disabled = false,
  testID,
  variant = 'primary',
  style,
  ...rest
}) => {
  return (
    <Text
      role="bodyStrong"
      {...rest}
      testID={testID}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      tone={variant === 'subtle' ? 'onSurfaceVariant' : 'accent'}
      style={[disabled && styles.disabled, style]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create(theme => ({
  disabled: {
    opacity: theme.opacity.disabled,
  },
}));
