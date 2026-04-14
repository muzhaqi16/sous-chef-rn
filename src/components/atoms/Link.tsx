import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type LinkVariant = 'primary' | 'subtle';

interface LinkProps extends Omit<TextProps, 'style' | 'onPress' | 'disabled'> {
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
      {...rest}
      testID={testID}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="link"
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        variant === 'subtle' ? styles.subtle : styles.primary,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create(theme => ({
  base: {
    fontWeight: theme.fonts.weight.semibold,
  },
  primary: {
    color: theme.colors.primary,
  },
  subtle: {
    color: theme.colors.textOnSurfaceVariant,
  },
  disabled: {
    opacity: theme.opacity.disabled,
  },
}));
