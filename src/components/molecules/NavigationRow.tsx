import React from 'react';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { Icon as IconType } from '#utils/iconUtils';
import { RIPPLE } from '#constants/ripple';
import { Text } from '#components/atoms/Text';

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
    <AppPressable
      style={styles.navigationRow}
      onPress={onPress}
      android_ripple={RIPPLE.SUBTLE}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={`Navigate to ${title}`}
    >
      <View style={styles.navigationContent}>
        <Icon name={icon} size={24} color={iconColor} />
        <View style={styles.navigationText}>
          <Text size="md" weight="semibold">
            {title}
          </Text>
          {!!subtitle && (
            <Text size="sm" tone="secondary" style={styles.navigationSubtitle}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <Icon name="chevron-forward" size={20} />
    </AppPressable>
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
  navigationSubtitle: {
    marginTop: theme.spacing.xs,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
