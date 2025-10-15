import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {Icon} from '#utils';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {formatDistanceToNow} from 'date-fns';
import {NotificationItem as NotificationType} from '#store/slices/notificationSlice';
import {getNotificationIcon} from '#utils/notifications/notificationHelpers';
import {safeParseDate} from '#utils/dateUtils';

interface NotificationItemProps {
  notification: NotificationType;
  onPress: (notification: NotificationType) => void;
  onDismiss?: (notificationId: string) => void;
}

export const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onDismiss,
}) => {
  const {theme} = useUnistyles();
  return (
    <TouchableOpacity
      style={[styles.container, !notification.isRead && styles.unreadContainer]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}>
      <View
        style={[
          styles.iconContainer,
          !notification.isRead && styles.unreadIconContainer,
        ]}>
        <Icon
          name={getNotificationIcon(notification.type)}
          size={24}
          color={
            !notification.isRead
              ? theme.colors.primary
              : theme.colors.textSecondary
          }
        />
      </View>

      <View style={styles.contentContainer}>
        <Text
          style={[styles.title, !notification.isRead && styles.unreadTitle]}>
          {notification.title}
        </Text>
        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.timestamp}>
          {(() => {
            const date = safeParseDate(notification.sentAt);
            return date
              ? formatDistanceToNow(date, {addSuffix: true})
              : 'Recently';
          })()}
        </Text>
      </View>

      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={() => onDismiss(notification.id)}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon
            name="close"
            size={20}
            color={theme.colors.textTertiary || '#999'}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create(theme => ({
  container: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border || '#E0E0E0',
  },
  unreadContainer: {
    backgroundColor: theme.colors.primaryLight || '#E3F2FD',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  unreadIconContainer: {
    backgroundColor: theme.colors.primary || '#62B1F6',
    opacity: 0.2,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  unreadTitle: {
    fontWeight: 'bold',
  },
  message: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 12,
    color: theme.colors.textTertiary || '#999',
  },
  dismissButton: {
    padding: theme.spacing.xs,
    justifyContent: 'center',
  },
}));
