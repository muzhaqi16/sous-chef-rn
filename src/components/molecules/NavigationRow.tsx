import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils';
import type { Icon as IconType } from '#utils';

interface NavigationRowProps {
  icon: React.ComponentProps<typeof IconType>['name'];
  iconColor?: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

/**
 * NavigationRow - A reusable component for navigating to other screens
 * Shows icon, title, subtitle, and chevron indicator
 */
export const NavigationRow: React.FC<NavigationRowProps> = ({
  icon,
  iconColor,
  title,
  subtitle,
  onPress,
}) => {
  const accessibilityLabel = subtitle ? `${title}, ${subtitle}` : title;

  return (
    <TouchableOpacity
      style={styles.navigationRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={`Navigate to ${title}`}
    >
      <View style={styles.navigationContent}>
        <Icon name={icon} size={24} color={iconColor} />
        <View style={styles.navigationText}>
          <Text style={styles.navigationTitle}>{title}</Text>
          {subtitle && (
            <Text style={styles.navigationSubtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
      <Icon library="Ionicons" name="chevron-forward" size={20} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
  navigationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.spacing.md,
  },
  navigationText: {
    flex: 1,
  },
  navigationTitle: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.semibold,
    color: theme.colors.textPrimary,
  },
  navigationSubtitle: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
}));
