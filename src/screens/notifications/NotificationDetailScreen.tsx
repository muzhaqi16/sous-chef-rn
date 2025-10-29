import React from 'react';
import {View, Text, ScrollView, TouchableOpacity} from 'react-native';
import {StyleSheet} from 'react-native-unistyles';
import {Icon} from '#utils';
import {useAppNavigation} from '#/hooks';
import {NotificationActionHandler} from '#components/notifications/NotificationActionHandler';

import {format} from 'date-fns';
import {NotificationStackParamList} from '#navigation/stacks/NotificationStack';

export const NotificationDetailScreen: React.FC<{
  route: {params: NotificationStackParamList['NotificationDetail']};
}> = ({route}) => {
  const navigation = useAppNavigation();
  const notification = route.params?.notification;

  if (!notification) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Notification not found</Text>
      </View>
    );
  }

  const payload =
    typeof notification.payload === 'string'
      ? JSON.parse(notification.payload)
      : notification.payload;

  return (
    <NotificationActionHandler>
      {({handleNotificationAction}) => (
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="notifications" size={32} color={styles.icon.color} />
            </View>
            <Text style={styles.title}>
              {getNotificationTitle(notification.type)}
            </Text>
            <Text style={styles.timestamp}>
              {format(new Date(notification.sentAt), 'PPpp')}
            </Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.message}>
              {payload.message || notification.message || 'No message available'}
            </Text>

            {payload.details && (
              <View style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Details</Text>
                <Text style={styles.detailsText}>{payload.details}</Text>
              </View>
            )}

            {notification.requiresAction && notification.actionType && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleNotificationAction(notification)}>
                <Text style={styles.actionButtonText}>
                  {notification.actionType === 'ACCEPT_HOME_INVITE'
                    ? 'Accept Home Invitation'
                    : 'Accept Invitation'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}
    </NotificationActionHandler>
  );
};

const getNotificationTitle = (type: string): string => {
  switch (type) {
    case 'EXPIRY_REMINDER':
      return 'Item Expiring Soon';
    case 'LOW_STOCK':
      return 'Low Stock Alert';
    case 'NEW_ITEM_ADDED':
      return 'New Item Added';
    case 'MEMBERSHIP_INVITE':
      return 'Home Invitation';
    case 'COLLABORATION_INVITE':
      return 'Shopping List Invitation';
    default:
      return 'Notification';
  }
};

const styles = StyleSheet.create(theme => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primaryLight || '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  icon: {
    color: theme.colors.primary,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  timestamp: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  content: {
    padding: theme.spacing.lg,
  },
  message: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    lineHeight: 24,
    marginBottom: theme.spacing.lg,
  },
  detailsContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: 8,
    marginBottom: theme.spacing.lg,
  },
  detailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  detailsText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.error,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
  },
}));
