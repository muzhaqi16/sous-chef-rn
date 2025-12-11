import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Icon } from '#utils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

interface SettingRowProps {
  title: string;
  description?: string;
  value?: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  onPress: () => void;
  showArrow?: boolean;
  disabled?: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  title,
  description,
  value,
  icon,
  onPress,
  showArrow = true,
  disabled = false,
}) => {
  const { theme } = useUnistyles();
  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.containerDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}>
      {icon && (
        <View style={styles.iconContainer}>
          <Icon name={icon} size={24} color={theme.colors.textSecondary} />
        </View>
      )}

      <View style={styles.contentContainer}>
        <Text style={[styles.title, disabled && styles.titleDisabled]}>
          {title}
        </Text>
        {description && (
          <Text
            style={[
              styles.description,
              disabled && styles.descriptionDisabled,
            ]}>
            {description}
          </Text>
        )}
      </View>

      {value && <Text style={styles.value}>{value}</Text>}

      {showArrow && (
        <Icon
          name="chevron-right"
          size={24}
          color={theme.colors.textTertiary}
        />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    marginRight: theme.spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  titleDisabled: {
    color: theme.colors.textTertiary,
  },
  description: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  descriptionDisabled: {
    color: theme.colors.textTertiary,
  },
  value: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
  },
}));
