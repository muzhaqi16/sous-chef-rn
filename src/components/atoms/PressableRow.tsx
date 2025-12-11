import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';

type IconName = React.ComponentProps<typeof Icon>['name'];

interface PressableRowProps {
  /** Main title text */
  title: string;
  /** Optional subtitle or description text */
  subtitle?: string;
  /** Optional value text displayed on the right */
  value?: string;
  /** Left icon name */
  leftIcon?: IconName;
  /** Custom left icon color */
  leftIconColor?: string;
  /** Right icon name (defaults to chevron-right) */
  rightIcon?: IconName | null;
  /** Custom right element to replace the right icon */
  rightElement?: React.ReactNode;
  /** Custom left element to replace the left icon */
  leftElement?: React.ReactNode;
  /** Press handler */
  onPress?: () => void;
  /** Whether the row is disabled */
  disabled?: boolean;
  /** Container style override */
  containerStyle?: ViewStyle;
  /** Whether to show border at bottom */
  showBorder?: boolean;
  /** Test ID for testing */
  testID?: string;
}

export const PressableRow: React.FC<PressableRowProps> = ({
  title,
  subtitle,
  value,
  leftIcon,
  leftIconColor,
  rightIcon = 'chevron-right',
  rightElement,
  leftElement,
  onPress,
  disabled = false,
  containerStyle,
  showBorder = false,
  testID,
}) => {
  const { theme } = useUnistyles();

  const accessibilityLabel = [title, subtitle, value].filter(Boolean).join(', ');

  const content = (
    <>
      {leftElement}
      {leftIcon && !leftElement && (
        <View style={styles.iconContainer}>
          <Icon
            name={leftIcon}
            size={24}
            color={leftIconColor ?? theme.colors.textSecondary}
          />
        </View>
      )}

      <View style={styles.contentContainer}>
        <Text
          style={[styles.title, disabled && styles.titleDisabled]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[styles.subtitle, disabled && styles.subtitleDisabled]}
            numberOfLines={2}
          >
            {subtitle}
          </Text>
        )}
      </View>

      {value && (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      )}

      {rightElement}
      {rightIcon && !rightElement && (
        <Icon
          name={rightIcon}
          size={20}
          color={theme.colors.textTertiary}
        />
      )}
    </>
  );

  const rowStyle = [
    styles.container,
    showBorder && styles.containerWithBorder,
    disabled && styles.containerDisabled,
    containerStyle,
  ];

  if (onPress) {
    return (
      <TouchableOpacity
        style={rowStyle}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={rowStyle} testID={testID}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
  },
  containerWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  containerDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 32,
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: '500',
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
  value: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
  },
}));
