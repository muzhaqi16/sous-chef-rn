import React from 'react';
import { View, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/base/BaseSwitch';
import { Text } from '#components/atoms/Text';

interface SettingSwitchProps {
  title: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  loading?: boolean;
  isAction?: boolean;
  testID?: string;
  containerStyle?: ViewStyle;
}

export const SettingSwitch: React.FC<SettingSwitchProps> = ({
  title,
  description,
  value,
  onValueChange,
  disabled = false,
  loading = false,
  testID,
  containerStyle,
}) => {
  return (
    <View
      style={[
        styles.container,
        disabled && styles.containerDisabled,
        containerStyle,
      ]}
    >
      <View style={styles.textContainer}>
        <Text
          size="md"
          style={[styles.title, disabled && styles.titleDisabled]}
        >
          {title}
        </Text>
        {!!description && (
          <Text
            size="sm"
            lineHeight="tight"
            style={[styles.description, disabled && styles.descriptionDisabled]}
          >
            {description}
          </Text>
        )}
      </View>
      <BaseSwitch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        loading={loading}
      />
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  containerDisabled: {
    opacity: theme.opacity.disabled,
  },
  textContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  title: {
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  titleDisabled: {
    color: theme.colors.textTertiary,
  },
  description: {
    color: theme.colors.textSecondary,
  },
  descriptionDisabled: {
    color: theme.colors.textTertiary,
  },
}));
