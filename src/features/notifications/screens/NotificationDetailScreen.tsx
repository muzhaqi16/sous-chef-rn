import React from 'react';
import { useToday } from '#hooks/useToday';
import { useTranslation } from '#/i18n';
import { View } from 'react-native';
import { AppPressable } from '#components/atoms/AppPressable';
import { StyleSheet } from 'react-native-unistyles';
import { Icon } from '#utils/iconUtils';
import { Text } from '#components/atoms/Text';
import { SubScreen } from '#components/templates/SubScreen';
import { NotificationActionHandler } from '#features/notifications/components/NotificationActionHandler';
import { getNotificationCopy } from '#features/notifications/utils/notificationHelpers';

import type { StaticScreenProps } from '@react-navigation/native';
import type { DisplayNotification as NotificationItem } from '#features/notifications/utils/toDisplayNotification';
import { formatDateTimeLong } from '#/utils/formatters/date';

export const NotificationDetailScreen: React.FC<
  // `notifications/:id` deep-links here with the id alone.
  StaticScreenProps<{
    id: string;
    notification?: NotificationItem;
  }>
> = ({ route }) => {
  const { t } = useTranslation();
  const today = useToday();
  const notification = route.params.notification;

  if (!notification) {
    return (
      <SubScreen title={t('labels.notifications')} scroll="none">
        <Text role="error" tone="error" align="center" style={styles.errorText}>
          {t('notifications.notFound')}
        </Text>
      </SubScreen>
    );
  }

  // payload is always a NotificationPayload object (narrowed at the ingestion
  // boundary), so it can be read directly.
  const payload = notification.payload;
  const copy = getNotificationCopy(notification, t, today);

  return (
    <NotificationActionHandler>
      {({ handleNotificationAction, showExpirationActionSheet }) => (
        <SubScreen title={t('labels.notifications')}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="notifications" size={32} tone="primary" />
            </View>
            <Text role="title" style={styles.title}>
              {copy.title}
            </Text>
            <Text role="caption" tone="secondary">
              {formatDateTimeLong(new Date(notification.sentAt))}
            </Text>
          </View>

          <View style={styles.content}>
            <Text role="body" style={styles.message}>
              {copy.message}
            </Text>

            {!!payload.details && (
              <View style={styles.detailsContainer}>
                <Text role="label" tone="secondary" style={styles.detailsTitle}>
                  {t('labels.details')}
                </Text>
                <Text role="caption" tone="primary">
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
                <Text role="bodyStrong" style={styles.actionButtonText}>
                  {notification.actionType === 'ACCEPT_HOME_INVITE'
                    ? t('notifications.acceptHomeInvitation')
                    : notification.actionType === 'VIEW_EXPIRING_ITEMS'
                    ? t('notifications.takeAction')
                    : t('notifications.acceptInvitation')}
                </Text>
              </AppPressable>
            )}
          </View>
        </SubScreen>
      )}
    </NotificationActionHandler>
  );
};

const styles = StyleSheet.create(theme => ({
  header: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderCurve: 'continuous',
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
    paddingTop: theme.spacing.lg,
  },
  message: {
    marginBottom: theme.spacing.lg,
  },
  detailsContainer: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    marginBottom: theme.spacing.lg,
  },
  detailsTitle: {
    marginBottom: theme.spacing.sm,
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    padding: theme.spacing.md,
    borderRadius: theme.radii.sm,
    borderCurve: 'continuous',
    alignItems: 'center',
  },
  actionButtonText: {
    color: theme.colors.onPrimary,
  },
  errorText: {
    marginTop: theme.spacing.xl,
  },
}));
