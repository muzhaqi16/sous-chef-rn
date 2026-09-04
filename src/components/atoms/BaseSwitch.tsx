import React from 'react';
import { Switch } from 'react-native';
import { withUnistyles } from 'react-native-unistyles';

const ThemedSwitch = withUnistyles(Switch, theme => ({
  trackColor: {
    false: theme.colors.border,
    true: theme.colors.primary,
  },
  thumbColor: theme.colors.surface,
  ios_backgroundColor: theme.colors.border,
}));

interface BaseSwitchProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  /** What the switch controls. A row's own label, where the row has one. */
  accessibilityLabel?: string;
}

export const BaseSwitch: React.FC<BaseSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  loading = false,
  testID,
  accessibilityLabel,
}) => {
  return (
    <ThemedSwitch
      testID={testID}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled || loading}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      // RN reads a Switch's own `value` on iOS but not its busy state, and a
      // loading switch is disabled without looking it.
      accessibilityState={{ checked: value, disabled: disabled || loading }}
    />
  );
};
