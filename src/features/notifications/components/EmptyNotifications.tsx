import React from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '#components/base/EmptyState';

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
