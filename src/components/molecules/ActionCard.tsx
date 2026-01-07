import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, type IconLibrary } from '#utils';

export interface ActionCardProps {
  icon: string;
  iconLibrary?: IconLibrary;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * ActionCard - Large action button with icon and label
 *
 * Used for prominent quick actions in bottom sheets and action areas.
 * Displays a large icon in a circular container with a label below.
 */
export const ActionCard: React.FC<ActionCardProps> = ({
  icon,
  iconLibrary = 'MaterialIcons',
  label,
  onPress,
  disabled = false,
  testID,
}) => {
  const { theme } = useUnistyles();

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Icon
          name={icon}
          size={32}
          color={disabled ? theme.colors.textTertiary : theme.colors.primary}
          library={iconLibrary}
        />
      </View>
      <Text
        style={[styles.label, disabled && styles.labelDisabled]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.radii.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontSize: theme.fonts.size.base,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    textAlign: 'center',
  },
  labelDisabled: {
    color: theme.colors.textTertiary,
  },
}));
