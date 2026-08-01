import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { ThemedIconButton } from '../atoms/themedComponents';

type ActionButtonProps = {
  onPress: () => void;
  name?: string; // Optional name prop for the icon
  style?: StyleProp<ViewStyle>; // Optional style prop for additional styling
  color?: string; // Optional color prop for the icon
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'; // Optional size variant for the icon
  accessibilityLabel?: string; // Accessibility label for screen readers
  testID?: string; // Optional testID for E2E testing
};
export const ActionButton: React.FC<ActionButtonProps> = ({
  onPress,
  name,
  style,
  color,
  size = 'md', // Default size variant for the icon
  accessibilityLabel,
  testID,
}) => {
  return (
    <View style={[styles.button, style]} testID={testID}>
      <ThemedIconButton
        name={name || 'add'}
        size={size}
        uniProps={t => ({ color: color ?? t.colors.primary })}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel || `${name || 'Add'} button`}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
    borderRadius: theme.radii.xl,
    borderCurve: 'continuous',
    width: theme.sizes.button.md,
    height: theme.sizes.button.md,
    borderColor: theme.colors.primary,
    borderWidth: 2,
  },
}));
export default ActionButton;
