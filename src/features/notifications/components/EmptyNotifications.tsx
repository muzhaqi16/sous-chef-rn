import React from 'react';
import { useTranslation } from '#/i18n';
import { EmptyState } from '#components/molecules/EmptyState';

export const EmptyNotifications: React.FC = () => {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon="notifications-outline"
      title={t('empty.noNotifications')}
      description={t('empty.noNotificationsHint')}
    />
  );
};
