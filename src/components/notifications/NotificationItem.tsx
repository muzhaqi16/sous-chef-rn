import React, {useCallback, useMemo} from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {Icon} from '#utils/iconUtils';
import {StyleSheet, useUnistyles} from 'react-native-unistyles';
import {formatDistanceToNow} from 'date-fns/formatDistanceToNow';
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

  const handlePress = useCallback(() => {
    onPress(notification);
  }, [notification, onPress]);

  const handleDismiss = useCallback(() => {
    onDismiss?.(notification.id);
  }, [notification.id, onDismiss]);

  const formattedTimestamp = useMemo(() => {
    const date = safeParseDate(notification.sentAt);
    return date
      ? formatDistanceToNow(date, {addSuffix: true})
      : 'Recently';
  }, [notification.sentAt]);

  return (
    <TouchableOpacity
      style={[styles.container, !notification.isRead && styles.unreadContainer]}
      onPress={handlePress}
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
          {formattedTimestamp}
        </Text>
      </View>

      {onDismiss && (
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
          <Icon
            name="close"
            size={20}
            color={theme.colors.textTertiary}
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
    borderBottomColor: theme.colors.border,
  },
  unreadContainer: {
    backgroundColor: theme.colors.primaryLight,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  unreadIconContainer: {
    backgroundColor: theme.colors.primary,
    opacity: 0.2,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: theme.fonts.size.md,
    fontWeight: theme.fonts.weight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  unreadTitle: {
    fontWeight: theme.fonts.weight.bold,
  },
  message: {
    fontSize: theme.fonts.size.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: theme.fonts.size.xs,
    color: theme.colors.textTertiary,
  },
  dismissButton: {
    padding: theme.spacing.xs,
    justifyContent: 'center',
  },
}));
