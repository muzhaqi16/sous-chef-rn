import React from 'react';
import { Switch } from 'react-native';
import { useUnistyles } from 'react-native-unistyles';

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
  const { theme } = useUnistyles();

  return (
    <Switch
      testID={testID}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled || loading}
      trackColor={{
        false: theme.colors.border,
        true: theme.colors.primary,
      }}
      thumbColor={theme.colors.surface}
      ios_backgroundColor={theme.colors.border}
    />
  );
};
