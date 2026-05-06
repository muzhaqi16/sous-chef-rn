import React from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { NotificationItem } from '#store/slices/notificationSlice';
import { Text } from '#components/atoms/Text';

interface UrgentNotificationsBannerProps {
  urgentNotifications: NotificationItem[];
}

export const UrgentNotificationsBanner: React.FC<
  UrgentNotificationsBannerProps
> = ({ urgentNotifications }) => {
  const unreadUrgentCount = urgentNotifications.filter(n => !n.isRead).length;

  if (unreadUrgentCount === 0) {
    return null;
  }

  return (
    <View style={styles.urgentBanner}>
      <Icon name="warning-outline" size={20} tone="white" />
      <Text size="sm" weight="bold" style={styles.urgentText}>
        {unreadUrgentCount} urgent notification
        {unreadUrgentCount !== 1 ? 's' : ''}
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
