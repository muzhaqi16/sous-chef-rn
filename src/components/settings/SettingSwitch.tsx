import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { BaseSwitch } from '#components/base/BaseSwitch';

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
    <View style={[styles.container, disabled && styles.containerDisabled, containerStyle]}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, disabled && styles.titleDisabled]}>
          {title}
        </Text>
        {description && (
          <Text
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
    fontSize: theme.typography.fontSize.md,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  titleDisabled: {
    color: theme.colors.textTertiary,
  },
  description: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.tight,
  },
  descriptionDisabled: {
    color: theme.colors.textTertiary,
  },
}));
