import React from 'react';
import { View, ScrollView } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { NotificationActionHandler } from '#features/notifications/components/NotificationActionHandler';

import { format } from 'date-fns/format';
import type { StaticScreenProps } from '@react-navigation/native';
import type { NotificationItem } from '#store/slices/notificationSlice';

export const NotificationDetailScreen: React.FC<
  StaticScreenProps<{
    notification: NotificationItem;
  }>
> = ({ route }) => {
  const notification = route.params?.notification;

  if (!notification) {
    return (
      <View style={styles.container}>
        <Text
          variant="body"
          tone="error"
          align="center"
          style={styles.errorText}
        >
          Notification not found
        </Text>
      </View>
    );
  }

  // payload is always a NotificationPayload object (narrowed at the ingestion
  // boundary), so it can be read directly.
  const payload = notification.payload;

  return (
    <NotificationActionHandler>
      {({ handleNotificationAction, showExpirationActionSheet }) => (
        <ScrollView style={styles.container}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="notifications" size={32} tone="primary" />
            </View>
            <Text variant="subtitle" weight="bold" style={styles.title}>
              {notification.title || 'Notification'}
            </Text>
            <Text variant="caption">
              {format(new Date(notification.sentAt), 'PPpp')}
            </Text>
          </View>

          <View style={styles.content}>
            <Text variant="body" lineHeight="relaxed" style={styles.message}>
              {payload.message ||
                notification.message ||
                'No message available'}
            </Text>

            {!!payload.details && (
              <View style={styles.detailsContainer}>
                <Text
                  variant="caption"
                  weight="bold"
                  style={styles.detailsTitle}
                >
                  Details
                </Text>
                <Text variant="caption" tone="primary">
                  {payload.details}
                </Text>
              </View>
            )}

            {!!notification.requiresAction && !!notification.actionType && (
              <AppPressable
                style={styles.actionButton}
                onPress={() =>
                  notification.actionType === 'VIEW_EXPIRING_ITEMS'
                    ? showExpirationActionSheet(notification)
                    : handleNotificationAction(notification)
                }
              >
                <Text
                  variant="body"
                  weight="bold"
                  style={styles.actionButtonText}
                >
                  {notification.actionType === 'ACCEPT_HOME_INVITE'
                    ? 'Accept Home Invitation'
                    : notification.actionType === 'VIEW_EXPIRING_ITEMS'
                    ? 'Take Action'
                    : 'Accept Invitation'}
                </Text>
              </AppPressable>
            )}
          </View>
        </ScrollView>
      )}
    </NotificationActionHandler>
  );
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
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  title: {
    marginBottom: theme.spacing.sm,
  },
  content: {
    padding: theme.spacing.lg,
  },
  message: {
    marginBottom: theme.spacing.lg,
  },
  detailsContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    marginBottom: theme.spacing.lg,
  },
  detailsTitle: {
    marginBottom: theme.spacing.sm,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
  },
  actionButtonText: {
    color: theme.colors.white,
  },
  errorText: {
    marginTop: theme.spacing.xl,
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));
