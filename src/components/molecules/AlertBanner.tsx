import React from 'react';
import { View } from 'react-native';
import { Pressable, ThemedIcon } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { IconLibrary } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

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
  styles.useVariants({ variant });

  const shouldShowChevron = showChevron ?? !!onPress;

  const content = (
    <View style={styles.container} testID={testID}>
      <View style={styles.iconContainer}>
        {iconLibrary ? (
          <ThemedIcon
            name={icon}
            size={20}
            uniProps={t => ({ color: t.colors.alertBanner[variant].text })}
            library={iconLibrary}
          />
        ) : (
          <Text size="base">{icon}</Text>
        )}
      </View>

      <View style={styles.content}>
        <Text size="sm" weight="semibold" style={styles.title}>
          {title}
        </Text>
        {!!subtitle && (
          <Text size="xs" style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>

      {!!shouldShowChevron && (
        <ThemedIcon
          name="chevron-forward"
          size={24}
          uniProps={t => ({ color: t.colors.alertBanner[variant].text })}
        />
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
    variants: {
      variant: {
        error: {
          backgroundColor: theme.colors.alertBanner.error.bg,
          borderColor: theme.colors.alertBanner.error.border,
        },
        warning: {
          backgroundColor: theme.colors.alertBanner.warning.bg,
          borderColor: theme.colors.alertBanner.warning.border,
        },
        info: {
          backgroundColor: theme.colors.alertBanner.info.bg,
          borderColor: theme.colors.alertBanner.info.border,
        },
        success: {
          backgroundColor: theme.colors.alertBanner.success.bg,
          borderColor: theme.colors.alertBanner.success.border,
        },
      },
    },
  },
  iconContainer: {
    width: theme.sizes.icon.lg,
    height: theme.sizes.icon.lg,
    borderRadius: theme.radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing['2.5'],
    variants: {
      variant: {
        error: { backgroundColor: theme.colors.alertBanner.error.iconBg },
        warning: { backgroundColor: theme.colors.alertBanner.warning.iconBg },
        info: { backgroundColor: theme.colors.alertBanner.info.iconBg },
        success: { backgroundColor: theme.colors.alertBanner.success.iconBg },
      },
    },
  },
  content: {
    flex: 1,
  },
  title: {
    variants: {
      variant: {
        error: { color: theme.colors.alertBanner.error.text },
        warning: { color: theme.colors.alertBanner.warning.text },
        info: { color: theme.colors.alertBanner.info.text },
        success: { color: theme.colors.alertBanner.success.text },
      },
    },
  },
  subtitle: {
    marginTop: 1,
    opacity: 0.8,
    variants: {
      variant: {
        error: { color: theme.colors.alertBanner.error.text },
        warning: { color: theme.colors.alertBanner.warning.text },
        info: { color: theme.colors.alertBanner.info.text },
        success: { color: theme.colors.alertBanner.success.text },
      },
    },
  },
}));
