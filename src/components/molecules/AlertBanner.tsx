import React from 'react';
import { View, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Icon, IconLibrary } from '#utils/iconUtils';

export type AlertBannerVariant = 'error' | 'warning' | 'info' | 'success';

export interface AlertBannerProps {
  /** Main title text */
  title: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Icon to display (emoji string or icon name if iconLibrary is specified) */
  icon?: string;
  /** Icon library to use for vector icons */
  iconLibrary?: IconLibrary;
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
  iconLibrary,
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
        {iconLibrary ? (
          <Icon
            name={icon}
            size={20}
            color={variantColors.text}
            library={iconLibrary}
          />
        ) : (
          <Text style={styles.icon}>{icon}</Text>
        )}
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: variantColors.text }]}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[styles.subtitle, { color: variantColors.text }]}>
            {subtitle}
          </Text>
        )}
      </View>

      {!!shouldShowChevron && (
        <Icon name="chevron-forward" size={24} color={variantColors.text} />
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
    padding: theme.spacing['3'],
    paddingRight: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
  },
  iconContainer: {
    width: theme.sizes.icon.lg,
    height: theme.sizes.icon.lg,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['2.5'],
  },
  icon: {
    fontSize: theme.typography.fontSize.base,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.fonts.weight.semibold,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.xs,
    marginTop: 1,
    opacity: 0.8,
  },
}));
