import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { Icon as IconType } from '#utils/iconUtils';

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
    <Pressable
      style={({pressed}) => [styles.navigationRow, pressed && styles.pressed]}
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
      <Icon name="chevron-forward" size={20} />
    </Pressable>
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
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
