import React from 'react';
import { View } from 'react-native';
import { Icon } from '#utils/iconUtils';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { NotificationItem as NotificationType } from '#store/slices/notificationSlice';
import { getNotificationIcon } from '#utils/notifications/notificationHelpers';
import { safeParseDate } from '#utils/dateUtils';

import { Pressable } from 'react-native-gesture-handler';
import { Text } from '#components/atoms/Text';

interface NotificationItemProps {
  notification: NotificationType;
  onPress: (notification: NotificationType) => void;
  onDismiss?: (notificationId: string) => void;
}

const NotificationItemComponent: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
  onDismiss,
}) => {
  const { theme } = useUnistyles();

  const handlePress = () => {
    onPress(notification);
  };

  const handleDismiss = () => {
    onDismiss?.(notification.id);
  };

  const formattedTimestamp = (() => {
    const date = safeParseDate(notification.sentAt);
    return date ? formatDistanceToNow(date, { addSuffix: true }) : 'Recently';
  })();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        !notification.isRead && styles.unreadContainer,
        pressed && styles.pressed,
      ]}
      onPress={handlePress}
    >
      <View
        style={[
          styles.iconContainer,
          !notification.isRead && styles.unreadIconContainer,
        ]}
      >
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
          size="md"
          weight={notification.isRead ? 'medium' : 'bold'}
          style={styles.title}
        >
          {notification.title}
        </Text>
        <Text
          size="sm"
          tone="secondary"
          lineHeight="tight"
          style={styles.message}
          numberOfLines={2}
        >
          {notification.message}
        </Text>
        <Text size="xs" tone="tertiary">
          {formattedTimestamp}
        </Text>
      </View>

      {!!onDismiss && (
        <Pressable
          style={({ pressed }) => [
            styles.dismissButton,
            pressed && styles.pressed,
          ]}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="close" size={20} color={theme.colors.textTertiary} />
        </Pressable>
      )}
    </Pressable>
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
    marginBottom: theme.spacing.xs,
  },
  message: {
    marginBottom: theme.spacing.xs,
  },
  dismissButton: {
    padding: theme.spacing.xs,
    justifyContent: 'center',
  },
  pressed: {
    opacity: theme.opacity.pressed,
  },
}));

export const NotificationItem = NotificationItemComponent;
