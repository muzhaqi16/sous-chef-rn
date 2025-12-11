import React from 'react';
import {View, Text, TouchableOpacity, ViewStyle} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface PressableRowProps {
  icon?: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  rightElement?: React.ReactNode;
  testID?: string;
}

/**
 * A reusable pressable row component that displays an icon, title,
 * optional subtitle, and a chevron indicator.
 * Common pattern used in settings, list items, and navigation rows.
 */
export const PressableRow: React.FC<PressableRowProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
  showChevron = true,
  disabled = false,
  containerStyle,
  rightElement,
  testID,
}) => {
  const {theme} = useUnistyles();

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.containerDisabled, containerStyle]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      testID={testID}
    >
      {icon && (
        <View style={styles.iconContainer}>
          <Icon
            name={icon}
            size={24}
            color={iconColor || theme.colors.iconSecondary}
          />
        </View>
      )}

      <View style={styles.contentContainer}>
        <Text style={[styles.title, disabled && styles.titleDisabled]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, disabled && styles.subtitleDisabled]}>
            {subtitle}
          </Text>
        )}
      </View>

      {rightElement}

      {showChevron && (
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
  },
  titleDisabled: {
    color: theme.colors.textTertiary,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  subtitleDisabled: {
    color: theme.colors.textTertiary,
  },
}));
