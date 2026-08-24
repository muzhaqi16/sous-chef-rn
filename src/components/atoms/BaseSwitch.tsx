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
}

export const BaseSwitch: React.FC<BaseSwitchProps> = ({
  value,
  onValueChange,
  disabled = false,
  loading = false,
  testID,
}) => {
  return (
    <ThemedSwitch
      testID={testID}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled || loading}
    />
  );
};
