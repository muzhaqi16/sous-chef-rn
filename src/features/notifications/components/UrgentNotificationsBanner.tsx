import React from 'react';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import type { DisplayNotification as NotificationItem } from '#features/notifications/utils/toDisplayNotification';
import { Text } from '#components/atoms/Text';

interface UrgentNotificationsBannerProps {
  urgentNotifications: NotificationItem[];
}

export const UrgentNotificationsBanner: React.FC<
  UrgentNotificationsBannerProps
> = ({ urgentNotifications }) => {
  const { t } = useTranslation();
  const unreadUrgentCount = urgentNotifications.filter(n => !n.isRead).length;

  if (unreadUrgentCount === 0) {
    return null;
  }

  return (
    <View style={styles.urgentBanner}>
      <Icon name="warning-outline" size={20} tone="white" />
      <Text size="sm" weight="bold" style={styles.urgentText}>
        {t('notifications.urgentUnread', { count: unreadUrgentCount })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create(theme => ({
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.error,
    padding: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  urgentText: {
    color: theme.colors.white,
    marginLeft: theme.spacing.sm,
  },
}));
