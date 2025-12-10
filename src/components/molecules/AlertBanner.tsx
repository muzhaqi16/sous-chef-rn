import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon } from '#utils';

export type AlertBannerVariant = 'error' | 'warning' | 'info' | 'success';

export interface AlertBannerProps {
  /** Main title text */
  title: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Emoji icon to display */
  icon?: string;
  /** Visual variant affecting colors */
  variant?: AlertBannerVariant;
  /** Callback when banner is pressed */
  onPress?: () => void;
  /** Whether to show navigation chevron (default: true if onPress provided) */
  showChevron?: boolean;
  /** Test ID for accessibility */
  testID?: string;
}

/**
 * Generic alert banner for status messages
 *
 * @example
 * // Error variant (expired items)
 * <AlertBanner
 *   title="3 items expired"
 *   subtitle="Tap to review and remove"
 *   icon="⚠️"
 *   variant="error"
 *   onPress={handlePress}
 * />
 *
 * // Success variant
 * <AlertBanner
 *   title="All items in stock"
 *   icon="✅"
 *   variant="success"
 * />
 */
export const AlertBanner: React.FC<AlertBannerProps> = ({
  title,
  subtitle,
  icon = '⚠️',
  variant = 'error',
  onPress,
  showChevron,
  testID,
}) => {
  const { theme } = useUnistyles();

  const variantColors = theme.colors.alertBanner[variant];
  const shouldShowChevron = showChevron ?? !!onPress;

  const content = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: variantColors.bg,
          borderColor: variantColors.border,
        },
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: variantColors.iconBg },
        ]}
      >
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: variantColors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: variantColors.text }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {shouldShowChevron && (
        <Icon name="chevron-right" size={24} color={variantColors.text} />
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingRight: 16,
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  icon: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: theme.fonts.weight.semibold,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
    opacity: 0.8,
  },
}));
