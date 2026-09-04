import React from 'react';
import { View } from 'react-native';
import { Pressable, ThemedIcon } from '#components/atoms/themedComponents';
import { StyleSheet } from 'react-native-unistyles';
import { IconLibrary } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';

export type AlertBannerVariant = 'error' | 'warning' | 'info' | 'success';

export interface AlertBannerProps {
  /** Main title. */
  title: string;
  subtitle?: string;
  /** Emoji string, or an icon name when `iconLibrary` is set. */
  icon?: string;
  iconLibrary?: IconLibrary;
  variant?: AlertBannerVariant;
  onPress?: () => void;
  /** Navigation chevron; defaults to true when `onPress` is given. */
  showChevron?: boolean;
  testID?: string;
}

/** Generic alert banner for status messages. */
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
          <Text>{icon}</Text>
        )}
      </View>

      <View style={styles.content}>
        <Text role="label" style={styles.title}>
          {title}
        </Text>
        {!!subtitle && (
          <Text role="caption" style={styles.subtitle}>
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
    padding: theme.spacing.base,
    paddingRight: theme.spacing.md,
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
    borderWidth: theme.borderWidth.hairline,
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
    borderCurve: 'continuous',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.smPlus,
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
