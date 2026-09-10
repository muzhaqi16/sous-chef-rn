import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { Icon } from '#utils/iconUtils';
import { StyleSheet } from 'react-native-unistyles';
import { AppPressable } from '#components/atoms/AppPressable';
import { Text } from '#components/atoms/Text';

interface NotificationHeaderProps {
  onMarkAllRead: () => void;
  /** Clears the READ notifications; unread ones are left alone. */
  onClearRead: () => void;
  hasNotifications: boolean;
}

export const NotificationHeader: React.FC<NotificationHeaderProps> = ({
  onMarkAllRead,
  onClearRead,
  hasNotifications,
}) => {
  const { t } = useTranslation();
  if (!hasNotifications) return null;

  return (
    <View style={styles.container}>
      <AppPressable style={styles.button} onPress={onMarkAllRead}>
        <Icon name="checkmark-done" size={20} tone="primary" />
        <Text role="label" style={styles.buttonText}>
          {t('notifications.markAllRead')}
        </Text>
      </AppPressable>
      <AppPressable style={styles.button} onPress={onClearRead}>
        <Icon name="list-outline" size={20} tone="primary" />
        <Text role="label" style={styles.buttonText}>
          {t('labels.clearRead')}
        </Text>
      </AppPressable>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: theme.borderWidth.hairline,
    borderBottomColor: theme.colors.border,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
  },
  buttonText: {
    marginLeft: theme.spacing.xs,
    color: theme.colors.primary,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
