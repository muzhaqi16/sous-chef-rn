import React from 'react';
import { IconButton } from '#components/atoms/IconButton';
import { useToday } from '#hooks/app/useToday';
import { useTranslation } from '#i18n';
import { Icon } from '#components/atoms/Icon';
import type { DisplayNotification as NotificationType } from '#features/notifications/utils/toDisplayNotification';
import { getNotificationCopy } from '#features/notifications/utils/notificationHelpers';
import { getNotificationIcon } from './notificationIcon';
import { safeParseDate } from '#utils/dateUtils';

import { RowCard } from '#components/atoms/RowCard';
import { ListItem } from '#components/molecules/ListItem';
import { Text } from '#components/atoms/Text';
import { formatRelativeToNow } from '#utils/formatters/date';

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
  const { t } = useTranslation();
  const today = useToday();

  const handlePress = () => {
    onPress(notification);
  };

  const handleDismiss = () => {
    onDismiss?.(notification.id);
  };

  const formattedTimestamp = (() => {
    const date = safeParseDate(notification.sentAt);
    return date ? formatRelativeToNow(date) : t('notifications.recently');
  })();

  const copy = getNotificationCopy(notification, t, today);

  return (
    <RowCard>
      <ListItem
        leftElement={
          <Icon
            name={getNotificationIcon(notification.type)}
            size="md"
            tone={notification.isRead ? 'textSecondary' : 'primary'}
          />
        }
        title={copy.title}
        subtitle={
          <>
            {!!copy.message && (
              <Text role="caption" tone="secondary" numberOfLines={2}>
                {copy.message}
              </Text>
            )}
            <Text role="caption" tone="tertiary">
              {formattedTimestamp}
            </Text>
          </>
        }
        onPress={handlePress}
        tinted={!notification.isRead}
        accessibilityLabel={[copy.title, copy.message, formattedTimestamp]
          .filter(Boolean)
          .join(', ')}
        trailingActions={
          onDismiss ? (
            <IconButton
              name="close"
              size="sm"
              tone="textTertiary"
              onPress={handleDismiss}
              accessibilityLabel={t('notifications.dismissA11y')}
            />
          ) : undefined
        }
      />
    </RowCard>
  );
};

export const NotificationItem = NotificationItemComponent;
