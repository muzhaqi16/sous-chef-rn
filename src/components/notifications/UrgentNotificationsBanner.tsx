import React from 'react';
import {View, Text} from 'react-native';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {Icon} from '#utils';
import {NotificationItem} from '#store/slices/notificationSlice';

interface UrgentNotificationsBannerProps {
  urgentNotifications: NotificationItem[];
}

export const UrgentNotificationsBanner: React.FC<
  UrgentNotificationsBannerProps
> = ({urgentNotifications}) => {
  const { theme } = useUnistyles();
  const unreadUrgentCount = urgentNotifications.filter(n => !n.isRead).length;

  if (unreadUrgentCount === 0) {
    return null;
  }

  return (
    <View style={styles.urgentBanner}>
      <Icon name="warning" size={20} color={theme.colors.white} />
      <Text style={styles.urgentText}>
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
    fontSize: theme.typography.fontSize.sm,
    fontWeight: 'bold',
    marginLeft: theme.spacing.sm,
  },
}));
